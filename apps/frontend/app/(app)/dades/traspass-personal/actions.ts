"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  confirmarExecucioTraspassPersonal,
  processarFitxerHoresTreball,
  tornarEsborranyExecucioTraspassPersonal,
} from "@/lib/traspass-personal/service";
import { revalidatePath } from "next/cache";

async function requireEditor() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDICIO")) {
    return null;
  }
  return session.user;
}

export async function uploadHoresTreballAction(formData: FormData) {
  const user = await requireEditor();
  if (!user?.id) return { ok: false, missatge: "Sense permisos." };

  const file = formData.get("fitxer");
  if (!(file instanceof File)) return { ok: false, missatge: "Cap fitxer seleccionat." };

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const result = await processarFitxerHoresTreball(buffer, file.name, user.id);
    revalidatePath("/dades/traspass-personal");
    revalidatePath(`/dades/traspass-personal/${result.periodId}`);
    revalidatePath("/consultes/centre");
    revalidatePath("/consultes/linia");
    revalidatePath("/consultes/empresa");
    return { ok: true, missatge: result.missatge, periodId: result.periodId };
  } catch (e) {
    return {
      ok: false,
      missatge: e instanceof Error ? e.message : "Error en processar el fitxer.",
    };
  }
}

export async function confirmarTraspassPersonalAction(execucioId: string) {
  const user = await requireEditor();
  if (!user?.id) return { ok: false, missatge: "Sense permisos." };

  try {
    const { foraCentreSnapshot } = await confirmarExecucioTraspassPersonal(execucioId, user.id);
    revalidatePath("/dades/traspass-personal");
    revalidatePath("/dades/cost-salarial");
    revalidatePath("/consultes/centre");
    revalidatePath("/consultes/linia");
    revalidatePath("/consultes/empresa");
    revalidatePath("/consultes/cost-salarial");
    return {
      ok: true,
      missatge: "Traspassos confirmats.",
      foraCentreSnapshot,
    };
  } catch (e) {
    return {
      ok: false,
      missatge: e instanceof Error ? e.message : "Error en confirmar.",
    };
  }
}

function revalidateTraspassos(periodId?: string) {
  revalidatePath("/dades/traspass-personal");
  if (periodId) revalidatePath(`/dades/traspass-personal/${periodId}`);
  revalidatePath("/consultes/centre");
  revalidatePath("/consultes/linia");
  revalidatePath("/consultes/empresa");
}

export async function tornarEsborranyTraspassPersonalAction(execucioId: string) {
  const user = await requireEditor();
  if (!user?.id) return { ok: false, missatge: "Sense permisos." };

  try {
    const execucio = await db.execucioTraspassPersonal.findUnique({
      where: { id: execucioId },
      select: { periodId: true },
    });
    if (!execucio) return { ok: false, missatge: "Execució no trobada." };

    await tornarEsborranyExecucioTraspassPersonal(execucioId);
    revalidateTraspassos(execucio.periodId);
    revalidatePath("/dades/cost-salarial");
    revalidatePath("/consultes/cost-salarial");
    return {
      ok: true,
      missatge: "Execució tornada a esborrany. Fora centre restaurat als valors anteriors.",
    };
  } catch (e) {
    return {
      ok: false,
      missatge: e instanceof Error ? e.message : "Error en tornar a esborrany.",
    };
  }
}

export async function updateMovimentTraspassAction(
  movimentId: string,
  data: { minuts?: number; hores?: number; tarifaHora?: number; import_?: number }
) {
  const user = await requireEditor();
  if (!user?.id) return { ok: false, missatge: "Sense permisos." };

  const mov = await db.movimentTraspassPersonal.findUnique({
    where: { id: movimentId },
    select: {
      execucioId: true,
      execucio: { select: { estat: true, periodId: true } },
      minuts: true,
      hores: true,
      tarifaHora: true,
      import_: true,
    },
  });
  if (!mov) return { ok: false, missatge: "Moviment no trobat." };

  if (mov.execucio.estat !== "BORRADOR") {
    return { ok: false, missatge: "Només pots editar moviments en esborrany." };
  }

  const minuts = data.minuts ?? Number(mov.minuts);
  const hores = data.hores ?? Number(mov.hores);
  const tarifaHora = data.tarifaHora ?? Number(mov.tarifaHora);
  const import_ = data.import_ ?? Number(mov.import_);

  if (!(minuts >= 0) || !(hores >= 0) || !(tarifaHora >= 0) || !(import_ >= 0)) {
    return { ok: false, missatge: "Els valors han de ser positius." };
  }

  await db.movimentTraspassPersonal.update({
    where: { id: movimentId },
    data: { minuts, hores, tarifaHora, import_ },
  });
  revalidateTraspassos(mov.execucio.periodId);
  return { ok: true, missatge: "Moviment actualitzat." };
}

export async function deleteMovimentTraspassAction(movimentId: string) {
  const user = await requireEditor();
  if (!user?.id) return { ok: false, missatge: "Sense permisos." };

  const mov = await db.movimentTraspassPersonal.findUnique({
    where: { id: movimentId },
    select: { execucio: { select: { estat: true, periodId: true } } },
  });
  if (!mov) return { ok: false, missatge: "Moviment no trobat." };
  if (mov.execucio.estat !== "BORRADOR") {
    return { ok: false, missatge: "Només pots eliminar moviments en esborrany." };
  }

  await db.movimentTraspassPersonal.delete({ where: { id: movimentId } });
  revalidateTraspassos(mov.execucio.periodId);
  return { ok: true, missatge: "Moviment eliminat." };
}

export async function deleteExecucioTraspassPersonalAction(execucioId: string) {
  const user = await requireEditor();
  if (!user?.id) return { ok: false, missatge: "Sense permisos." };

  const execucio = await db.execucioTraspassPersonal.findUnique({
    where: { id: execucioId },
    select: {
      periodId: true,
      importacioId: true,
      estat: true,
      foraCentreSnapshotJson: true,
    },
  });
  if (!execucio) return { ok: false, missatge: "Execució no trobada." };

  if (execucio.estat === "CONFIRMAT") {
    const { parseForaCentreSnapshot, restaurarForaCentreDesDeSnapshot } = await import(
      "@/lib/traspass-personal/fora-centre"
    );
    await restaurarForaCentreDesDeSnapshot(
      execucio.periodId,
      parseForaCentreSnapshot(execucio.foraCentreSnapshotJson)
    );
  }

  await db.execucioTraspassPersonal.delete({ where: { id: execucioId } });
  if (execucio.importacioId) {
    await db.importacio.delete({ where: { id: execucio.importacioId } }).catch(() => null);
  }
  revalidateTraspassos(execucio.periodId);
  revalidatePath("/dades/cost-salarial");
  return { ok: true, missatge: "Importació i execució eliminades." };
}

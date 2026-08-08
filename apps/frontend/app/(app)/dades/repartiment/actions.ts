"use server";

import { auth } from "@/lib/auth";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import {
  calcularExecucioRepartiment,
  confirmarExecucioRepartiment,
} from "@/lib/repartiment/service";
import { revalidatePath } from "next/cache";

async function requireEditor() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EDICIO")) {
    return null;
  }
  return session.user;
}

export async function calcularRepartimentAction(periodId: string) {
  const user = await requireEditor();
  if (!user) return { ok: false, missatge: "Sense permisos." };
  try {
    await calcularExecucioRepartiment(periodId);
    revalidateConsultesDades();
    revalidatePath("/dades/repartiment");
    revalidatePath(`/dades/repartiment/${periodId}`);
    revalidatePath("/consultes/empresa");
    return {
      ok: true,
      missatge:
        "Repartiment calculat. Revisa que zero-sum compres/personal/gestió quadri (nodes 11, 17, 30).",
    };
  } catch (e) {
    return { ok: false, missatge: e instanceof Error ? e.message : "Error en calcular." };
  }
}

export async function confirmarRepartimentAction(execucioId: string) {
  const user = await requireEditor();
  if (!user?.id) return { ok: false, missatge: "Sense permisos." };
  const execucio = await db.execucioRepartiment.findUnique({
    where: { id: execucioId },
    select: { periodId: true },
  });
  await confirmarExecucioRepartiment(execucioId, user.id);
  revalidateConsultesDades();
  revalidatePath("/dades/repartiment");
  if (execucio) revalidatePath(`/dades/repartiment/${execucio.periodId}`);
  revalidatePath("/consultes/empresa");
  return { ok: true, missatge: "Repartiment confirmat." };
}

export async function updatePesOverrideAction(pesId: string, pesOverride: number | null) {
  const user = await requireEditor();
  if (!user) return { ok: false };
  await db.pesRepartiment.update({
    where: { id: pesId },
    data: { pesOverride },
  });
  const pes = await db.pesRepartiment.findUnique({
    where: { id: pesId },
    select: { execucio: { select: { periodId: true, id: true } } },
  });
  if (pes) {
    await calcularExecucioRepartiment(pes.execucio.periodId);
    revalidatePath(`/dades/repartiment/${pes.execucio.periodId}`);
  }
  return { ok: true };
}

export async function updateMovimentOverrideAction(
  movimentId: string,
  importOverride: number | null
) {
  const user = await requireEditor();
  if (!user) return { ok: false };
  await db.movimentRepartiment.update({
    where: { id: movimentId },
    data: { importOverride },
  });
  const mov = await db.movimentRepartiment.findUnique({
    where: { id: movimentId },
    select: { execucio: { select: { periodId: true } } },
  });
  if (mov) revalidatePath(`/dades/repartiment/${mov.execucio.periodId}`);
  return { ok: true };
}

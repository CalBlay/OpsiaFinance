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

/** Calcula i confirma tots els mesos pendents d’un exercici (no toca els ja confirmats). */
export async function calcularIConfirmarRepartimentAnyAction(any: number) {
  const user = await requireEditor();
  if (!user?.id) return { ok: false, missatge: "Sense permisos." };
  if (!Number.isFinite(any) || any < 2000 || any > 2100) {
    return { ok: false, missatge: "Any no vàlid." };
  }

  const periods = await db.period.findMany({
    where: { any, dadesResultat: { some: {} } },
    orderBy: { mes: "asc" },
    include: { execucioRepartiment: { select: { id: true, estat: true } } },
  });

  if (periods.length === 0) {
    return { ok: false, missatge: `No hi ha períodes amb dades per a ${any}.` };
  }

  let confirmats = 0;
  let omesos = 0;
  const errors: string[] = [];

  for (const p of periods) {
    if (p.execucioRepartiment?.estat === "CONFIRMAT") {
      omesos += 1;
      continue;
    }
    try {
      const exec = await calcularExecucioRepartiment(p.id);
      if (!exec?.id) {
        errors.push(`${p.nom}: no s'ha pogut crear l'execució.`);
        continue;
      }
      await confirmarExecucioRepartiment(exec.id, user.id);
      confirmats += 1;
    } catch (e) {
      errors.push(`${p.nom}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  revalidateConsultesDades();
  revalidatePath("/dades/repartiment");
  revalidatePath("/consultes/empresa");

  const parts = [
    confirmats > 0 ? `${confirmats} confirmat${confirmats === 1 ? "" : "s"}` : null,
    omesos > 0
      ? `${omesos} ja confirmat${omesos === 1 ? "" : "s"} (omitit${omesos === 1 ? "" : "s"})`
      : null,
    errors.length > 0 ? `${errors.length} error${errors.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return {
    ok: errors.length === 0 && confirmats > 0,
    missatge:
      parts.length > 0
        ? `${any}: ${parts.join(" · ")}${errors.length ? `. ${errors.slice(0, 3).join(" · ")}` : ""}`
        : `${any}: no hi havia mesos pendents.`,
  };
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

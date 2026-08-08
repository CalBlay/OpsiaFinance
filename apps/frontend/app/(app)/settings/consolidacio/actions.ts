"use server";

import { auth } from "@/lib/auth";
import {
  resetNormesConsolidacioSeed,
  syncNormesConsolidacioSeed,
} from "@/lib/consolidacio/normes-default";
import { revalidateConsultesDades } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import type { GrupConsolidacio, TipusNormaConsolidacio } from "@prisma/client";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; missatge: string };
const OK = (m = ""): Result => ({ ok: true, missatge: m });
const ERR = (m: string): Result => ({ ok: false, missatge: m });

async function requireEditor(): Promise<boolean> {
  const session = await auth();
  const role = session?.user?.role;
  return role === "ADMIN" || role === "EDICIO";
}

function refresh() {
  revalidateConsultesDades();
  revalidatePath("/settings/consolidacio");
  revalidatePath("/consultes/empresa");
  revalidatePath("/consultes/evolucio");
  revalidatePath("/consultes/comparativa");
}

function parseNodes(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export async function carregarNormesConsolidacioSeedAction(): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const r = await resetNormesConsolidacioSeed();
  refresh();
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}

export async function inicialitzarNormesConsolidacioAction(): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const r = await syncNormesConsolidacioSeed();
  refresh();
  return r.ok ? OK(r.missatge) : ERR(r.missatge);
}

export async function toggleNormaConsolidacioAction(id: string, actiu: boolean): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  await db.normaConsolidacio.update({ where: { id }, data: { actiu } });
  refresh();
  return OK();
}

export async function updateNormaConsolidacioAction(
  id: string,
  patch: {
    nom?: string;
    descripcio?: string;
    nodeExcloure?: number | null;
    nodesAjust?: string;
    nodeOrigen?: number | null;
    nodeDesti?: number | null;
    grupEmpresaOrigen?: string | null;
    grupEmpresaDesti?: string | null;
  }
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");

  const data: Record<string, unknown> = {};
  if (patch.nom !== undefined) data.nom = patch.nom.trim();
  if (patch.descripcio !== undefined) data.descripcio = patch.descripcio.trim() || null;
  if (patch.nodeExcloure !== undefined) data.nodeExcloure = patch.nodeExcloure;
  if (patch.nodesAjust !== undefined) data.nodesAjust = parseNodes(patch.nodesAjust);
  if (patch.nodeOrigen !== undefined) data.nodeOrigen = patch.nodeOrigen;
  if (patch.nodeDesti !== undefined) data.nodeDesti = patch.nodeDesti;
  if (patch.grupEmpresaOrigen !== undefined)
    data.grupEmpresaOrigen = patch.grupEmpresaOrigen || null;
  if (patch.grupEmpresaDesti !== undefined) data.grupEmpresaDesti = patch.grupEmpresaDesti || null;

  await db.normaConsolidacio.update({ where: { id }, data });
  refresh();
  return OK();
}

export async function upsertImportNormaConsolidacioAction(
  normaId: string,
  any: number,
  mes: number,
  importValor: number,
  nota?: string
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  if (!Number.isInteger(any) || any < 2000 || any > 2100) return ERR("Any no vàlid.");
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return ERR("Mes no vàlid.");
  if (!Number.isFinite(importValor)) return ERR("Import no vàlid.");

  const norma = await db.normaConsolidacio.findUnique({
    where: { id: normaId },
    select: { fontImport: true },
  });
  if (!norma) return ERR("Norma no trobada.");
  if (norma.fontImport !== "IMPORT_FIX_MENSUAL") {
    return ERR("Aquesta norma no usa imports mensuals.");
  }

  await db.normaConsolidacioImport.upsert({
    where: { normaId_any_mes: { normaId, any, mes } },
    update: {
      import_: Math.round(importValor * 100) / 100,
      nota: nota?.trim() || null,
    },
    create: {
      normaId,
      any,
      mes,
      import_: Math.round(importValor * 100) / 100,
      nota: nota?.trim() || null,
    },
  });
  refresh();
  return OK("Import desat.");
}

export async function deleteImportNormaConsolidacioAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  await db.normaConsolidacioImport.delete({ where: { id } });
  refresh();
  return OK("Import eliminat.");
}

export async function createNormaConsolidacioAction(
  grup: GrupConsolidacio,
  tipus: TipusNormaConsolidacio,
  nom: string,
  nodeExcloure: number | null,
  nodesAjust: string
): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const desc = nom.trim();
  if (!desc) return ERR("El nom és obligatori.");

  const max = await db.normaConsolidacio.aggregate({
    where: { grup },
    _max: { ordre: true },
  });

  if (tipus === "EXCLURE_NODE" && nodeExcloure == null) {
    return ERR("Cal indicar el node a excloure.");
  }

  await db.normaConsolidacio.create({
    data: {
      nom: desc,
      grup,
      tipus,
      ordre: (max._max.ordre ?? 0) + 10,
      actiu: true,
      nodeExcloure: tipus === "EXCLURE_NODE" ? nodeExcloure : null,
      nodesAjust: tipus === "EXCLURE_NODE" ? parseNodes(nodesAjust) : [],
    },
  });
  refresh();
  return OK();
}

export async function deleteNormaConsolidacioAction(id: string): Promise<Result> {
  if (!(await requireEditor())) return ERR("Sense permisos.");
  const norma = await db.normaConsolidacio.findUnique({ where: { id }, select: { codi: true } });
  if (norma?.codi) {
    return ERR("Les normes del seed no es poden eliminar. Desactiva-les si cal.");
  }
  await db.normaConsolidacio.delete({ where: { id } });
  refresh();
  return OK();
}

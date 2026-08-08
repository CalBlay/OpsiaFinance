import {
  type ConsolidacioPeriode,
  type NormaConsolidacioMin,
  aplicarNormesConsolidacio,
} from "@/lib/consolidacio/motor";
import type { ConceptePivot } from "@/lib/consultes";
import { db } from "@/lib/db";
import type { GrupConsolidacio } from "@prisma/client";
import { cache } from "react";

export type { ConsolidacioPeriode };

export const getNormesConsolidacio = cache(async (grup: GrupConsolidacio) => {
  return db.normaConsolidacio.findMany({
    where: { grup },
    orderBy: { ordre: "asc" },
  });
});

function toMin(
  normes: Awaited<ReturnType<typeof getNormesConsolidacio>>,
  importsByNorma: Map<string, Map<number, number>>
): NormaConsolidacioMin[] {
  return normes.map((n) => ({
    id: n.id,
    tipus: n.tipus,
    actiu: n.actiu,
    nodeExcloure: n.nodeExcloure,
    nodesAjust: n.nodesAjust,
    grupEmpresaOrigen: n.grupEmpresaOrigen,
    nodeOrigen: n.nodeOrigen,
    grupEmpresaDesti: n.grupEmpresaDesti,
    nodeDesti: n.nodeDesti,
    nodesOrigen: n.nodesOrigen,
    nodesDesti: n.nodesDesti,
    fontImport: n.fontImport,
    importsMensuals: importsByNorma.get(n.id),
  }));
}

async function carregarImportsMensuals(
  normaIds: string[],
  periode?: ConsolidacioPeriode
): Promise<Map<string, Map<number, number>>> {
  const out = new Map<string, Map<number, number>>();
  if (normaIds.length === 0 || !periode) return out;

  const rows = await db.normaConsolidacioImport.findMany({
    where: {
      normaId: { in: normaIds },
      any: periode.any,
      mes: { gte: periode.desMes, lte: periode.finsMes },
    },
    select: { normaId: true, mes: true, import_: true },
  });

  for (const r of rows) {
    let m = out.get(r.normaId);
    if (!m) {
      m = new Map();
      out.set(r.normaId, m);
    }
    m.set(r.mes, Number(r.import_));
  }
  return out;
}

export async function aplicarConsolidacio(
  concepts: ConceptePivot[],
  grup: GrupConsolidacio,
  mode: "columnes-ln" | "temporal",
  parellsInterEmpresa?: Map<string, ConceptePivot[]>,
  periode?: ConsolidacioPeriode
): Promise<ConceptePivot[]> {
  const normes = await getNormesConsolidacio(grup);
  if (normes.length === 0) return concepts;

  const needsImports = normes.some((n) => n.actiu && n.fontImport === "IMPORT_FIX_MENSUAL");
  const importsByNorma = needsImports
    ? await carregarImportsMensuals(
        normes.filter((n) => n.fontImport === "IMPORT_FIX_MENSUAL").map((n) => n.id),
        periode
      )
    : new Map<string, Map<number, number>>();

  return aplicarNormesConsolidacio(
    concepts,
    toMin(normes, importsByNorma),
    mode,
    parellsInterEmpresa,
    periode
  );
}

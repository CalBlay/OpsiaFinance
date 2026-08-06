import { type ConcepteOrdre, recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import type { ConceptePivot } from "@/lib/consultes";
import { type RangMesos, prismaPeriodFilter } from "@/lib/periodes";
import { nodePresentacioGestio } from "@/lib/repartiment/nodes";

export const COL_REPARTIMENT_ID = "__repartiment__";

/** Etiqueta de columna / detall a consultes Gestió (abans «Repart.»). */
export const COL_REPARTIMENT_CODI = "ESTRUCTURA";
export const COL_REPARTIMENT_NOM = "ESTRUCTURA";
export const COL_REPARTIMENT_LABEL_DETALL = "ESTRUCTURA";

/** Suma deltas de diversos períodes en un mapa LN → node → import. */
export function agregarDeltasPerLn(
  deltasPerPeriode: Map<string, Map<string, Map<number, number>>>
): Map<string, Map<number, number>> {
  const deltaByLnNode = new Map<string, Map<number, number>>();
  for (const perLn of deltasPerPeriode.values()) {
    for (const [lnId, nodes] of perLn) {
      let acc = deltaByLnNode.get(lnId);
      if (!acc) {
        acc = new Map();
        deltaByLnNode.set(lnId, acc);
      }
      for (const [node, v] of nodes) {
        acc.set(node, (acc.get(node) ?? 0) + v);
      }
    }
  }
  return deltaByLnNode;
}

function conceptsFromRows(rows: ConceptePivot[]): ConcepteOrdre[] {
  return rows.map((r) => ({ node: r.node, esSubtotal: r.esSubtotal }));
}

/**
 * Aplica moviments de repartiment confirmats sobre files directes SAP (columnes LN).
 * Els deltas es mostren a la línia de detall; els subtotals es recalculen.
 */
export function aplicarGestioRepartiment(
  _concepts: ConcepteOrdre[],
  rows: ConceptePivot[],
  lnIds: string[],
  deltaByLnNode: Map<string, Map<number, number>>
): ConceptePivot[] {
  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(merged.map((r) => [r.node, r]));

  for (let i = 0; i < lnIds.length; i++) {
    const nodes = deltaByLnNode.get(lnIds[i]);
    if (!nodes) continue;
    for (const [node, delta] of nodes) {
      if (delta === 0) continue;
      const row = byNode.get(nodePresentacioGestio(node));
      if (row) row.valors[i] += delta;
    }
  }

  for (const row of merged) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }

  return recalcularSubtotalsCompte(conceptsFromRows(merged), merged);
}

/**
 * Vista per LN: centres en base Gestió + columna «ESTRUCTURA» amb la imputació de gestió.
 */
export function aplicarGestioRepartimentLn(
  _concepts: ConcepteOrdre[],
  rows: ConceptePivot[],
  deltaByNode: Map<number, number>
): ConceptePivot[] {
  const extended = rows.map((r) => ({
    ...r,
    valors: [...r.valors, 0],
  }));
  if (extended.length === 0) return extended;
  const byNode = new Map(extended.map((r) => [r.node, r]));
  const colRepart = extended[0].valors.length - 1;

  for (const [node, delta] of deltaByNode) {
    if (delta === 0) continue;
    const row = byNode.get(nodePresentacioGestio(node));
    if (row) row.valors[colRepart] += delta;
  }

  for (const row of extended) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }

  return recalcularSubtotalsCompte(conceptsFromRows(extended), extended);
}

/** Nodes on el total empresa ha de ser invariant (zero-sum entre LN). */
export const NODES_INVARIANT_EMPRESA = [11, 17, 30] as const;

/** Acumula el delta d'un moviment al destí (sense tocar Central). */
export function aplicarDeltaDesti(
  perLn: Map<string, Map<number, number>>,
  liniaNegociDestiId: string,
  concepteNode: number,
  imp: number
): void {
  let perNode = perLn.get(liniaNegociDestiId);
  if (!perNode) {
    perNode = new Map();
    perLn.set(liniaNegociDestiId, perNode);
  }
  perNode.set(concepteNode, (perNode.get(concepteNode) ?? 0) + imp);
}

/**
 * Central = residual zero-sum: Σ delta[LN][node] = 0 a nivell empresa.
 * Això garanteix Directe = Gestió en totals d'empresa; només canvia el pes per LN.
 */
export function balanceZeroSumCentral(
  perLn: Map<string, Map<number, number>>,
  centralId: string,
  nodes: readonly number[] = NODES_INVARIANT_EMPRESA
): void {
  for (const node of nodes) {
    let sumOthers = 0;
    for (const [lnId, nodeMap] of perLn) {
      if (lnId === centralId) continue;
      sumOthers += nodeMap.get(node) ?? 0;
    }
    let perNode = perLn.get(centralId);
    if (!perNode) {
      perNode = new Map();
      perLn.set(centralId, perNode);
    }
    perNode.set(node, -sumOthers);
  }
}

/** Acumula deltas de moviments i equilibra Central (consulta gestió + validació). */
export function accumularDeltasRepartiment(
  perLn: Map<string, Map<number, number>>,
  liniaNegociDestiId: string,
  concepteNode: number,
  imp: number,
  centralId: string | null
): void {
  aplicarDeltaDesti(perLn, liniaNegociDestiId, concepteNode, imp);
  if (centralId) balanceZeroSumCentral(perLn, centralId, [concepteNode]);
}

/** Comprova Σ delta[LN][node] ≈ 0 (reclassificació, no cost nou). */
export function validarZeroSumDeltas(
  deltaByLnNode: Map<string, Map<number, number>>,
  nodes: readonly number[] = NODES_INVARIANT_EMPRESA
): { ok: boolean; desquadraments: { node: number; suma: number }[] } {
  const desquadraments: { node: number; suma: number }[] = [];
  for (const node of nodes) {
    let suma = 0;
    for (const perNode of deltaByLnNode.values()) {
      suma += perNode.get(node) ?? 0;
    }
    if (Math.abs(suma) > 0.01) desquadraments.push({ node, suma });
  }
  return { ok: desquadraments.length === 0, desquadraments };
}

export async function carregarDeltasGestioAgregats(
  any: number,
  rang: RangMesos
): Promise<Map<string, Map<number, number>>> {
  const { db } = await import("@/lib/db");
  const { getDeltasGestioPerLn } = await import("@/lib/repartiment/service");
  const periods = await db.period.findMany({
    where: prismaPeriodFilter(any, rang),
    select: { id: true },
  });
  const deltasPerPeriode = await getDeltasGestioPerLn(periods.map((p) => p.id));
  return agregarDeltasPerLn(deltasPerPeriode);
}

/** Aplica repartiment confirmat a l'evolució mensual (12 columnes) d'una LN. */
export async function aplicarGestioEvolucioLn(
  liniaNegociId: string,
  any: number,
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  const { db } = await import("@/lib/db");
  const { getDeltasGestioPerLn } = await import("@/lib/repartiment/service");

  const periods = await db.period.findMany({
    where: { any },
    select: { id: true, mes: true },
  });
  if (!periods.length) return rows;

  const mesByPeriodId = new Map(periods.map((p) => [p.id, p.mes]));
  const deltasPerPeriode = await getDeltasGestioPerLn(periods.map((p) => p.id));

  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(merged.map((r) => [r.node, r]));

  for (const [periodId, perLn] of deltasPerPeriode) {
    const mesIdx = (mesByPeriodId.get(periodId) ?? 1) - 1;
    if (mesIdx < 0 || mesIdx > 11) continue;
    const nodes = perLn.get(liniaNegociId);
    if (!nodes) continue;
    for (const [node, delta] of nodes) {
      if (delta === 0) continue;
      const row = byNode.get(nodePresentacioGestio(node));
      if (row) row.valors[mesIdx] += delta;
    }
  }

  for (const row of merged) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }
  return recalcularSubtotalsCompte(conceptsFromRows(merged), merged);
}

/**
 * Evolució mensual empresa: suma els deltas de totes les LN per mes.
 * (Els traspassos entre centres es cancel·len a nivell empresa.)
 */
export async function aplicarGestioEvolucioEmpresa(
  any: number,
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  const { db } = await import("@/lib/db");
  const { getDeltasGestioPerLn } = await import("@/lib/repartiment/service");

  const periods = await db.period.findMany({
    where: { any },
    select: { id: true, mes: true },
  });
  if (!periods.length) return rows;

  const mesByPeriodId = new Map(periods.map((p) => [p.id, p.mes]));
  const deltasPerPeriode = await getDeltasGestioPerLn(periods.map((p) => p.id));

  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(merged.map((r) => [r.node, r]));

  for (const [periodId, perLn] of deltasPerPeriode) {
    const mesIdx = (mesByPeriodId.get(periodId) ?? 1) - 1;
    if (mesIdx < 0 || mesIdx > 11) continue;

    const perNode = new Map<number, number>();
    for (const nodes of perLn.values()) {
      for (const [node, v] of nodes) {
        perNode.set(node, (perNode.get(node) ?? 0) + v);
      }
    }

    for (const [node, delta] of perNode) {
      if (delta === 0) continue;
      const row = byNode.get(nodePresentacioGestio(node));
      if (row) row.valors[mesIdx] += delta;
    }
  }

  for (const row of merged) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }
  return recalcularSubtotalsCompte(conceptsFromRows(merged), merged);
}

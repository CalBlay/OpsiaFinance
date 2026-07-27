import { type ConcepteOrdre, recalcularCompositesOnly } from "@/lib/compte-subtotals";
import type { ConceptePivot } from "@/lib/consultes";

export const COL_REPARTIMENT_ID = "__repartiment__";

/** Suma deltas de diversos períodes en un mapa LN → node → import. */
export function agregarDeltasPerLn(
  deltasPerPeriode: Map<string, Map<string, Map<number, number>>>
): Map<string, Map<number, number>> {
  const deltaByLnNode = new Map<string, Map<number, number>>();
  for (const perLn of deltasPerPeriode.values()) {
    for (const [lnId, nodes] of perLn) {
      if (!deltaByLnNode.has(lnId)) deltaByLnNode.set(lnId, new Map());
      const acc = deltaByLnNode.get(lnId)!;
      for (const [node, v] of nodes) {
        acc.set(node, (acc.get(node) ?? 0) + v);
      }
    }
  }
  return deltaByLnNode;
}

/**
 * Aplica moviments de repartiment confirmats sobre files directes SAP (columnes LN).
 * Els deltas s'apliquen després del càlcul directe; només es recalculen subtotals composits.
 */
export function aplicarGestioRepartiment(
  _concepts: ConcepteOrdre[],
  rows: ConceptePivot[],
  lnIds: string[],
  deltaByLnNode: Map<string, Map<number, number>>
): ConceptePivot[] {
  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));

  for (const row of merged) {
    for (let i = 0; i < lnIds.length; i++) {
      const delta = deltaByLnNode.get(lnIds[i])?.get(row.node) ?? 0;
      if (delta !== 0) row.valors[i] += delta;
    }
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }

  return recalcularCompositesOnly(merged);
}

/**
 * Vista per LN: centres en directe SAP + columna «Repartiment» amb la imputació de gestió.
 */
export function aplicarGestioRepartimentLn(
  _concepts: ConcepteOrdre[],
  rows: ConceptePivot[],
  deltaByNode: Map<number, number>
): ConceptePivot[] {
  const extended = rows.map((r) => ({
    ...r,
    valors: [...r.valors, deltaByNode.get(r.node) ?? 0],
  }));

  for (const row of extended) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }

  return recalcularCompositesOnly(extended);
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
  if (!perLn.has(liniaNegociDestiId)) perLn.set(liniaNegociDestiId, new Map());
  const perNode = perLn.get(liniaNegociDestiId)!;
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
    if (!perLn.has(centralId)) perLn.set(centralId, new Map());
    perLn.get(centralId)!.set(node, -sumOthers);
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
  mes: number | null
): Promise<Map<string, Map<number, number>>> {
  const { db } = await import("@/lib/db");
  const { getDeltasGestioPerLn } = await import("@/lib/repartiment/service");
  const periods = await db.period.findMany({
    where: mes ? { any, mes } : { any },
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
  for (const [periodId, perLn] of deltasPerPeriode) {
    const mesIdx = (mesByPeriodId.get(periodId) ?? 1) - 1;
    if (mesIdx < 0 || mesIdx > 11) continue;
    const nodes = perLn.get(liniaNegociId);
    if (!nodes) continue;
    for (const row of merged) {
      const delta = nodes.get(row.node) ?? 0;
      if (delta !== 0) row.valors[mesIdx] += delta;
    }
  }

  for (const row of merged) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }
  return recalcularCompositesOnly(merged);
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
  for (const [periodId, perLn] of deltasPerPeriode) {
    const mesIdx = (mesByPeriodId.get(periodId) ?? 1) - 1;
    if (mesIdx < 0 || mesIdx > 11) continue;

    const perNode = new Map<number, number>();
    for (const nodes of perLn.values()) {
      for (const [node, v] of nodes) {
        perNode.set(node, (perNode.get(node) ?? 0) + v);
      }
    }

    for (const row of merged) {
      const delta = perNode.get(row.node) ?? 0;
      if (delta !== 0) row.valors[mesIdx] += delta;
    }
  }

  for (const row of merged) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }
  return recalcularCompositesOnly(merged);
}

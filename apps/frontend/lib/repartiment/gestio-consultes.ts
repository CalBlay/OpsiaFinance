import { type ConcepteOrdre, recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import type { ConceptePivot } from "@/lib/consultes";
import { db } from "@/lib/db";
import { type RangMesos, prismaPeriodFilter } from "@/lib/periodes";
import {
  CODI_LN_CENTRAL,
  fraccionsRepartimentDetall,
  nodesPresentacioGestio,
  partsDeltaDetall,
} from "@/lib/repartiment/nodes";
import { cache } from "react";

export {
  COL_REPARTIMENT_CODI,
  COL_REPARTIMENT_ID,
  COL_REPARTIMENT_LABEL_DETALL,
  COL_REPARTIMENT_NOM,
} from "@/lib/repartiment/constants";

type RowAmbValors = { node: number; valors: number[] };

/** Nodes on el total empresa ha de ser invariant (zero-sum entre LN): Compres, Personal, Gestió. */
export const NODES_INVARIANT_EMPRESA = [11, 17, 30] as const;

const getCentralLnId = cache(async (): Promise<string | null> => {
  const c = await db.liniaNegoci.findUnique({
    where: { codi: CODI_LN_CENTRAL },
    select: { id: true },
  });
  return c?.id ?? null;
});

/**
 * Aplica un delta de total (11/17/30) als detalls de presentació.
 *
 * - Mode normal (altres LN): suma el delta (amb clamp anti-positius per defecte).
 * - Mode `substituirObjectiu` (LN00000 a Gestió): substitueix el Directe per l’objectiu
 *   destí (base+delta); el SAP Directe de Central «desapareix» a Gestió.
 */
export function aplicarDeltaPresentacioGestio(
  byNode: Map<number, RowAmbValors>,
  nodeTotal: number,
  colIdx: number,
  delta: number,
  opts?: {
    pesosDesDaltresColumnes?: boolean;
    substituirObjectiu?: boolean;
    evitaPositius?: boolean;
  }
): void {
  if (delta === 0 && !opts?.substituirObjectiu) return;
  const detalls = nodesPresentacioGestio(nodeTotal);
  const bases = detalls.map((d) => {
    const row = byNode.get(d);
    if (!row) return 0;
    if (opts?.pesosDesDaltresColumnes) {
      return row.valors.reduce((s, v, i) => (i === colIdx ? s : s + v), 0);
    }
    return row.valors[colIdx] ?? 0;
  });

  if (opts?.substituirObjectiu) {
    const baseSum = bases.reduce((a, b) => a + b, 0);
    const objectiu = baseSum + delta;
    const fracs = fraccionsRepartimentDetall(bases);
    for (let i = 0; i < detalls.length; i++) {
      const detall = detalls[i];
      if (detall == null) continue;
      const row = byNode.get(detall);
      if (row) row.valors[colIdx] = objectiu * (fracs[i] ?? 0);
    }
    return;
  }

  const parts = partsDeltaDetall(delta, bases, opts?.evitaPositius !== false);
  for (let i = 0; i < detalls.length; i++) {
    const detall = detalls[i];
    if (detall == null) continue;
    const row = byNode.get(detall);
    const part = parts[i] ?? 0;
    if (row && part !== 0) row.valors[colIdx] += part;
  }
}

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
 * LN00000 a Gestió: substitueix Directe per l’objectiu destí (residual zero-sum).
 * Compres / Personal / Gestió: el total d'empresa no canvia (només es redistribueix LN00000).
 */
export function aplicarGestioRepartiment(
  _concepts: ConcepteOrdre[],
  rows: ConceptePivot[],
  lnIds: string[],
  deltaByLnNode: Map<string, Map<number, number>>,
  opts?: { substituirLnIds?: ReadonlySet<string> }
): ConceptePivot[] {
  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(merged.map((r) => [r.node, r]));
  const substituir = opts?.substituirLnIds;

  for (let i = 0; i < lnIds.length; i++) {
    const lnId = lnIds[i];
    if (!lnId) continue;
    const nodes = deltaByLnNode.get(lnId);
    if (!nodes) continue;
    const esDestiCentral = substituir?.has(lnId) ?? false;
    for (const [node, delta] of nodes) {
      aplicarDeltaPresentacioGestio(byNode, node, i, delta, {
        substituirObjectiu: esDestiCentral,
      });
    }
  }

  const centralId = substituir ? [...substituir][0] : undefined;
  if (centralId) {
    equilibrarInvariantEmpresa(rows, merged, lnIds, centralId);
  }

  for (const row of merged) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }

  return recalcularSubtotalsCompte(conceptsFromRows(merged), merged);
}

/**
 * Si la presentació (clamp evitaPositius, arrodoniments) desquadra Compres/Personal/Gestió
 * a nivell empresa, el drift torna a LN00000. Invariant: Traspassos.total = Gestió.total.
 */
export function equilibrarInvariantEmpresa(
  original: ConceptePivot[],
  merged: ConceptePivot[],
  lnIds: string[],
  centralId: string
): void {
  const colC = lnIds.indexOf(centralId);
  if (colC < 0) return;
  const origByNode = new Map(original.map((r) => [r.node, r]));
  const nowByNode = new Map(merged.map((r) => [r.node, r]));

  for (const nodeTotal of NODES_INVARIANT_EMPRESA) {
    const detalls = nodesPresentacioGestio(nodeTotal);
    let drift = 0;
    for (const d of detalls) {
      const o = origByNode.get(d);
      const n = nowByNode.get(d);
      const origSum = o ? o.valors.reduce((a, b) => a + b, 0) : 0;
      const nowSum = n ? n.valors.reduce((a, b) => a + b, 0) : 0;
      drift += origSum - nowSum;
    }
    if (Math.abs(drift) < 0.005) continue;
    const bases = detalls.map((d) => nowByNode.get(d)?.valors[colC] ?? 0);
    const parts = partsDeltaDetall(drift, bases, false);
    for (let i = 0; i < detalls.length; i++) {
      const detall = detalls[i];
      if (detall == null) continue;
      const row = nowByNode.get(detall);
      if (!row) continue;
      row.valors[colC] = (row.valors[colC] ?? 0) + (parts[i] ?? 0);
    }
  }
}

/**
 * Vista per LN: centres + columna ESTRUCTURA.
 * Si és LN00000 Gestió: el Directe dels centres es buida als nodes de repartiment
 * i ESTRUCTURA porta l’objectiu destí (la «LN00000 Directe» desapareix).
 */
export function aplicarGestioRepartimentLn(
  _concepts: ConcepteOrdre[],
  rows: ConceptePivot[],
  deltaByNode: Map<number, number>,
  opts?: { substituirDirecteCentral?: boolean }
): ConceptePivot[] {
  const extended = rows.map((r) => ({
    ...r,
    valors: [...r.valors, 0],
  }));
  if (extended.length === 0) return extended;
  const byNode = new Map(extended.map((r) => [r.node, r]));
  const firstRow = extended[0];
  if (!firstRow) return extended;
  const colRepart = firstRow.valors.length - 1;
  const nCentres = colRepart;

  for (const [node, delta] of deltaByNode) {
    if (opts?.substituirDirecteCentral) {
      const detalls = nodesPresentacioGestio(node);
      const basesCentres = detalls.map((d) => {
        const row = byNode.get(d);
        if (!row) return 0;
        let s = 0;
        for (let c = 0; c < nCentres; c++) s += row.valors[c] ?? 0;
        return s;
      });
      const baseSum = basesCentres.reduce((a, b) => a + b, 0);
      const objectiu = baseSum + delta;
      const fracs = fraccionsRepartimentDetall(basesCentres);
      for (let i = 0; i < detalls.length; i++) {
        const detall = detalls[i];
        if (detall == null) continue;
        const row = byNode.get(detall);
        if (!row) continue;
        for (let c = 0; c < nCentres; c++) row.valors[c] = 0;
        row.valors[colRepart] = objectiu * (fracs[i] ?? 0);
      }
    } else {
      aplicarDeltaPresentacioGestio(byNode, node, colRepart, delta, {
        pesosDesDaltresColumnes: true,
      });
    }
  }

  for (const row of extended) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }

  return recalcularSubtotalsCompte(conceptsFromRows(extended), extended);
}

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
 * Compres / Personal / Gestió: Traspassos i Gestió comparteixen el mateix total;
 * només canvia el pes per LN (redistribució de LN00000).
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
  return carregarDeltasGestioAgregatsCached(any, rang.des, rang.fins);
}

const carregarDeltasGestioAgregatsCached = cache(async (any: number, des: number, fins: number) => {
  const { db } = await import("@/lib/db");
  const { getDeltasGestioPerLn } = await import("@/lib/repartiment/service");
  const periods = await db.period.findMany({
    where: prismaPeriodFilter(any, { des, fins }),
    select: { id: true },
  });
  const deltasPerPeriode = await getDeltasGestioPerLn(periods.map((p) => p.id));
  return agregarDeltasPerLn(deltasPerPeriode);
});

/** Periodes + deltas d'un any (evolució mensual). Cache per petició. */
const carregarDeltasEvolucioAny = cache(async (any: number) => {
  const { db } = await import("@/lib/db");
  const { getDeltasGestioPerLn } = await import("@/lib/repartiment/service");
  const periods = await db.period.findMany({
    where: { any },
    select: { id: true, mes: true },
  });
  if (!periods.length) {
    return {
      mesByPeriodId: new Map<string, number>(),
      deltasPerPeriode: new Map<string, Map<string, Map<number, number>>>(),
    };
  }
  const deltasPerPeriode = await getDeltasGestioPerLn(periods.map((p) => p.id));
  return {
    mesByPeriodId: new Map(periods.map((p) => [p.id, p.mes])),
    deltasPerPeriode,
  };
});

/** Aplica repartiment confirmat a l'evolució mensual (12 columnes) d'una LN. */
export async function aplicarGestioEvolucioLn(
  liniaNegociId: string,
  any: number,
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  const { mesByPeriodId, deltasPerPeriode } = await carregarDeltasEvolucioAny(any);
  if (!mesByPeriodId.size) return rows;

  const centralId = await getCentralLnId();
  const esCentralGestio = centralId != null && liniaNegociId === centralId;

  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(merged.map((r) => [r.node, r]));

  for (const [periodId, perLn] of deltasPerPeriode) {
    const mesIdx = (mesByPeriodId.get(periodId) ?? 1) - 1;
    if (mesIdx < 0 || mesIdx > 11) continue;
    const nodes = perLn.get(liniaNegociId);
    if (!nodes) continue;
    for (const [node, delta] of nodes) {
      aplicarDeltaPresentacioGestio(byNode, node, mesIdx, delta, {
        substituirObjectiu: esCentralGestio,
      });
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
  const { mesByPeriodId, deltasPerPeriode } = await carregarDeltasEvolucioAny(any);
  if (!mesByPeriodId.size) return rows;

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
      if (Math.abs(delta) < 0.01) continue;
      aplicarDeltaPresentacioGestio(byNode, node, mesIdx, delta);
    }
  }

  for (const row of merged) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }
  return recalcularSubtotalsCompte(conceptsFromRows(merged), merged);
}

/**
 * Fase Compres i gestió: Directe + deltas 11/30 (sense personal SC / traspass).
 */
export async function aplicarVistaGestioEvolucioEmpresa(
  any: number,
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  return aplicarGestioEvolucioEmpresa(any, rows);
}

export async function aplicarVistaGestioEvolucioLn(
  liniaNegociId: string,
  any: number,
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  return aplicarGestioEvolucioLn(liniaNegociId, any, rows);
}

import type { ConceptePivot } from "@/lib/consultes";
import { NODES_PERSONAL_DETALL } from "@/lib/cost-personal-centre/nodes";

export type ConcepteOrdre = { node: number; esSubtotal: boolean; ordre?: number };

/** Subtotals que sumen altres subtotals (no només detall des de l'anterior). */
const SUBTOTAL_COMPOSIT: Record<number, readonly number[]> = {
  12: [6, 11],
  31: [17, 30],
  32: [12, 31],
  35: [33, 34],
  38: [36, 37],
  40: [32, 35, 38, 39],
  42: [40, 41],
};

/**
 * Subtotals que sumen detalls per node (no per ordre de fila).
 * Necessari quan el node SAP (p.ex. 44 ETT) té ordre > subtotal 17 a la BD.
 */
const SUBTOTAL_DETALL_EXPLICIT: Record<number, readonly number[]> = {
  17: NODES_PERSONAL_DETALL,
};

const COMPOSIT_ORDER = [12, 31, 32, 35, 38, 40, 42] as const;

/**
 * Línies SAP sense "." al nom però que són detall (no subtotal).
 * MOVIMENTS INTERNS entra dins TOTAL DESPESES GESTIÓ, no és un total propi.
 */
const NODES_DETALL_FORCAT = new Set([29]);

/** Per a la UI: files en negreta (subtotals). MOVIMENTS INTERNS (29) és detall. */
export function esSubtotalPresentacio(node: number, esSubtotalDb: boolean): boolean {
  return esSubtotalDb && !NODES_DETALL_FORCAT.has(node);
}

function esDetall(c: ConcepteOrdre): boolean {
  return !esSubtotalPresentacio(c.node, c.esSubtotal);
}

function esSubtotalCalculat(c: ConcepteOrdre): boolean {
  return esSubtotalPresentacio(c.node, c.esSubtotal);
}

function sortedConceptes(concepts: ConcepteOrdre[]): ConcepteOrdre[] {
  return [...concepts].sort((a, b) => (a.ordre ?? a.node) - (b.ordre ?? b.node));
}

/**
 * Recalcula els subtotals del compte a partir de les línies de detall.
 * Els valors importats de subtotals (Excel) es substitueixen per la suma real.
 */
export function recalcularSubtotalsCompte(
  concepts: ConcepteOrdre[],
  rows: ConceptePivot[]
): ConceptePivot[] {
  const result = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(result.map((r) => [r.node, r]));
  const sorted = sortedConceptes(concepts);
  const compositeNodes = new Set(Object.keys(SUBTOTAL_COMPOSIT).map(Number));
  const nCols = result[0]?.valors.length ?? 0;

  let lastSubIdx = -1;
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    if (!esSubtotalCalculat(c) || compositeNodes.has(c.node)) continue;

    const row = byNode.get(c.node);
    if (!row) continue;

    const detallExplicit = SUBTOTAL_DETALL_EXPLICIT[c.node];
    if (detallExplicit) {
      for (let col = 0; col < nCols; col++) {
        row.valors[col] = detallExplicit.reduce((s, n) => s + (byNode.get(n)?.valors[col] ?? 0), 0);
      }
      row.total = row.valors.reduce((a, b) => a + b, 0);
      lastSubIdx = i;
      continue;
    }

    for (let col = 0; col < nCols; col++) {
      let sum = 0;
      for (let j = lastSubIdx + 1; j < i; j++) {
        const prev = sorted[j];
        if (!esDetall(prev)) continue;
        sum += byNode.get(prev.node)?.valors[col] ?? 0;
      }
      row.valors[col] = sum;
    }
    row.total = row.valors.reduce((a, b) => a + b, 0);
    lastSubIdx = i;
  }

  for (const node of COMPOSIT_ORDER) {
    const deps = SUBTOTAL_COMPOSIT[node];
    const row = byNode.get(node);
    if (!row || !deps) continue;

    for (let col = 0; col < nCols; col++) {
      row.valors[col] = deps.reduce((s, n) => s + (byNode.get(n)?.valors[col] ?? 0), 0);
    }
    row.total = deps.reduce((s, n) => s + (byNode.get(n)?.total ?? 0), 0);
  }

  return result;
}

/** Recalcula només subtotals composits (12, 31, 32…) sense sobreescriure línies amb repartiment. */
export function recalcularCompositesOnly(rows: ConceptePivot[]): ConceptePivot[] {
  const result = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(result.map((r) => [r.node, r]));
  const nCols = result[0]?.valors.length ?? 0;

  for (const node of COMPOSIT_ORDER) {
    const deps = SUBTOTAL_COMPOSIT[node];
    const row = byNode.get(node);
    if (!row || !deps) continue;

    for (let col = 0; col < nCols; col++) {
      row.valors[col] = deps.reduce((s, n) => s + (byNode.get(n)?.valors[col] ?? 0), 0);
    }
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }

  return result;
}

export interface DetallImportItem {
  node: number;
  esSubtotal: boolean;
  dimKey: string;
  import_: number;
}

/** Recalcula subtotals per a cada centre/LN d'una importació (vista de detall). */
export function recalcularSubtotalsDetallImport<T extends DetallImportItem>(
  concepts: ConcepteOrdre[],
  items: T[]
): T[] {
  const sorted = sortedConceptes(concepts);
  const byDim = new Map<string, T[]>();

  for (const item of items) {
    const list = byDim.get(item.dimKey) ?? [];
    list.push(item);
    byDim.set(item.dimKey, list);
  }

  const recalcByDimNode = new Map<string, number>();

  for (const [, group] of byDim) {
    const valorsPerNode = new Map<number, number>();
    for (const item of group) {
      const concepte = sorted.find((c) => c.node === item.node);
      if (concepte && esDetall(concepte)) valorsPerNode.set(item.node, item.import_);
    }

    const pivot: ConceptePivot[] = sorted.map((c) => ({
      node: c.node,
      descripcio: "",
      esSubtotal: c.esSubtotal,
      valors: [valorsPerNode.get(c.node) ?? 0],
      total: valorsPerNode.get(c.node) ?? 0,
    }));

    const recalc = recalcularSubtotalsCompte(sorted, pivot);
    for (const row of recalc) {
      const concepte = sorted.find((c) => c.node === row.node);
      if (concepte && esSubtotalCalculat(concepte)) {
        recalcByDimNode.set(`${group[0]!.dimKey}:${row.node}`, row.valors[0] ?? 0);
      }
    }
  }

  return items.map((item) => {
    const concepte = sorted.find((c) => c.node === item.node);
    if (!concepte || !esSubtotalCalculat(concepte)) return item;
    const nou = recalcByDimNode.get(`${item.dimKey}:${item.node}`);
    return nou !== undefined ? { ...item, import_: nou } : item;
  });
}

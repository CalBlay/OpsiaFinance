import { recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import type { ConceptePivot } from "@/lib/consultes";
import type { FontImportConsolidacio, NormaConsolidacio } from "@prisma/client";

export type NormaConsolidacioMin = Pick<
  NormaConsolidacio,
  | "tipus"
  | "actiu"
  | "nodeExcloure"
  | "nodesAjust"
  | "grupEmpresaOrigen"
  | "nodeOrigen"
  | "grupEmpresaDesti"
  | "nodeDesti"
  | "nodesOrigen"
  | "nodesDesti"
  | "fontImport"
> & {
  id?: string;
  /** mes (1–12) → import absolut a eliminar (IMPORT_FIX_MENSUAL). */
  importsMensuals?: Map<number, number>;
};

export type ConsolidacioPeriode = {
  any: number;
  desMes: number;
  finsMes: number;
};

function sumValors(valors: number[]): number {
  return valors.reduce((a, b) => a + b, 0);
}

function byNode(rows: ConceptePivot[], node: number): ConceptePivot | undefined {
  return rows.find((r) => r.node === node);
}

function nodesCara(
  singles: number | null | undefined,
  multi: number[] | null | undefined
): number[] {
  if (multi && multi.length > 0) return multi;
  if (singles != null) return [singles];
  return [];
}

function aplicarExcloureNodeColumnesLn(
  rows: ConceptePivot[],
  nodeExcloure: number,
  nodesAjust: number[]
): void {
  aplicarExcloureNodeTemporal(rows, nodeExcloure, nodesAjust);
}

function aplicarExcloureNodeTemporal(
  rows: ConceptePivot[],
  nodeExcloure: number,
  nodesAjust: number[]
): void {
  const excl = byNode(rows, nodeExcloure);
  const nCols = rows[0]?.valors.length ?? 0;

  for (let i = 0; i < nCols; i++) {
    const delta = excl?.valors[i] ?? 0;
    if (excl) excl.valors[i] = 0;
    for (const node of nodesAjust) {
      const r = byNode(rows, node);
      if (r) r.valors[i] -= delta;
    }
  }

  for (const r of rows) {
    if (r.node === nodeExcloure) {
      r.total = 0;
    } else {
      r.total = sumValors(r.valors);
    }
  }
}

/**
 * Aplica normes actives sobre una matriu de conceptes.
 * `parellsInterEmpresa` és obligatori per a ELIMINAR_PARELL_INTER
 * (matrius separades Cal Blay / FDLC, mateixa forma de columnes o agregades).
 */
export function aplicarNormesConsolidacio(
  concepts: ConceptePivot[],
  normes: NormaConsolidacioMin[],
  mode: "columnes-ln" | "temporal",
  parellsInterEmpresa?: Map<string, ConceptePivot[]>,
  periode?: ConsolidacioPeriode
): ConceptePivot[] {
  const rows = concepts.map((r) => ({ ...r, valors: [...r.valors] }));
  const actives = normes.filter((n) => n.actiu);
  let hiHaParellInter = false;

  for (const norma of actives) {
    if (norma.tipus === "EXCLURE_NODE" && norma.nodeExcloure != null) {
      const ajust = norma.nodesAjust ?? [];
      if (mode === "columnes-ln") {
        aplicarExcloureNodeColumnesLn(rows, norma.nodeExcloure, ajust);
      } else {
        aplicarExcloureNodeTemporal(rows, norma.nodeExcloure, ajust);
      }
      continue;
    }

    if (norma.tipus === "ELIMINAR_PARELL_INTER" && parellsInterEmpresa) {
      aplicarEliminarParellInter(rows, norma, mode, parellsInterEmpresa, periode);
      hiHaParellInter = true;
    }
  }

  if (!hiHaParellInter) return rows;

  return recalcularSubtotalsCompte(
    rows.map((r) => ({ node: r.node, esSubtotal: r.esSubtotal })),
    rows
  );
}

function fontImportOf(norma: NormaConsolidacioMin): FontImportConsolidacio {
  return norma.fontImport ?? "MIN_COINCIDENT";
}

/**
 * Elimina el parell inter-empresa.
 * - MIN_COINCIDENT: min(|A|,|B|) de cel·les.
 * - IMPORT_FIX_MENSUAL: import de la taula (capat per |A| i |B|).
 */
function aplicarEliminarParellInter(
  rows: ConceptePivot[],
  norma: NormaConsolidacioMin,
  mode: "columnes-ln" | "temporal",
  parells: Map<string, ConceptePivot[]>,
  periode?: ConsolidacioPeriode
): void {
  const origKey = norma.grupEmpresaOrigen;
  const destKey = norma.grupEmpresaDesti;
  const nodesA = nodesCara(norma.nodeOrigen, norma.nodesOrigen);
  const nodesB = nodesCara(norma.nodeDesti, norma.nodesDesti);
  if (!origKey || !destKey || nodesA.length === 0 || nodesB.length === 0) return;

  const rowsA = parells.get(origKey);
  const rowsB = parells.get(destKey);
  if (!rowsA || !rowsB) return;

  const nCols = rows[0]?.valors.length ?? 0;
  const sameShape =
    (rowsA[0]?.valors.length ?? 0) === nCols && (rowsB[0]?.valors.length ?? 0) === nCols;

  if (fontImportOf(norma) === "IMPORT_FIX_MENSUAL") {
    aplicarParellImportFix(
      rows,
      rowsA,
      rowsB,
      nodesA,
      nodesB,
      mode,
      sameShape,
      nCols,
      norma,
      periode
    );
    return;
  }

  // Un sol node per cara (comportament històric del lloguer).
  const nodeA0 = nodesA[0];
  const nodeB0 = nodesB[0];
  if (nodesA.length === 1 && nodesB.length === 1 && nodeA0 != null && nodeB0 != null) {
    aplicarParellMinCoincident(rows, rowsA, rowsB, nodeA0, nodeB0, mode, sameShape, nCols);
    return;
  }

  // Multi-node amb min coincident: suma cares i reparteix.
  aplicarParellMinCoincidentMulti(rows, rowsA, rowsB, nodesA, nodesB, mode, sameShape, nCols);
}

function aplicarParellMinCoincident(
  rows: ConceptePivot[],
  rowsA: ConceptePivot[],
  rowsB: ConceptePivot[],
  nodeA: number,
  nodeB: number,
  mode: "columnes-ln" | "temporal",
  sameShape: boolean,
  nCols: number
): void {
  const a = rowsA.find((r) => r.node === nodeA);
  const b = rowsB.find((r) => r.node === nodeB);
  if (!a || !b) return;

  const targetA = byNode(rows, nodeA);
  const targetB = byNode(rows, nodeB);
  if (!targetA || !targetB) return;

  if (mode === "temporal" && sameShape) {
    for (let i = 0; i < nCols; i++) {
      const va = a.valors[i] ?? 0;
      const vb = b.valors[i] ?? 0;
      const elim = Math.min(Math.abs(va), Math.abs(vb));
      if (elim === 0) continue;
      targetA.valors[i] = (targetA.valors[i] ?? 0) - (va >= 0 ? elim : -elim);
      targetB.valors[i] = (targetB.valors[i] ?? 0) - (vb >= 0 ? elim : -elim);
    }
  } else {
    const totA = sumValors(a.valors);
    const totB = sumValors(b.valors);
    const elim = Math.min(Math.abs(totA), Math.abs(totB));
    if (elim === 0) return;
    aplicarElimDistribuida(targetA, a.valors, nCols, elim, totA >= 0 ? 1 : -1);
    aplicarElimDistribuida(targetB, b.valors, nCols, elim, totB >= 0 ? 1 : -1);
  }

  targetA.total = sumValors(targetA.valors);
  targetB.total = sumValors(targetB.valors);
}

function valorCaraCol(cara: ConceptePivot[], nodes: number[], col: number): number {
  let s = 0;
  for (const n of nodes) {
    const r = cara.find((x) => x.node === n);
    s += r?.valors[col] ?? 0;
  }
  return s;
}

function valorCaraTotal(cara: ConceptePivot[], nodes: number[]): number {
  let s = 0;
  for (const n of nodes) {
    const r = cara.find((x) => x.node === n);
    if (r) s += sumValors(r.valors);
  }
  return s;
}

function aplicarParellMinCoincidentMulti(
  rows: ConceptePivot[],
  rowsA: ConceptePivot[],
  rowsB: ConceptePivot[],
  nodesA: number[],
  nodesB: number[],
  mode: "columnes-ln" | "temporal",
  sameShape: boolean,
  nCols: number
): void {
  if (mode === "temporal" && sameShape) {
    for (let i = 0; i < nCols; i++) {
      const va = valorCaraCol(rowsA, nodesA, i);
      const vb = valorCaraCol(rowsB, nodesB, i);
      const elim = Math.min(Math.abs(va), Math.abs(vb));
      if (elim === 0) continue;
      repartirElimEntreNodes(rows, rowsA, nodesA, i, elim, va >= 0 ? 1 : -1);
      repartirElimEntreNodes(rows, rowsB, nodesB, i, elim, vb >= 0 ? 1 : -1);
    }
  } else {
    const totA = valorCaraTotal(rowsA, nodesA);
    const totB = valorCaraTotal(rowsB, nodesB);
    const elim = Math.min(Math.abs(totA), Math.abs(totB));
    if (elim === 0) return;
    repartirElimTotalEntreNodes(rows, rowsA, nodesA, nCols, elim, totA >= 0 ? 1 : -1);
    repartirElimTotalEntreNodes(rows, rowsB, nodesB, nCols, elim, totB >= 0 ? 1 : -1);
  }

  for (const n of [...nodesA, ...nodesB]) {
    const t = byNode(rows, n);
    if (t) t.total = sumValors(t.valors);
  }
}

function aplicarParellImportFix(
  rows: ConceptePivot[],
  rowsA: ConceptePivot[],
  rowsB: ConceptePivot[],
  nodesA: number[],
  nodesB: number[],
  mode: "columnes-ln" | "temporal",
  sameShape: boolean,
  nCols: number,
  norma: NormaConsolidacioMin,
  periode?: ConsolidacioPeriode
): void {
  const imports = norma.importsMensuals ?? new Map<number, number>();
  const des = periode?.desMes ?? 1;
  const fins = periode?.finsMes ?? 12;

  if (mode === "temporal" && sameShape && nCols === 12) {
    for (let i = 0; i < 12; i++) {
      const mes = i + 1;
      if (mes < des || mes > fins) continue;
      const factura = Math.abs(imports.get(mes) ?? 0);
      if (factura < 1e-9) continue;
      const va = valorCaraCol(rowsA, nodesA, i);
      const vb = valorCaraCol(rowsB, nodesB, i);
      const elim = Math.min(factura, Math.abs(va), Math.abs(vb));
      if (elim < 1e-9) continue;
      repartirElimEntreNodes(rows, rowsA, nodesA, i, elim, va >= 0 ? 1 : -1);
      repartirElimEntreNodes(rows, rowsB, nodesB, i, elim, vb >= 0 ? 1 : -1);
    }
  } else {
    let factura = 0;
    for (let mes = des; mes <= fins; mes++) {
      factura += Math.abs(imports.get(mes) ?? 0);
    }
    factura = Math.round(factura * 100) / 100;
    if (factura < 1e-9) return;

    const totA = valorCaraTotal(rowsA, nodesA);
    const totB = valorCaraTotal(rowsB, nodesB);
    const elim = Math.min(factura, Math.abs(totA), Math.abs(totB));
    if (elim < 1e-9) return;
    repartirElimTotalEntreNodes(rows, rowsA, nodesA, nCols, elim, totA >= 0 ? 1 : -1);
    repartirElimTotalEntreNodes(rows, rowsB, nodesB, nCols, elim, totB >= 0 ? 1 : -1);
  }

  for (const n of [...new Set([...nodesA, ...nodesB])]) {
    const t = byNode(rows, n);
    if (t) t.total = sumValors(t.valors);
  }
}

/** Resta `sign * elim` d'una columna, repartit entre nodes segons |pesos| de la cara. */
function repartirElimEntreNodes(
  consolidat: ConceptePivot[],
  cara: ConceptePivot[],
  nodes: number[],
  col: number,
  elim: number,
  sign: number
): void {
  const pesos = nodes.map((n) => {
    const r = cara.find((x) => x.node === n);
    return Math.abs(r?.valors[col] ?? 0);
  });
  const absSum = pesos.reduce((a, b) => a + b, 0);
  let left = elim;

  for (let j = 0; j < nodes.length; j++) {
    const node = nodes[j];
    if (node == null) continue;
    const target = byNode(consolidat, node);
    if (!target) continue;
    const pes = pesos[j] ?? 0;
    const portion =
      absSum < 1e-9
        ? j === 0
          ? elim
          : 0
        : j === nodes.length - 1
          ? left
          : Math.round((pes / absSum) * elim * 100) / 100;
    left = Math.round((left - portion) * 100) / 100;
    target.valors[col] = (target.valors[col] ?? 0) - sign * portion;
  }
}

/** Resta `sign * elim` del total, repartit per columnes i nodes. */
function repartirElimTotalEntreNodes(
  consolidat: ConceptePivot[],
  cara: ConceptePivot[],
  nodes: number[],
  nCols: number,
  elim: number,
  sign: number
): void {
  // Pes per columna = suma |nodes| a aquella columna a la cara.
  const pesosCol = Array.from({ length: nCols }, (_, i) => Math.abs(valorCaraCol(cara, nodes, i)));
  const absSum = pesosCol.reduce((a, b) => a + b, 0);
  let left = elim;

  for (let i = 0; i < nCols; i++) {
    const pesCol = pesosCol[i] ?? 0;
    const portion =
      absSum < 1e-9
        ? i === 0
          ? elim
          : 0
        : i === nCols - 1
          ? left
          : Math.round((pesCol / absSum) * elim * 100) / 100;
    left = Math.round((left - portion) * 100) / 100;
    if (portion < 1e-9) continue;
    repartirElimEntreNodes(consolidat, cara, nodes, i, portion, sign);
  }
}

/** Resta `sign * elim` de `target`, repartit segons |pesos| (cara de l'empresa). */
function aplicarElimDistribuida(
  target: ConceptePivot,
  pesos: number[],
  nCols: number,
  elim: number,
  sign: number
): void {
  const w = pesos.length === nCols ? pesos : target.valors.map((v, i) => (i < nCols ? v : 0));
  const absSum = w.reduce((s, v) => s + Math.abs(v), 0);

  if (absSum < 1e-9) {
    if (nCols > 0) {
      target.valors[0] = (target.valors[0] ?? 0) - sign * elim;
    }
    return;
  }

  let left = elim;
  for (let i = 0; i < nCols; i++) {
    const portion =
      i === nCols - 1 ? left : Math.round((Math.abs(w[i] ?? 0) / absSum) * elim * 100) / 100;
    left = Math.round((left - portion) * 100) / 100;
    target.valors[i] = (target.valors[i] ?? 0) - sign * portion;
  }
}

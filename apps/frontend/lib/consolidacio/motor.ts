import type { ConceptePivot } from "@/lib/consultes";
import type { NormaConsolidacio } from "@prisma/client";

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
>;

function sumValors(valors: number[]): number {
  return valors.reduce((a, b) => a + b, 0);
}

function byNode(rows: ConceptePivot[], node: number): ConceptePivot | undefined {
  return rows.find((r) => r.node === node);
}

function aplicarExcloureNodeColumnesLn(
  rows: ConceptePivot[],
  nodeExcloure: number,
  nodesAjust: number[]
): void {
  // Mateixa lògica per columna que el mode temporal (columnes = LN o mesos).
  // Així sum(valors) === total i Empresa / Evolució coincideixen.
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
 * `parellsInterEmpresa` és per a ELIMINAR_PARELL_INTER (consulta consolidat futura).
 */
export function aplicarNormesConsolidacio(
  concepts: ConceptePivot[],
  normes: NormaConsolidacioMin[],
  mode: "columnes-ln" | "temporal",
  parellsInterEmpresa?: Map<string, ConceptePivot[]>
): ConceptePivot[] {
  const rows = concepts.map((r) => ({ ...r, valors: [...r.valors] }));
  const actives = normes.filter((n) => n.actiu);

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
      aplicarEliminarParellInter(rows, norma, mode, parellsInterEmpresa);
    }
  }

  return rows;
}

function aplicarEliminarParellInter(
  rows: ConceptePivot[],
  norma: NormaConsolidacioMin,
  mode: "columnes-ln" | "temporal",
  parells: Map<string, ConceptePivot[]>
): void {
  const origKey = norma.grupEmpresaOrigen;
  const destKey = norma.grupEmpresaDesti;
  const nodeA = norma.nodeOrigen;
  const nodeB = norma.nodeDesti;
  if (!origKey || !destKey || nodeA == null || nodeB == null) return;

  const rowsA = parells.get(origKey);
  const rowsB = parells.get(destKey);
  if (!rowsA || !rowsB) return;

  const a = rowsA.find((r) => r.node === nodeA);
  const b = rowsB.find((r) => r.node === nodeB);
  if (!a || !b) return;

  const targetA = byNode(rows, nodeA);
  const targetB = byNode(rows, nodeB);
  if (!targetA || !targetB) return;

  if (mode === "columnes-ln") {
    const nCols = rows[0]?.valors.length ?? 0;
    for (let i = 0; i < nCols; i++) {
      const va = targetA.valors[i] ?? 0;
      const vb = targetB.valors[i] ?? 0;
      const elim = Math.min(Math.abs(va), Math.abs(vb));
      if (elim === 0) continue;
      targetA.valors[i] -= va >= 0 ? elim : -elim;
      targetB.valors[i] -= vb >= 0 ? elim : -elim;
    }
    targetA.total = sumValors(targetA.valors);
    targetB.total = sumValors(targetB.valors);
  } else {
    const nCols = rows[0]?.valors.length ?? 0;
    for (let i = 0; i < nCols; i++) {
      const va = targetA.valors[i] ?? 0;
      const vb = targetB.valors[i] ?? 0;
      const elim = Math.min(Math.abs(va), Math.abs(vb));
      if (elim === 0) continue;
      targetA.valors[i] -= va >= 0 ? elim : -elim;
      targetB.valors[i] -= vb >= 0 ? elim : -elim;
    }
    targetA.total = sumValors(targetA.valors);
    targetB.total = sumValors(targetB.valors);
  }
}

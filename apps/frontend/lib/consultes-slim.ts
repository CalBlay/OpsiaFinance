import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_INGRESSOS,
  NODE_VENDES,
} from "@/lib/kpi-definitions";

/** Nodes necessaris per KPIs i gràfics del primer paint (sense el compte sencer). */
const NODES_PRIMER_PAINT = new Set([
  NODE_VENDES,
  NODE_INGRESSOS,
  NODE_COMPRES,
  NODE_COST_SALARIAL,
  NODE_COST_GESTIO,
  NODE_EBITDA,
]);

/** Redueix el payload RSC: només files usades a KPIs/gràfics. */
export function slimConceptsForPaint<T extends { node: number }>(concepts: T[]): T[] {
  return concepts.filter((c) => NODES_PRIMER_PAINT.has(c.node));
}

/** Empresa: el pivot multi-LN no cal al primer paint (KPIs/comitè ja venen calculats). */
export function sensePivotRows<T extends { pivotRows: unknown[] }>(data: T): T {
  return { ...data, pivotRows: [] };
}

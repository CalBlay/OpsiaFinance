import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_INGRESSOS,
  NODE_VENDES,
} from "@/lib/kpi-definitions";
import {
  NODES_DETALL_FORA_EBITDA,
  type NaturaByNodeRecord,
  esNodeForaEbitdaPe,
} from "@/lib/punt-equilibri";

/** Nodes necessaris per KPIs i gràfics del primer paint (sense el compte sencer). */
const NODES_PRIMER_PAINT = new Set([
  NODE_VENDES,
  NODE_INGRESSOS,
  NODE_COMPRES,
  NODE_COST_SALARIAL,
  NODE_COST_GESTIO,
  NODE_EBITDA,
]);

function esFullaPe(
  node: number,
  esSubtotal: boolean | undefined,
  naturaByNode: NaturaByNodeRecord
): boolean {
  if (esSubtotal) return false;
  if (esNodeForaEbitdaPe(node)) return false;
  // Compat: el Set antic també (per si s'amplia).
  if (NODES_DETALL_FORA_EBITDA.has(node)) return false;
  const meta = naturaByNode[String(node)];
  if (meta?.natura === "INGRES") return false;
  return true;
}

/**
 * Redueix el payload RSC: només files usades a KPIs/gràfics.
 * Amb `naturaByNode`, també conserva les fulles de cost necessàries pel punt d'equilibri.
 */
export function slimConceptsForPaint<T extends { node: number; esSubtotal?: boolean }>(
  concepts: T[],
  naturaByNode?: NaturaByNodeRecord
): T[] {
  if (!naturaByNode) {
    return concepts.filter((c) => NODES_PRIMER_PAINT.has(c.node));
  }
  return concepts.filter(
    (c) => NODES_PRIMER_PAINT.has(c.node) || esFullaPe(c.node, c.esSubtotal, naturaByNode)
  );
}

/** Empresa: el pivot multi-LN no cal al primer paint (KPIs/comitè ja venen calculats). */
export function sensePivotRows<T extends { pivotRows: unknown[] }>(data: T): T {
  return { ...data, pivotRows: [] };
}

/** Nodes SAP del compte de resultats (repartiment). */
export const NODE_VENDES = 2;
export const NODE_INGRESSOS = 6;
/** Detall: línia COMPRES (abans del subtotal TOTAL COMPRES). */
export const NODE_COMPRES_DETALL = 7;
export const NODE_ALTRES_APROVISIONAMENTS = 8;
export const NODE_COMPRES = 11;
export const NODE_SOUS_SALARIS = 13;
export const NODE_COST_SALARIAL = 17;
/** Detall on es mostren les imputacions de gestió (reclassificacions). */
export const NODE_MOVIMENTS_INTERNS = 29;
export const NODE_COST_GESTIO = 30;
export const NODE_EBITDA = 32;

export const CODI_LN_CENTRAL = "LN00000";

/**
 * Els deltas de repartiment es calculen sobre els totals (11/17/30),
 * però a la vista Gestió es mostren a la línia de detall perquè el compte
 * quadri (detall → subtotal) i el drill-down els faci visibles.
 */
export const NODE_REPARTIMENT_A_DETALL: Readonly<Record<number, number>> = {
  [NODE_COMPRES]: NODE_COMPRES_DETALL,
  [NODE_COST_SALARIAL]: NODE_SOUS_SALARIS,
  [NODE_COST_GESTIO]: NODE_MOVIMENTS_INTERNS,
};

/** Node de detall on es presenta un delta calculat sobre un total. */
export function nodePresentacioGestio(node: number): number {
  return NODE_REPARTIMENT_A_DETALL[node] ?? node;
}

/** Total de repartiment del qual aquest detall hereta el delta (si n'hi ha). */
export function nodeTotalDesDeDetall(nodeDetall: number): number | null {
  for (const [total, detall] of Object.entries(NODE_REPARTIMENT_A_DETALL)) {
    if (Number(detall) === nodeDetall) return Number(total);
  }
  return null;
}

export const CONCEPTE_NODE_LABEL: Record<number, string> = {
  [NODE_VENDES]: "VENDES",
  [NODE_INGRESSOS]: "TOTAL INGRESSOS EXPLOTACIO",
  [NODE_COMPRES]: "TOTAL COMPRES",
  [NODE_SOUS_SALARIS]: "SOUS I SALARIS",
  [NODE_COST_SALARIAL]: "TOTAL COST SALARIAL",
  [NODE_COST_GESTIO]: "TOTAL DESPESES GESTIO",
  [NODE_EBITDA]: "EBITDA",
};

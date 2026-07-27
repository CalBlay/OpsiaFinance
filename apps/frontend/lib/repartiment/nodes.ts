/** Nodes SAP del compte de resultats (repartiment). */
export const NODE_VENDES = 2;
export const NODE_INGRESSOS = 6;
/** Detall: línia COMPRES (abans del subtotal TOTAL COMPRES). */
export const NODE_COMPRES_DETALL = 7;
export const NODE_ALTRES_APROVISIONAMENTS = 8;
export const NODE_COMPRES = 11;
export const NODE_COST_SALARIAL = 17;
export const NODE_COST_GESTIO = 30;
export const NODE_EBITDA = 32;

export const CODI_LN_CENTRAL = "LN00000";

export const CONCEPTE_NODE_LABEL: Record<number, string> = {
  [NODE_VENDES]: "VENDES",
  [NODE_INGRESSOS]: "TOTAL INGRESSOS EXPLOTACIO",
  [NODE_COMPRES]: "TOTAL COMPRES",
  [NODE_COST_SALARIAL]: "TOTAL COST SALARIAL",
  [NODE_COST_GESTIO]: "TOTAL DESPESES GESTIO",
  [NODE_EBITDA]: "EBITDA",
};

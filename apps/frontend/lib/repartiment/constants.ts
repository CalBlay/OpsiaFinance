import { NODE_COMPRES, NODE_COST_GESTIO, NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";

/**
 * Repartiment a la vista Gestió — reconstrucció node a node.
 * Els % i imports surten sempre de Configuració → Repartiment (columna Valor).
 */
export const REPARTIMENT_APLICAT_A_GESTIO = true;

/**
 * Nodes actius a consultes Gestió.
 * Compres, Personal SC i despeses de gestió.
 */
export const NODES_REPARTIMENT_GESTIO_ACTIUS: readonly number[] = [
  NODE_COMPRES,
  NODE_COST_SALARIAL,
  NODE_COST_GESTIO,
];

/** Referència de tots els nodes de repartiment previstos. */
export const NODES_REPARTIMENT_GESTIO_PREVISTOS: readonly number[] = [
  NODE_COMPRES,
  NODE_COST_SALARIAL,
  NODE_COST_GESTIO,
];

/** Identificador sintètic de la columna ESTRUCTURA a consultes Gestió. */
export const COL_REPARTIMENT_ID = "__repartiment__";

/** Etiqueta de columna / detall a consultes Gestió (abans «Repart.»). */
export const COL_REPARTIMENT_CODI = "ESTRUCTURA";
export const COL_REPARTIMENT_NOM = "ESTRUCTURA";
export const COL_REPARTIMENT_LABEL_DETALL = "ESTRUCTURA";

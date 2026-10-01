import {
  NODES_GESTIO_DETALL,
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
} from "@/lib/repartiment/nodes";

/**
 * Repartiment a la vista Gestió — reconstrucció node a node.
 * Els % i imports surten sempre de Configuració → Repartiment (columna Valor).
 */
export const REPARTIMENT_APLICAT_A_GESTIO = true;

/**
 * Canvis de lògica al codi (exclusions de centres/depts, fórmules del motor)
 * que no toquen normes ni config a BD. Si `calculatAt` d'una execució és anterior,
 * a Dades → Repartiment surt «Aplicar regles noves».
 *
 * Cal actualitzar aquesta data cada vegada que es canviï el motor sense desar config.
 */
export const REPARTIMENT_CODI_UPDATED_AT = new Date("2026-10-01T15:45:00.000Z");

/**
 * Nodes actius a consultes Gestió.
 * Compres, Personal SC i despeses de gestió.
 */
export const NODES_REPARTIMENT_GESTIO_ACTIUS: readonly number[] = [
  NODE_COMPRES,
  NODE_COST_SALARIAL,
  NODE_COST_GESTIO,
  ...NODES_GESTIO_DETALL,
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

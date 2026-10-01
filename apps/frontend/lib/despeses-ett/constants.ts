import { NODE_CONTRACTES_ETT } from "@/lib/cost-personal-centre/nodes";

/** Motiu estable dels ajustos generats per la importació ETT (reimportació idempotent). */
export const MOTIU_ETT = "ETT";

/** Node 26 — ALTRES DESPESES (on cau el 629006 a SAP). */
export const NODE_ALTRES_DESPESES = 26;

export { NODE_CONTRACTES_ETT };

export const NODES_AJUST_ETT = [NODE_CONTRACTES_ETT, NODE_ALTRES_DESPESES] as const;

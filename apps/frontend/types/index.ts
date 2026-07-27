/*
 * Tipus compartits del frontend.
 * Cada mòdul pot tenir els seus propis tipus locals;
 * aquí viuen els transversals a tota l'aplicació.
 */

export type UserRole = "ADMIN" | "EDICIO" | "CONSULTA";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

/** Estat genèric d'una operació asíncrona */
export type AsyncStatus = "idle" | "loading" | "success" | "error";

/** Resposta d'error estàndard de l'API */
export interface ApiError {
  message: string;
  code?: string;
}

// ─── Mòdul d'importacions ──────────────────────────────────────────────────

export type EstatImport = "PENDENT" | "CLASSIFICAT" | "REVISAT" | "CONFIRMAT" | "ERROR" | "ARXIVAT";

export type TipusInforme =
  | "PYG_MENSUAL_CENTRES"
  | "PYG_MENSUAL_LN"
  | "PYG_EXERCICI_LN"
  | "PYG_EXERCICI_CENTRE"
  | "PYG_CENTRES"
  | "PYG_LN"
  | "PYG_FDLC"
  | "HORES_CENTRES_TREBALL"
  | "EVALUACIO_NEGOCI"
  | "ALTRE";

export const TIPUS_INFORME_LABELS: Record<TipusInforme, string> = {
  PYG_MENSUAL_CENTRES: "PyG Mensual per Centres",
  PYG_MENSUAL_LN: "PyG Mensual per LN",
  PYG_EXERCICI_LN: "PyG Exercici LN",
  PYG_EXERCICI_CENTRE: "PyG Exercici Centre",
  PYG_CENTRES: "PyG per Centres",
  PYG_LN: "PyG per LN",
  PYG_FDLC: "PyG FDLC (empresa)",
  HORES_CENTRES_TREBALL: "Hores Centres de Treball",
  EVALUACIO_NEGOCI: "Avaluació de Negoci",
  ALTRE: "Altre",
};

export const ESTAT_IMPORT_LABELS: Record<EstatImport, string> = {
  PENDENT: "Pendent",
  CLASSIFICAT: "Classificat",
  REVISAT: "Revisat",
  CONFIRMAT: "Confirmat",
  ERROR: "Error",
  ARXIVAT: "Arxivat",
};

export const MESOS_LABELS: Record<number, string> = {
  1: "Gener",
  2: "Febrer",
  3: "Març",
  4: "Abril",
  5: "Maig",
  6: "Juny",
  7: "Juliol",
  8: "Agost",
  9: "Setembre",
  10: "Octubre",
  11: "Novembre",
  12: "Desembre",
};

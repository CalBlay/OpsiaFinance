import type { NaturaConcepte } from "@prisma/client";

export type { NaturaConcepte };

export const NATURA_CONCEPTE_VALUES = ["INGRES", "VARIABLE", "FIX", "ALIE"] as const;

export const NATURA_CONCEPTE_LABELS: Record<NaturaConcepte, string> = {
  INGRES: "Ingrés",
  VARIABLE: "Variable",
  FIX: "Fix",
  ALIE: "Aliè",
};

/** Seed V1 per node SAP (acord negoci). Subtotals → null. */
export const NATURA_PER_NODE: Readonly<Record<number, NaturaConcepte>> = {
  2: "INGRES",
  3: "INGRES",
  4: "INGRES",
  5: "INGRES",
  7: "VARIABLE",
  8: "VARIABLE",
  9: "VARIABLE",
  10: "VARIABLE",
  13: "FIX",
  14: "FIX",
  15: "FIX",
  16: "FIX",
  18: "FIX",
  19: "FIX",
  20: "FIX",
  21: "VARIABLE",
  22: "FIX",
  23: "FIX",
  24: "FIX",
  25: "FIX",
  26: "FIX",
  27: "FIX",
  28: "FIX",
  29: "ALIE",
  33: "ALIE",
  34: "ALIE",
  36: "ALIE",
  37: "ALIE",
  39: "FIX",
  41: "ALIE",
  44: "VARIABLE",
  46: "FIX",
  47: "FIX",
};

export function parseNaturaConcepte(raw: string | null | undefined): NaturaConcepte | null {
  if (raw == null || raw === "" || raw === "—") return null;
  if ((NATURA_CONCEPTE_VALUES as readonly string[]).includes(raw)) {
    return raw as NaturaConcepte;
  }
  return null;
}

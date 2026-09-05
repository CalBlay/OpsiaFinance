import type { NaturaConcepte } from "@prisma/client";

export type { NaturaConcepte };

export const NATURA_CONCEPTE_VALUES = ["INGRES", "VARIABLE", "FIX", "MIXTE", "ALIE"] as const;

export const NATURA_CONCEPTE_LABELS: Record<NaturaConcepte, string> = {
  INGRES: "Ingrés",
  VARIABLE: "Variable",
  FIX: "Fix",
  MIXTE: "Mixt",
  ALIE: "Aliè",
};

/** % variable per defecte quan es tria MIXTE. */
export const PCT_VARIABLE_MIXTE_DEFECTE = 50;

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

/** Normalitza % variable: només amb MIXTE; rang 0–100. */
export function resolvePctVariable(
  natura: NaturaConcepte | null | undefined,
  pct: number | null | undefined
): number | null {
  if (natura !== "MIXTE") return null;
  if (pct == null || Number.isNaN(pct)) return PCT_VARIABLE_MIXTE_DEFECTE;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Fracció 0–1 del cost tractada com a variable (per al PE). */
export function fraccioVariable(
  natura: NaturaConcepte | null | undefined,
  pctVariable: number | null | undefined
): number {
  if (natura === "VARIABLE") return 1;
  if (natura === "FIX" || natura === "INGRES" || natura === "ALIE" || !natura) return 0;
  if (natura === "MIXTE") return (resolvePctVariable(natura, pctVariable) ?? 0) / 100;
  return 0;
}

export function fraccioFix(
  natura: NaturaConcepte | null | undefined,
  pctVariable: number | null | undefined
): number {
  if (natura === "FIX") return 1;
  if (natura === "VARIABLE" || natura === "INGRES" || natura === "ALIE" || !natura) return 0;
  if (natura === "MIXTE") return 1 - fraccioVariable(natura, pctVariable);
  return 0;
}

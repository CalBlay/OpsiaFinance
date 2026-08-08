import type { CompteCostSalarial } from "@/lib/cost-salarial/compte";

/** Partides del cost salarial restaurants (segur per client; sense db). */
export const PARTIDES_SALARIALS = [
  { key: "totalSalari", label: "Total salari" },
  { key: "incentiusMensual", label: "Incentius mensual" },
  { key: "incentiuTrimestral", label: "Incentiu trimestral" },
  { key: "horesExtres", label: "Hores extres" },
  { key: "altres", label: "Altres" },
  { key: "baixes", label: "Baixes" },
  { key: "indemnitzacions", label: "Indemnitzacions" },
  { key: "foraCentre", label: "Fora centre" },
] as const;

export type PartidaKey = (typeof PARTIDES_SALARIALS)[number]["key"];

export type PartidaImport = {
  key: PartidaKey;
  label: string;
  import_: number;
  pct: number | null;
};

/**
 * A gestió, les indemnitzacions són només informatives:
 * no entren al cost total ni al % sobre vendes.
 */
export function partidaComptaAlTotal(key: PartidaKey, compte: CompteCostSalarial): boolean {
  return !(compte === "gestio" && key === "indemnitzacions");
}

/** Pes % d'una partida sobre el cost (null si és només informativa). */
export function pctPartidaSobreTotal(
  key: PartidaKey,
  import_: number,
  total: number,
  compte: CompteCostSalarial
): number | null {
  if (!partidaComptaAlTotal(key, compte)) return null;
  return total ? (import_ / total) * 100 : null;
}

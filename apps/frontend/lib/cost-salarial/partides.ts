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

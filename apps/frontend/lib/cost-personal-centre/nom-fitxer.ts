import { periodeDesDelNomFitxer } from "@/lib/nom-fitxer";

/**
 * Extreu (mes, any) del nom «Cost_Personal_07_26.xlsx» o «Cost_Personal_07_2026.xlsx».
 */
export function periodeDesDelNomFitxerCostPersonal(
  nomFitxer: string
): { mes: number; any: number } | null {
  const base = nomFitxer.replace(/\.[^.]+$/, "");
  const match = base.match(/cost[_\s-]*personal[_\s-]*(\d{1,2})[_\s-]+(\d{2,4})/i);
  if (match) {
    const mes = Number(match[1]);
    let any = Number(match[2]);
    if (any < 100) any += 2000;
    if (mes >= 1 && mes <= 12 && any >= 2000) return { mes, any };
  }
  return periodeDesDelNomFitxer(nomFitxer);
}

import { periodeDesDelNomFitxer } from "@/lib/nom-fitxer";

export type TipusFitxerCostPersonal = "NOMINA" | "MILLORES";

/**
 * Detecta si el nom és de millores: «Cost_Personal_Millores_07_26.xlsx».
 * Cal comprovar-ho abans del patró de nòmina (prefix compartit).
 */
export function esFitxerMilloresCostPersonal(nomFitxer: string): boolean {
  const base = nomFitxer.replace(/\.[^.]+$/, "");
  return /cost[_\s-]*personal[_\s-]*millores/i.test(base);
}

export function tipusFitxerCostPersonal(nomFitxer: string): TipusFitxerCostPersonal {
  return esFitxerMilloresCostPersonal(nomFitxer) ? "MILLORES" : "NOMINA";
}

/**
 * Extreu (mes, any) del nom:
 *   «Cost_Personal_07_26.xlsx» / «Cost_Personal_07_2026.xlsx»
 *   «Cost_Personal_Millores_07_26.xlsx»
 */
export function periodeDesDelNomFitxerCostPersonal(
  nomFitxer: string
): { mes: number; any: number } | null {
  const base = nomFitxer.replace(/\.[^.]+$/, "");

  const millores = base.match(
    /cost[_\s-]*personal[_\s-]*millores[_\s-]*(\d{1,2})[_\s-]+(\d{2,4})/i
  );
  if (millores) {
    const mes = Number(millores[1]);
    let any = Number(millores[2]);
    if (any < 100) any += 2000;
    if (mes >= 1 && mes <= 12 && any >= 2000) return { mes, any };
  }

  const match = base.match(/cost[_\s-]*personal[_\s-]*(\d{1,2})[_\s-]+(\d{2,4})/i);
  if (match) {
    const mes = Number(match[1]);
    let any = Number(match[2]);
    if (any < 100) any += 2000;
    if (mes >= 1 && mes <= 12 && any >= 2000) return { mes, any };
  }
  return periodeDesDelNomFitxer(nomFitxer);
}

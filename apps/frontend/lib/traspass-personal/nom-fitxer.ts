import { periodeDesDelNomFitxer } from "@/lib/nom-fitxer";

const PATRO_HORES = /hores\s+centres?\s+de\s+treball\s+(\d{1,2})[_\-\s]+(\d{4})/i;

/**
 * Extreu (mes, any) del nom «Hores Centres de Treball mm_aaaa.xlsx».
 * Accepta variants de separador i majúscules/minúscules.
 */
export function periodeDesDelNomFitxerHores(
  nomFitxer: string
): { mes: number; any: number } | null {
  const base = nomFitxer.replace(/\.[^.]+$/, "");
  const match = base.match(PATRO_HORES);
  if (match) {
    const mes = Number(match[1]);
    const any = Number(match[2]);
    if (mes >= 1 && mes <= 12 && any >= 1900) return { mes, any };
  }
  return periodeDesDelNomFitxer(nomFitxer);
}

export function esNomFitxerHores(nomFitxer: string): boolean {
  return PATRO_HORES.test(nomFitxer.replace(/\.[^.]+$/, ""));
}

/**
 * Extreu mes/any del nom, ex.:
 *   «Resum nomina per codi imputació i jornada a 30092026.xls» → 30/09/2026
 *   «…_09_2026.xls» / «… 09-26.xls»
 */
export function periodeDesDelNomFitxerJornada(
  nomFitxer: string
): { mes: number; any: number } | null {
  const base = nomFitxer.replace(/\.[^.]+$/, "");

  // DDMMYYYY al final (amb «a » opcional)
  const ddmmyyyy = base.match(/(?:^|[\s_\-a])(\d{2})(\d{2})(20\d{2})\s*$/i);
  if (ddmmyyyy) {
    const mes = Number(ddmmyyyy[2]);
    const any = Number(ddmmyyyy[3]);
    if (mes >= 1 && mes <= 12) return { mes, any };
  }

  // mm_aaaa / mm_aa
  const m1 = base.match(/(\d{1,2})[_\-\s.]+(20\d{2}|\d{2})\s*$/);
  if (m1) {
    const mes = Number(m1[1]);
    let any = Number(m1[2]);
    if (any < 100) any += 2000;
    if (mes >= 1 && mes <= 12 && any >= 2000) return { mes, any };
  }

  return null;
}

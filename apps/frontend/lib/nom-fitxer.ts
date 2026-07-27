/**
 * Utilitats per extreure classificació (període, LN) del nom d'un fitxer Excel.
 * Mòdul sense dependències de Node — segur per a components client.
 */

/**
 * Extreu (mes, any) del nom del fitxer. Accepta formats com:
 *   "01_2026.xlsx", "1-2026", "01 2026", "2026_01"…
 * Retorna null si no es pot determinar.
 */
export function periodeDesDelNomFitxer(nomFitxer: string): { mes: number; any: number } | null {
  const parsed = classificacioDesDelNomFitxer(nomFitxer);
  if (!parsed) return null;
  return { mes: parsed.mes, any: parsed.any };
}

/**
 * Extreu mes, any i (opcionalment) el codi de LN del nom del fitxer.
 * Conveni preferit: "01_2025_00" → mes 1, any 2025, LN00000.
 * El sufix numèric (00, 01, 06…) es converteix a "LN" + 5 dígits.
 */
export function classificacioDesDelNomFitxer(
  nomFitxer: string
): { mes: number; any: number; codiLn: string | null } | null {
  const base = nomFitxer.replace(/\.[^.]+$/, "");
  const nums = base.match(/\d+/g);
  if (!nums || nums.length < 2) return null;

  let mes: number | null = null;
  let any: number | null = null;
  let lnSuffix: number | null = null;

  for (const n of nums) {
    const v = Number.parseInt(n, 10);
    if (v >= 1900) {
      any = v;
    } else if (v >= 1 && v <= 12 && mes === null) {
      mes = v;
    } else if (v >= 0 && v <= 99 && lnSuffix === null && mes !== null && any !== null) {
      lnSuffix = v;
    }
  }

  if (mes === null || any === null) return null;

  const codiLn = lnSuffix !== null ? `LN${String(lnSuffix).padStart(5, "0")}` : null;
  return { mes, any, codiLn };
}

/** Converteix un sufix numèric (0, 1, 6…) al codi LN estàndard (LN00000, LN00001…). */
export function codiLnDesDeSufix(sufix: number): string {
  return `LN${String(sufix).padStart(5, "0")}`;
}

/** Retorna el codi LN deduït només del nom del fitxer (sense consultar la BBDD). */
export function codiLnDelNomFitxer(nomFitxer: string): string | null {
  return classificacioDesDelNomFitxer(nomFitxer)?.codiLn ?? null;
}

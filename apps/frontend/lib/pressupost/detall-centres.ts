import { CODI_LN_RESTAURANTS } from "@/lib/repartiment/personal-admin-restaurants";

/**
 * LNs que admeten pressupost Tipus A detallat per centre.
 * Ara: Restaurants. Ampliar la llista quan altres LN (casaments, etc.) ho necessitin.
 */
export const CODIS_LN_DETALL_CENTRES: readonly string[] = [CODI_LN_RESTAURANTS];

export function lnSuportaDetallCentres(codiLn: string | null | undefined): boolean {
  if (!codiLn) return false;
  return CODIS_LN_DETALL_CENTRES.includes(codiLn);
}

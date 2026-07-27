/** Dada amb LN de l'informe (fitxer importat). */
export type DadaAmbInforme = {
  liniaNegociId: string | null;
  centreId: string | null;
  senseCentre: boolean;
  importacio: { liniaNegociId: string | null };
};

/**
 * LN sota la qual una dada ha d'aparèixer a les consultes per columna LN.
 *
 * Els informes SAP (p.ex. 01_2025_00 = Central) inclouen columnes de centres
 * d'altres LN de l'arbre; totes pertanyen al compte de la LN del fitxer.
 */
export function lnInformePerAgregacio(d: DadaAmbInforme): string | null {
  if (d.centreId || d.senseCentre) {
    return d.importacio.liniaNegociId ?? d.liniaNegociId;
  }
  return d.liniaNegociId ?? d.importacio.liniaNegociId;
}

export function resolveLiniaNegociImport(
  col: {
    centreId: string | null;
    liniaNegociId: string | null;
    senseCentre: boolean;
    isLnColumna?: boolean;
  },
  lnInformeId: string | null
): string | null {
  if (col.senseCentre) return lnInformeId;
  if (col.centreId) return lnInformeId ?? col.liniaNegociId;
  if (col.isLnColumna) return col.liniaNegociId;
  return lnInformeId ?? col.liniaNegociId;
}

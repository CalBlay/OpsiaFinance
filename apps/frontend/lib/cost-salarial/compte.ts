/**
 * Capes del cost salarial restaurants (mateixa cadena que Resultats).
 *
 * SAP / Directe → Excel Fora centre (sense capa d'ajustos en aquest mòdul)
 * + Traspassos → Fora centre = traspassos confirmats (+destí −origen)
 * Gestió → + Traspassos i indemnitzacions només informatives
 */
import {
  VISTA_COMPTE_CADENA,
  type VistaCompte,
  etiquetaVistaCompte,
  parseVistaCompte,
  vistaInclouTraspassos,
} from "@/lib/vista-compte";

export type CompteCostSalarial = VistaCompte;

export { VISTA_COMPTE_CADENA, etiquetaVistaCompte, parseVistaCompte, vistaInclouTraspassos };

/** Fora centre Excel (SAP/Directe) vs net de traspassos (+ Traspassos / Gestió). */
export function vistaUsaForaCentreTraspass(compte: CompteCostSalarial): boolean {
  return vistaInclouTraspassos(compte);
}

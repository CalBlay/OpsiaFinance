/**
 * Nodes de detall del C.Explotació per balanç d'esdeveniments.
 * Els subtotals els recalcula la consulta; no s'importen com a ajustos.
 */

import {
  mapEtiquetaHistoricANode,
  normalitzarEtiquetaHistoric,
} from "@/lib/historic-calblay/mapeig";

/** Només detall (fulles). Sense TOTAL*, MARGE*, EBITDA, RESULTAT*. */
export const NODES_DETALL_ESDEVENIMENTS = new Set([
  2, 3, 4, 5, 7, 8, 9, 10, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 33, 34,
  36, 37, 39, 41,
]);

/** VENDES + prestació + altres ingressos (+ financers/excepcionals) positius; resta negatiu. */
export const NODES_POSITIUS_ESDEVENIMENTS = new Set([2, 3, 4, 33, 36]);

export const MOTIU_REGULARITZACIO = "Regularització";

const ETIQUETES_IGNORADES_EXTRA = new Set([
  "RESULTAT OPERATIU",
  "RESULTAT ACUMULAT",
  "MARGE BRUT DE LES VENDES",
  "MARGES BRUT SERVEIS I AL",
  "MARGES BRUT SERVEIS I AL.",
  "COMPTE DE RESULTATS",
]);

export function mapEtiquetaEsdevenimentsANode(etiqueta: string): number | null {
  const norm = normalitzarEtiquetaHistoric(etiqueta);
  if (!norm || ETIQUETES_IGNORADES_EXTRA.has(norm)) return null;
  const node = mapEtiquetaHistoricANode(etiqueta);
  if (node === null) return null;
  if (!NODES_DETALL_ESDEVENIMENTS.has(node)) return null;
  return node;
}

export function normalitzarImportEsdeveniments(node: number, raw: number): number {
  if (raw === 0) return 0;
  if (NODES_POSITIUS_ESDEVENIMENTS.has(node)) {
    return raw < 0 ? -raw : raw;
  }
  return raw > 0 ? -raw : raw;
}

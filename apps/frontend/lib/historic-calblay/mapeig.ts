/**
 * Mapeig d'etiquetes del P&L històric Cal Blay (Hoja1, fila ~49)
 * cap als nodes SAP del C.Explotació (1–42).
 */

/** Nodes d'ingrés / resultat: es mantenen positius (criteri SAP). */
export const HISTORIC_NODES_POSITIUS = new Set([2, 3, 4, 5, 6, 12, 32, 33, 35, 36, 38, 40, 42]);

/** Files que no s'importen (intermedis o YTD). */
const ETIQUETES_IGNORADES = new Set([
  "MARGE BRUT DE LES VENDES",
  "MARGES BRUT SERVEIS I AL",
  "MARGES BRUT SERVEIS I AL.",
  "RESULTAT OPERATIU",
  "RESULTAT ACUMULAT",
  "COMPTE DE RESULTATS",
]);

/**
 * Etiqueta Excel (normalitzada) → node SAP.
 * Inclou àlies freqüents dels històrics (COST SALARIAL TOTAL, TOTAL DESPESES S/SALARIS…).
 */
const MAPA_ETIQUETA_NODE: Record<string, number> = {
  VENDES: 2,
  "PRESTACIO DE SERVEIS": 3,
  "PRESTACIO DE SEVEIS": 3,
  "ALTRES INGRESSOS": 4,
  "VARIACIO EXISTENCIES": 5,
  "TOTAL INGRESSOS EXPLOTACIO": 6,
  "TOTAL INGRESSOS EXPLOTACI": 6,
  COMPRES: 7,
  "ALTRES APROVISIONAMENTS": 8,
  "CONSUMS INTERNS": 9,
  "VARIACIO EXISTENICIES COMPRES": 10,
  "VARIACIO EXISTENCIES COMPRES": 10,
  "TOTAL COMPRES": 11,
  "MARGE BRUT TOTAL": 12,
  "SOUS I SALARIS": 13,
  INDEMNITZACIONS: 14,
  "SEGURETAT SOCIAL": 15,
  "ALTRES DESPESES SOCIALS": 16,
  "TOTAL COST SALARIAL": 17,
  "COST SALARIAL TOTAL": 17,
  "ARRENDAMENTS I CANONS": 18,
  "REPARACIONS I CONSERVACIO": 19,
  "SERVEIS PROFESSIONALS": 20,
  TRANSPORTS: 21,
  "PRIMES D'ASSEGURANCES": 22,
  "PRIMES DASSEGURANCES": 22,
  "SERVEIS BANCARIS": 23,
  "PUBLICITAT I PROPAGANDA": 24,
  SUBMINISTRAMENTS: 25,
  "ALTRES DESPESES": 26,
  "ALTRES TRIBUTS": 27,
  "DOTACIO PER INSOLVENCIA": 28,
  "DOTACIO PER INSOLVENCIES": 28,
  "MOVIMENTS INTERNS": 29,
  "TOTAL DESPESES GESTIO": 30,
  "TOTAL DESPESES S/SALARIS": 30,
  "TOTAL DESPESES S SALARIS": 30,
  "TOTAL GESTIO + SALARIS": 31,
  "TOTAL DESPESES": 31,
  EBITDA: 32,
  "INGRESSOS FINANCERS": 33,
  "DESPESES FINANCERES": 34,
  "DESPESSES FINANCERES": 34,
  "RESULTAT FINANCER": 35,
  "INGRESSOS EXCEPCIONALS": 36,
  "INGRESOS EXCEPCIONALS": 36,
  "DESPESES EXCEPCIONALS": 37,
  "DESPESSES EXCEPCIONALS": 37,
  "RESULTAT EXCEPCIONAL": 38,
  AMORTITZACIONS: 39,
  "RESULTAT ABANS D'IMPOSTOS": 40,
  "RESULTAT ABANS DIMPOSTOS": 40,
  "IMPOST SOBRE BENEFICIS": 41,
  "RESULTAT DESPRES D'IMPOSTOS": 42,
  "RESULTAT DESPRES DIMPOSTOS": 42,
};

/** Normalitza text d'etiqueta per matching (sense accents, majúscules, puntuació). */
export function normalitzarEtiquetaHistoric(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/\.$/, "");
}

export function mapEtiquetaHistoricANode(etiqueta: string): number | null {
  const norm = normalitzarEtiquetaHistoric(etiqueta);
  if (!norm || ETIQUETES_IGNORADES.has(norm)) return null;
  if (MAPA_ETIQUETA_NODE[norm] !== undefined) return MAPA_ETIQUETA_NODE[norm];

  // Prefix tous (etiquetes truncades a l'Excel)
  for (const [key, node] of Object.entries(MAPA_ETIQUETA_NODE)) {
    if (norm.startsWith(key) || key.startsWith(norm)) return node;
  }
  return null;
}

/** Criteri SAP: ingressos/resultats +, despeses −. */
export function normalitzarImportHistoric(node: number, raw: number): number {
  if (raw === 0) return 0;
  if (HISTORIC_NODES_POSITIUS.has(node)) {
    return raw < 0 ? -raw : raw;
  }
  return raw > 0 ? -raw : raw;
}

/**
 * Diccionari únic de noms de filtres a consultes.
 * Ordre a la barra: dates → camps → vista → impressora (vegeu ConsultaToolbar).
 *
 * No escriguis etiquetes literals als selectors: importa d’aquí.
 */
export const FILTRE = {
  any: "Any",
  mes: "Mes",
  desDe: "Des de",
  finsA: "Fins a",
  vista: "Vista",
  ambit: "Àmbit",
  linia: "Línia",
  centre: "Centre",
  restaurant: "Restaurant",
  granularitat: "Granularitat",
  mesosComparar: "Mesos",
} as const;

export type FiltreKey = keyof typeof FILTRE;

/** Opcions corporatives de Vista (cadena C.Explotació). */
export const VISTA_OPCIONS = {
  sap: "SAP",
  ajustos: "Ajustos",
  directe: "Directe",
  traspassos: "+ Traspassos",
  gestio: "Gestió",
} as const;

/** Valor buit del selector de mes (= acumulat anual). */
export const MES_TOT_ANY = "Tot l'any";

export const AMBIT_OPCIONS_RESTAURANTS = {
  comparativa: "Tota la línia",
  restaurant: "Restaurant",
  salaCuina: "Sala vs Cuina",
} as const;

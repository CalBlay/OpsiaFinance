import { db } from "@/lib/db";

/** Estructura base del compte d'explotació (nodes SAP 1–42). */
const CONCEPTES_BASE: { node: number; descripcio: string; esSubtotal: boolean }[] = [
  { node: 1, descripcio: "COMPTE DE RESULTATS", esSubtotal: true },
  { node: 2, descripcio: "VENDES", esSubtotal: false },
  { node: 3, descripcio: "PRESTACIO DE SEVEIS", esSubtotal: false },
  { node: 4, descripcio: "ALTRES INGRESSOS", esSubtotal: false },
  { node: 5, descripcio: "VARIACIO EXISTENCIES", esSubtotal: false },
  { node: 6, descripcio: "TOTAL INGRESSOS EXPLOTACIO", esSubtotal: true },
  { node: 7, descripcio: "COMPRES", esSubtotal: false },
  { node: 8, descripcio: "ALTRES APROVISIONAMENTS", esSubtotal: false },
  { node: 9, descripcio: "CONSUMS INTERNS", esSubtotal: false },
  { node: 10, descripcio: "VARIACIO EXISTENICIES COMPRES", esSubtotal: false },
  { node: 11, descripcio: "TOTAL COMPRES", esSubtotal: true },
  { node: 12, descripcio: "MARGE BRUT TOTAL", esSubtotal: true },
  { node: 13, descripcio: "SOUS I SALARIS", esSubtotal: false },
  { node: 14, descripcio: "INDEMNITZACIONS", esSubtotal: false },
  { node: 15, descripcio: "SEGURETAT SOCIAL", esSubtotal: false },
  { node: 16, descripcio: "ALTRES DESPESES SOCIALS", esSubtotal: false },
  { node: 44, descripcio: "CONTRACTES ETT", esSubtotal: false },
  { node: 17, descripcio: "TOTAL COST SALARIAL", esSubtotal: true },
  { node: 18, descripcio: "ARRENDAMENTS I CANONS", esSubtotal: false },
  { node: 19, descripcio: "REPARACIONS I CONSERVACIO", esSubtotal: false },
  { node: 20, descripcio: "SERVEIS PROFESSIONALS", esSubtotal: false },
  { node: 21, descripcio: "TRANSPORTS", esSubtotal: false },
  { node: 22, descripcio: "PRIMES D'ASSEGURANCES", esSubtotal: false },
  { node: 23, descripcio: "SERVEIS BANCARIS", esSubtotal: false },
  { node: 24, descripcio: "PUBLICITAT I PROPAGANDA", esSubtotal: false },
  { node: 25, descripcio: "SUBMINISTRAMENTS", esSubtotal: false },
  { node: 26, descripcio: "ALTRES DESPESES", esSubtotal: false },
  { node: 27, descripcio: "ALTRES TRIBUTS", esSubtotal: false },
  { node: 28, descripcio: "DOTACIO PER INSOLVENCIA", esSubtotal: false },
  { node: 29, descripcio: "MOVIMENTS INTERNS", esSubtotal: false },
  { node: 30, descripcio: "TOTAL DESPESES GESTIO", esSubtotal: true },
  { node: 31, descripcio: "TOTAL  GESTIO + SALARIS", esSubtotal: true },
  { node: 32, descripcio: "EBITDA", esSubtotal: true },
  { node: 33, descripcio: "INGRESSOS FINANCERS", esSubtotal: false },
  { node: 34, descripcio: "DESPESSES FINANCERES", esSubtotal: false },
  { node: 35, descripcio: "RESULTAT FINANCER", esSubtotal: true },
  { node: 36, descripcio: "INGRESOS EXCEPCIONALS", esSubtotal: false },
  { node: 37, descripcio: "DESPESSES EXCEPCIONALS", esSubtotal: false },
  { node: 38, descripcio: "RESULTAT EXCEPCIONAL", esSubtotal: true },
  { node: 39, descripcio: "AMORTITZACIONS", esSubtotal: false },
  { node: 40, descripcio: "RESULTAT ABANS D'IMPOSTOS", esSubtotal: true },
  { node: 41, descripcio: "IMPOST SOBRE BENEFICIS", esSubtotal: false },
  { node: 42, descripcio: "RESULTAT DESPRES D'IMPOSTOS", esSubtotal: true },
];

/** Crea els conceptes base si encara no existeixen (necessari abans del primer import FDLC). */
export async function ensureConceptesCompteBase(): Promise<void> {
  await Promise.all(
    CONCEPTES_BASE.map((c) =>
      db.concepteResultat.upsert({
        where: { node: c.node },
        update: {},
        create: { node: c.node, descripcio: c.descripcio, esSubtotal: c.esSubtotal, ordre: c.node },
      })
    )
  );
}

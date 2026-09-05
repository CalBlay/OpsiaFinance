import { db } from "@/lib/db";
import { NATURA_PER_NODE, type NaturaConcepte } from "@/lib/natura-concepte";

/** Estructura base del compte d'explotació (nodes SAP 1–42). */
const CONCEPTES_BASE: {
  node: number;
  descripcio: string;
  esSubtotal: boolean;
  natura: NaturaConcepte | null;
}[] = [
  { node: 1, descripcio: "COMPTE DE RESULTATS", esSubtotal: true, natura: null },
  { node: 2, descripcio: "VENDES", esSubtotal: false, natura: "INGRES" },
  { node: 3, descripcio: "PRESTACIO DE SEVEIS", esSubtotal: false, natura: "INGRES" },
  { node: 4, descripcio: "ALTRES INGRESSOS", esSubtotal: false, natura: "INGRES" },
  { node: 5, descripcio: "VARIACIO EXISTENCIES", esSubtotal: false, natura: "INGRES" },
  { node: 6, descripcio: "TOTAL INGRESSOS EXPLOTACIO", esSubtotal: true, natura: null },
  { node: 7, descripcio: "COMPRES", esSubtotal: false, natura: "VARIABLE" },
  { node: 8, descripcio: "ALTRES APROVISIONAMENTS", esSubtotal: false, natura: "VARIABLE" },
  { node: 9, descripcio: "CONSUMS INTERNS", esSubtotal: false, natura: "VARIABLE" },
  { node: 10, descripcio: "VARIACIO EXISTENICIES COMPRES", esSubtotal: false, natura: "VARIABLE" },
  { node: 11, descripcio: "TOTAL COMPRES", esSubtotal: true, natura: null },
  { node: 12, descripcio: "MARGE BRUT TOTAL", esSubtotal: true, natura: null },
  { node: 13, descripcio: "SOUS I SALARIS", esSubtotal: false, natura: "FIX" },
  { node: 14, descripcio: "INDEMNITZACIONS", esSubtotal: false, natura: "FIX" },
  { node: 15, descripcio: "SEGURETAT SOCIAL", esSubtotal: false, natura: "FIX" },
  { node: 16, descripcio: "ALTRES DESPESES SOCIALS", esSubtotal: false, natura: "FIX" },
  { node: 44, descripcio: "CONTRACTES ETT", esSubtotal: false, natura: "VARIABLE" },
  { node: 17, descripcio: "TOTAL COST SALARIAL", esSubtotal: true, natura: null },
  { node: 18, descripcio: "ARRENDAMENTS I CANONS", esSubtotal: false, natura: "FIX" },
  { node: 19, descripcio: "REPARACIONS I CONSERVACIO", esSubtotal: false, natura: "FIX" },
  { node: 20, descripcio: "SERVEIS PROFESSIONALS", esSubtotal: false, natura: "FIX" },
  { node: 21, descripcio: "TRANSPORTS", esSubtotal: false, natura: "VARIABLE" },
  { node: 22, descripcio: "PRIMES D'ASSEGURANCES", esSubtotal: false, natura: "FIX" },
  { node: 23, descripcio: "SERVEIS BANCARIS", esSubtotal: false, natura: "FIX" },
  { node: 24, descripcio: "PUBLICITAT I PROPAGANDA", esSubtotal: false, natura: "FIX" },
  { node: 25, descripcio: "SUBMINISTRAMENTS", esSubtotal: false, natura: "FIX" },
  { node: 26, descripcio: "ALTRES DESPESES", esSubtotal: false, natura: "FIX" },
  { node: 27, descripcio: "ALTRES TRIBUTS", esSubtotal: false, natura: "FIX" },
  { node: 28, descripcio: "DOTACIO PER INSOLVENCIA", esSubtotal: false, natura: "FIX" },
  { node: 29, descripcio: "MOVIMENTS INTERNS", esSubtotal: false, natura: "ALIE" },
  { node: 30, descripcio: "TOTAL DESPESES GESTIO", esSubtotal: true, natura: null },
  { node: 31, descripcio: "TOTAL  GESTIO + SALARIS", esSubtotal: true, natura: null },
  { node: 32, descripcio: "EBITDA", esSubtotal: true, natura: null },
  { node: 33, descripcio: "INGRESSOS FINANCERS", esSubtotal: false, natura: "ALIE" },
  { node: 34, descripcio: "DESPESSES FINANCERES", esSubtotal: false, natura: "ALIE" },
  { node: 35, descripcio: "RESULTAT FINANCER", esSubtotal: true, natura: null },
  { node: 36, descripcio: "INGRESOS EXCEPCIONALS", esSubtotal: false, natura: "ALIE" },
  { node: 37, descripcio: "DESPESSES EXCEPCIONALS", esSubtotal: false, natura: "ALIE" },
  { node: 38, descripcio: "RESULTAT EXCEPCIONAL", esSubtotal: true, natura: null },
  { node: 39, descripcio: "AMORTITZACIONS", esSubtotal: false, natura: "FIX" },
  { node: 40, descripcio: "RESULTAT ABANS D'IMPOSTOS", esSubtotal: true, natura: null },
  { node: 41, descripcio: "IMPOST SOBRE BENEFICIS", esSubtotal: false, natura: "ALIE" },
  { node: 42, descripcio: "RESULTAT DESPRES D'IMPOSTOS", esSubtotal: true, natura: null },
];

/**
 * Crea o actualitza els conceptes base.
 * La natura només s'omple si encara és null (no pisa edicions manuals).
 */
export async function ensureConceptesCompteBase(): Promise<void> {
  await Promise.all(
    CONCEPTES_BASE.map((c, index) =>
      db.concepteResultat.upsert({
        where: { node: c.node },
        update: {
          descripcio: c.descripcio,
          esSubtotal: c.esSubtotal,
          ordre: index + 1,
        },
        create: {
          node: c.node,
          descripcio: c.descripcio,
          esSubtotal: c.esSubtotal,
          ordre: index + 1,
          natura: c.natura ?? NATURA_PER_NODE[c.node] ?? null,
        },
      })
    )
  );

  // Omple natura només on encara és null (BD antiga / nodes nous sense tocar edicions).
  await Promise.all(
    Object.entries(NATURA_PER_NODE).map(([node, natura]) =>
      db.concepteResultat.updateMany({
        where: { node: Number(node), natura: null },
        data: { natura },
      })
    )
  );
}

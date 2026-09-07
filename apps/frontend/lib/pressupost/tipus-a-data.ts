import {
  type ConceptePivot,
  aplicarCapaVistaEvolucio,
  getCompteExplotacioCentre,
  getEvolucioMensualPerVista,
} from "@/lib/consultes";
import { esCentreAdministracio } from "@/lib/consultes-grafics";
import { db } from "@/lib/db";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { lnSuportaDetallCentres } from "@/lib/pressupost/detall-centres";
import { type ConcepteTipusA, NODES_TIPUS_A } from "@/lib/pressupost/tipus-a";

export type CentrePressupostOpt = {
  id: string;
  codi: string;
  nom: string;
};

/** Centres operatius d’una LN (sense administració), si la LN admet detall. */
export async function getCentresPressupostLn(
  liniaNegociId: string,
  codiLn: string
): Promise<CentrePressupostOpt[]> {
  if (!lnSuportaDetallCentres(codiLn)) return [];

  const centres = await db.centre.findMany({
    where: { liniaNegociId, isActive: true },
    orderBy: [{ ordre: "asc" }, { codi: "asc" }],
    select: { id: true, codi: true, nom: true },
  });

  return centres.filter((c) => !esCentreAdministracio(c));
}

export async function getPressupostCelsCentre(
  pressupostId: string,
  centreId: string
): Promise<{ mes: number; concepteResultatId: string; import_: number }[]> {
  const rows = await db.pressupostCelCentre.findMany({
    where: { pressupostId, centreId },
    select: { mes: true, concepteResultatId: true, import_: true },
  });
  return rows.map((r) => ({
    mes: r.mes,
    concepteResultatId: r.concepteResultatId,
    import_: Number(r.import_),
  }));
}

/** True si hi ha alguna cel·la de detall per centre en aquest pressupost. */
export async function teDetallCentres(pressupostId: string): Promise<boolean> {
  const row = await db.pressupostCelCentre.findFirst({
    where: { pressupostId },
    select: { id: true },
  });
  return row != null;
}

/**
 * Suma de totes les cel·les de centres → mapa concepte×mes (signe comptable).
 */
export async function sumaCelsCentres(pressupostId: string): Promise<Map<string, number>> {
  const rows = await db.pressupostCelCentre.findMany({
    where: { pressupostId },
    select: { mes: true, concepteResultatId: true, import_: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.concepteResultatId}:${r.mes}`;
    m.set(k, (m.get(k) ?? 0) + Number(r.import_));
  }
  return m;
}

/** Conceptes BD només per als nodes Tipus A. */
export async function getConceptesTipusA(): Promise<ConcepteTipusA[]> {
  const rows = await db.concepteResultat.findMany({
    where: { isActive: true, node: { in: [...NODES_TIPUS_A] } },
    select: { id: true, node: true, descripcio: true },
  });
  const byNode = new Map(rows.map((r) => [r.node, r]));
  return NODES_TIPUS_A.map((node) => {
    const r = byNode.get(node);
    return {
      id: r?.id ?? "",
      node,
      descripcio: r?.descripcio ?? String(node),
    };
  }).filter((c) => c.id);
}

function emptyPerNodeMes(): Record<number, number[]> {
  const perNodeMes: Record<number, number[]> = {};
  for (const n of NODES_TIPUS_A) {
    perNodeMes[n] = Array.from({ length: 12 }, () => 0);
  }
  return perNodeMes;
}

function omplirDesDeConceptsGestio(
  concepts: ConceptePivot[],
  perNodeMes: Record<number, number[]>
) {
  for (const c of concepts) {
    const dest = perNodeMes[c.node];
    if (!dest) continue;
    for (let i = 0; i < 12; i++) {
      dest[i] = c.valors[i] ?? 0;
    }
  }
}

/**
 * Referència any anterior = mateix compte que Resultats · vista Gestió
 * (personal base Gestió + repartiment a LN).
 */
export async function getReferenciaAnyAnteriorTipusA(
  any: number,
  liniaNegociId: string
): Promise<{ anyRef: number; perNodeMes: Record<number, number[]> }> {
  const anyRef = any - 1;
  const perNodeMes = emptyPerNodeMes();
  const grup = await getGrupEmpresaActual();

  const ev = await getEvolucioMensualPerVista("linia", liniaNegociId, anyRef, grup, "directe");
  if (ev.buit || !ev.concepts.length) return { anyRef, perNodeMes };

  const concepts = await aplicarCapaVistaEvolucio(
    "linia",
    liniaNegociId,
    anyRef,
    ev.concepts,
    grup,
    "gestio"
  );
  omplirDesDeConceptsGestio(concepts, perNodeMes);
  return { anyRef, perNodeMes };
}

/**
 * Referència any anterior per centre = vista Gestió del centre
 * (Directe + traspassos / base personal Gestió; sense repartiment LN).
 */
export async function getReferenciaAnyAnteriorCentre(
  any: number,
  centreId: string
): Promise<{ anyRef: number; perNodeMes: Record<number, number[]> }> {
  const anyRef = any - 1;
  const perNodeMes = emptyPerNodeMes();

  const compte = await getCompteExplotacioCentre(centreId, anyRef, "gestio");
  if (compte.buit || !compte.concepts.length) return { anyRef, perNodeMes };

  omplirDesDeConceptsGestio(compte.concepts, perNodeMes);
  return { anyRef, perNodeMes };
}

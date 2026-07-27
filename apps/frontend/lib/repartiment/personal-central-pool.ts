import { vendesLn } from "@/lib/repartiment/bases-vendes";
import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import { personalImputatLn } from "@/lib/repartiment/personal-ln";
import type { NormaRepartiment } from "@prisma/client";

export const CODI_GRUP_PERSONAL_CENTRAL = "GRUP_PERSONAL_CENTRAL";

function directeLn(directe: Map<string, Map<number, number>>, lnId: string, node: number): number {
  return directe.get(lnId)?.get(node) ?? 0;
}

/** Imputació Agenda (LN00000): fix + % ingressos explotació Central. */
function imputatPersonalAgenda(
  centralLnId: string,
  directe: Map<string, Map<number, number>>,
  normes: NormaRepartiment[]
): number {
  const ingressos = vendesLn(directe, centralLnId);
  let imputat = 0;
  for (const norma of normes.filter(
    (n) => n.actiu && n.liniaNegociDestiId === centralLnId && n.concepteNode === NODE_COST_SALARIAL
  )) {
    if (norma.tipus === "IMPORT_FIX" && norma.valorImport != null) {
      imputat += Number(norma.valorImport);
    }
    if (norma.tipus === "PERCENT_VENDES_PROPIES" && norma.valorPercent != null) {
      imputat += -(Math.abs(ingressos) * (Number(norma.valorPercent) / 100));
    }
  }
  return imputat;
}

/** Fix estructura Restaurants (LN00001). */
function imputatPersonalRestaurants(
  lnIdByCodi: Map<string, string>,
  normes: NormaRepartiment[]
): number {
  const lnId = lnIdByCodi.get("LN00001");
  if (!lnId) return 0;
  const norma = normes.find(
    (n) =>
      n.actiu &&
      n.liniaNegociDestiId === lnId &&
      n.concepteNode === NODE_COST_SALARIAL &&
      n.tipus === "IMPORT_FIX"
  );
  return norma?.valorImport != null ? Number(norma.valorImport) : 0;
}

/**
 * Pool personal Central després de restar imputacions ja assignades:
 *   SAP LN00000 − (fix Restaurants + imputat Green Vita + imputat Foodlovers + imputat Agenda)
 */
export function poolPersonalCentralDistribuible(
  directe: Map<string, Map<number, number>>,
  centralLnId: string,
  normes: NormaRepartiment[],
  lnIdByCodi: Map<string, string>
): { pool: number; detallRestes: string[] } {
  const centralSap = directeLn(directe, centralLnId, NODE_COST_SALARIAL);
  const detallRestes: string[] = [];

  const restLn01 = imputatPersonalRestaurants(lnIdByCodi, normes);
  if (restLn01 !== 0) detallRestes.push(`LN00001 fix ${restLn01.toFixed(2)}`);

  let restes = restLn01;

  for (const codi of ["LN00006", "LN00005"] as const) {
    const lnId = lnIdByCodi.get(codi);
    if (!lnId) continue;
    const imp = personalImputatLn(codi, lnId, directe, normes);
    if (imp !== 0) {
      restes += imp;
      detallRestes.push(`${codi} imputat ${imp.toFixed(2)}`);
    }
  }

  const agenda = imputatPersonalAgenda(centralLnId, directe, normes);
  if (agenda !== 0) {
    restes += agenda;
    detallRestes.push(`LN00000 Agenda ${agenda.toFixed(2)}`);
  }

  const pool = centralSap - restes;
  return { pool, detallRestes };
}

/**
 * Personal Precuinats / Empresa / Casaments (GRUP_PERSONAL_CENTRAL):
 *   objectiu = SAP propi + pes(vendes) × pool del punt anterior
 */
export function calcularMovimentsPersonalGrupCentral(
  normes: NormaRepartiment[],
  directe: Map<string, Map<number, number>>,
  centralLnId: string,
  lnIdByCodi: Map<string, string>,
  grupPersonalId: string,
  pesMap: Map<string, number>
): MovimentCalculat[] {
  const normesGrup = normes.filter(
    (n) =>
      n.actiu &&
      n.grupId === grupPersonalId &&
      n.concepteNode === NODE_COST_SALARIAL &&
      n.tipus === "REPARTIMENT_PROPORCIONAL"
  );
  if (!normesGrup.length) return [];

  const { pool, detallRestes } = poolPersonalCentralDistribuible(
    directe,
    centralLnId,
    normes,
    lnIdByCodi
  );

  const moviments: MovimentCalculat[] = [];

  for (const norma of normesGrup.sort((a, b) => a.ordre - b.ordre)) {
    if (!norma.liniaNegociDestiId || !norma.grupId) continue;

    const pes = pesMap.get(`${norma.grupId}:${norma.liniaNegociDestiId}`) ?? 0;
    const sapPropi = directeLn(directe, norma.liniaNegociDestiId, NODE_COST_SALARIAL);
    const quotaPool = pool * pes;
    const objectiu = sapPropi + quotaPool;

    moviments.push({
      normaId: norma.id,
      liniaNegociDestiId: norma.liniaNegociDestiId,
      concepteNode: NODE_COST_SALARIAL,
      importCalculat: objectiu,
      detallCalcul: `SAP ${sapPropi.toFixed(2)} + ${(pes * 100).toFixed(2)}% × pool ${pool.toFixed(2)} (Central SAP − restes: ${detallRestes.join(", ")})`,
    });
  }

  return moviments;
}

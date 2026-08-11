import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import { NODES_GESTIO_DETALL, NODE_COST_GESTIO } from "@/lib/repartiment/nodes";
import type { NormaRepartiment } from "@prisma/client";

/**
 * LN operatives: gestió SAP pròpia + % del pool distribuïble Central.
 * El % de cada LN (i d’Agenda/LN00000) surt sempre de la norma a Configuració (Valor).
 */
const GESTIO_SAP_PROPI_MES_PERCENT_CENTRAL = new Set([
  "LN00002",
  "LN00003",
  "LN00004",
  "LN00005",
  "LN00006",
]);

function directeLn(directe: Map<string, Map<number, number>>, lnId: string, node: number): number {
  // El node 30 és un subtotal de pantalla; cal recomputar-lo amb les partides
  // reals (18–29), no usar el subtotal que venia al fitxer SAP.
  if (node === NODE_COST_GESTIO) {
    const nodes = directe.get(lnId);
    return NODES_GESTIO_DETALL.reduce((sum, detall) => sum + (nodes?.get(detall) ?? 0), 0);
  }
  return directe.get(lnId)?.get(node) ?? 0;
}

function codiPerLnId(lnId: string, lnIdByCodi: Map<string, string>): string | undefined {
  for (const [codi, id] of lnIdByCodi) {
    if (id === lnId) return codi;
  }
  return undefined;
}

function normaGestioPercentCentral(
  lnId: string,
  normes: NormaRepartiment[]
): NormaRepartiment | undefined {
  return normes.find(
    (n) =>
      n.actiu &&
      n.liniaNegociDestiId === lnId &&
      n.concepteNode === NODE_COST_GESTIO &&
      n.tipus === "PERCENT_POOL_CENTRAL" &&
      n.valorPercent != null
  );
}

/** % retenció gestió Agenda (LN00000) sobre el SAP Central — valor de la norma. */
export function percentRetencioGestioCentral(
  centralLnId: string,
  normes: NormaRepartiment[]
): number {
  const norma = normes.find(
    (n) =>
      n.actiu &&
      n.liniaNegociDestiId === centralLnId &&
      n.concepteNode === NODE_COST_GESTIO &&
      n.tipus === "PERCENT_POOL_CENTRAL" &&
      n.valorPercent != null
  );
  return norma ? Number(norma.valorPercent) / 100 : 0;
}

/**
 * Pas 1: apartar Agenda (LN00000) amb el % de la norma.
 * Pool distribuïble = gestió SAP Central − retenció Agenda.
 */
export function poolGestioCentralDistribuible(
  directe: Map<string, Map<number, number>>,
  centralLnId: string,
  normes: NormaRepartiment[]
): { pool: number; centralGestio: number; retencioAgenda: number } {
  const centralGestio = directeLn(directe, centralLnId, NODE_COST_GESTIO);
  const pctAgenda = percentRetencioGestioCentral(centralLnId, normes);
  const retencioAgenda = centralGestio * pctAgenda;
  const pool = centralGestio - retencioAgenda;
  return { pool, centralGestio, retencioAgenda };
}

export function esNormaGestioEspecial(
  norma: NormaRepartiment,
  lnIdByCodi: Map<string, string>
): boolean {
  if (norma.concepteNode !== NODE_COST_GESTIO || norma.tipus !== "PERCENT_POOL_CENTRAL") {
    return false;
  }
  if (!norma.liniaNegociDestiId) return false;
  const codi = codiPerLnId(norma.liniaNegociDestiId, lnIdByCodi);
  return codi != null && GESTIO_SAP_PROPI_MES_PERCENT_CENTRAL.has(codi);
}

/** Imputació: % × pool distribuïble (no el total SAP Central). */
export function gestioImputatCentral(
  codi: string,
  centralLnId: string,
  directe: Map<string, Map<number, number>>,
  normes: NormaRepartiment[],
  lnIdByCodi: Map<string, string>
): number {
  if (!GESTIO_SAP_PROPI_MES_PERCENT_CENTRAL.has(codi)) return 0;
  const lnId = lnIdByCodi.get(codi);
  if (!lnId) return 0;
  const norma = normaGestioPercentCentral(lnId, normes);
  if (!norma) return 0;
  const pct = Number(norma.valorPercent) / 100;
  const { pool } = poolGestioCentralDistribuible(directe, centralLnId, normes);
  return pool * pct;
}

export function restarGestioImputadaDelPool(
  poolRestant: Map<number, number>,
  directe: Map<string, Map<number, number>>,
  centralLnId: string,
  normes: NormaRepartiment[],
  lnIdByCodi: Map<string, string>
): void {
  for (const codi of GESTIO_SAP_PROPI_MES_PERCENT_CENTRAL) {
    const imputat = gestioImputatCentral(codi, centralLnId, directe, normes, lnIdByCodi);
    if (imputat === 0) continue;
    const pool = poolRestant.get(NODE_COST_GESTIO) ?? 0;
    poolRestant.set(NODE_COST_GESTIO, pool - imputat);
  }
}

/**
 * Pas 2: repartir el pool a les LN operatives.
 * TOTAL GESTIÓ = gestió SAP pròpia + (Valor% × pool).
 * Pas 3 (tornar Agenda): moviment propi a central-ln.ts.
 */
export function calcularMovimentsGestioEspecial(
  normes: NormaRepartiment[],
  directe: Map<string, Map<number, number>>,
  centralLnId: string,
  lnIdByCodi: Map<string, string>
): MovimentCalculat[] {
  const moviments: MovimentCalculat[] = [];
  const { pool, centralGestio, retencioAgenda } = poolGestioCentralDistribuible(
    directe,
    centralLnId,
    normes
  );

  for (const codi of GESTIO_SAP_PROPI_MES_PERCENT_CENTRAL) {
    const lnId = lnIdByCodi.get(codi);
    if (!lnId) continue;

    const norma = normaGestioPercentCentral(lnId, normes);
    if (!norma || norma.valorPercent == null) continue;

    const sapPropi = directeLn(directe, lnId, NODE_COST_GESTIO);
    const pct = Number(norma.valorPercent);
    const imputat = pool * (pct / 100);
    const objectiu = sapPropi + imputat;

    const parts: string[] = [];
    if (sapPropi !== 0) parts.push(`SAP gestió ${sapPropi.toFixed(2)}`);
    parts.push(
      `${pct}% × pool ${pool.toFixed(2)} (Central SAP ${centralGestio.toFixed(2)} − Agenda ${retencioAgenda.toFixed(2)}) = ${imputat.toFixed(2)}`
    );

    moviments.push({
      normaId: norma.id,
      liniaNegociDestiId: lnId,
      concepteNode: NODE_COST_GESTIO,
      importCalculat: objectiu,
      detallCalcul: parts.join(" + "),
    });
  }

  return moviments;
}

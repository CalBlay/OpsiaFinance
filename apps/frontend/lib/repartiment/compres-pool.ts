import { vendesLn } from "@/lib/repartiment/bases-vendes";
import {
  NODE_ALTRES_APROVISIONAMENTS,
  NODE_COMPRES,
  NODE_COMPRES_DETALL,
} from "@/lib/repartiment/nodes";
import type { NormaRepartiment } from "@prisma/client";

export interface MovimentCalculat {
  normaId: string | null;
  liniaNegociDestiId: string;
  concepteNode: number;
  importCalculat: number;
  detallCalcul: string;
}

/** LN amb compres = % ingressos explotació (es resten del pool; també objectiu destí). */
const CODIS_COMPRES_PERCENT_VENDES = ["LN00000", "LN00004", "LN00005", "LN00006"] as const;

/** LN que sumen línies SAP directes (compres + altres aprov.) a l'objectiu TOTAL COMPRES. */
const COMPRES_SAP_DIRECTE_EXTRA: Partial<Record<string, readonly number[]>> = {
  LN00002: [NODE_COMPRES_DETALL, NODE_ALTRES_APROVISIONAMENTS],
  LN00003: [NODE_COMPRES_DETALL, NODE_ALTRES_APROVISIONAMENTS],
  LN00005: [NODE_COMPRES_DETALL, NODE_ALTRES_APROVISIONAMENTS],
  LN00006: [NODE_COMPRES_DETALL, NODE_ALTRES_APROVISIONAMENTS],
};

/** LN que reparteixen el pool restant per vendes (GRUP_COMPRES_CENTRAL). */
const CODIS_COMPRES_PROPORCIONAL = ["LN00002", "LN00003"] as const;

export const CODI_GRUP_COMPRES_CENTRAL = "GRUP_COMPRES_CENTRAL";

function directeLn(directe: Map<string, Map<number, number>>, lnId: string, node: number): number {
  // El node 11 és un subtotal de pantalla: la base del repartiment ha de ser
  // sempre el total real de Compres (línies 7 + 8), no el subtotal importat SAP.
  if (node === NODE_COMPRES) {
    const nodes = directe.get(lnId);
    return (nodes?.get(NODE_COMPRES_DETALL) ?? 0) + (nodes?.get(NODE_ALTRES_APROVISIONAMENTS) ?? 0);
  }
  return directe.get(lnId)?.get(node) ?? 0;
}

function normaPercentCompres(
  lnId: string,
  normes: NormaRepartiment[]
): NormaRepartiment | undefined {
  return normes.find(
    (n) =>
      n.actiu &&
      n.liniaNegociDestiId === lnId &&
      n.concepteNode === NODE_COMPRES &&
      n.tipus === "PERCENT_VENDES_PROPIES" &&
      n.valorPercent != null
  );
}

/** Imputació Central: només −% × ingressos explotació (per restar del pool). */
export function compresPercentImputat(
  lnId: string,
  directe: Map<string, Map<number, number>>,
  normes: NormaRepartiment[]
): number | null {
  const norma = normaPercentCompres(lnId, normes);
  if (!norma) return null;
  const pct = Number(norma.valorPercent) / 100;
  const base = vendesLn(directe, lnId);
  return -(Math.abs(base) * pct);
}

function sapDirecteExtra(
  codi: string,
  lnId: string,
  directe: Map<string, Map<number, number>>
): { suma: number; detall: string[] } {
  const nodes = COMPRES_SAP_DIRECTE_EXTRA[codi as keyof typeof COMPRES_SAP_DIRECTE_EXTRA];
  if (!nodes?.length) return { suma: 0, detall: [] };

  let suma = 0;
  const detall: string[] = [];
  for (const node of nodes) {
    const v = directeLn(directe, lnId, node);
    suma += v;
    if (v !== 0) detall.push(`SAP node ${node}: ${v.toFixed(2)}`);
  }
  return { suma, detall };
}

/** Objectiu TOTAL COMPRES de gestió (imputat + opcionalment línies SAP directes). */
export function objectiuCompresLn(
  codi: string,
  lnId: string,
  directe: Map<string, Map<number, number>>,
  normes: NormaRepartiment[]
): { objectiu: number | null; imputat: number | null; detall: string } {
  const imputat = compresPercentImputat(lnId, directe, normes);
  if (imputat == null) return { objectiu: null, imputat: null, detall: "" };

  const norma = normaPercentCompres(lnId, normes);
  if (!norma) return { objectiu: null, imputat: null, detall: "" };
  const base = vendesLn(directe, lnId);
  const parts = [
    `${Number(norma.valorPercent)}% × ingressos ${base.toFixed(2)} = ${imputat.toFixed(2)}`,
  ];

  const extra = sapDirecteExtra(codi, lnId, directe);
  if (extra.detall.length) parts.push(...extra.detall);

  const objectiu = imputat + extra.suma;
  return { objectiu, imputat, detall: parts.join(" + ") };
}

function movimentCompresLn(
  codi: string,
  lnId: string,
  directe: Map<string, Map<number, number>>,
  normes: NormaRepartiment[]
): MovimentCalculat | null {
  const norma = normaPercentCompres(lnId, normes);
  if (!norma) return null;

  const { objectiu, detall } = objectiuCompresLn(codi, lnId, directe, normes);
  if (objectiu == null) return null;

  return {
    normaId: norma.id,
    liniaNegociDestiId: lnId,
    concepteNode: NODE_COMPRES,
    importCalculat: objectiu,
    detallCalcul: detall,
  };
}

function teNormesCompresProporcional(
  normes: NormaRepartiment[],
  lnIdByCodi: Map<string, string>
): boolean {
  return CODIS_COMPRES_PROPORCIONAL.some((codi) => {
    const lnId = lnIdByCodi.get(codi);
    if (!lnId) return false;
    return normes.some(
      (n) =>
        n.actiu &&
        n.tipus === "REPARTIMENT_PROPORCIONAL" &&
        n.concepteNode === NODE_COMPRES &&
        n.liniaNegociDestiId === lnId
    );
  });
}

/**
 * Compres de gestió (Empresa + Casaments):
 *   pool = compres SAP Central (LN00000)
 *   pool −= % ingressos de Agenda, Precuinats, Foodlovers, Green Vita
 *   LN00002 / LN00003 = pool × pes(vendes) + SAP propi (compres + altres aprov.)
 */
export function calcularMovimentsCompres(
  normes: NormaRepartiment[],
  directe: Map<string, Map<number, number>>,
  centralLnId: string,
  lnIdByCodi: Map<string, string>,
  pesMap: Map<string, number>,
  grupCompresId: string
): MovimentCalculat[] {
  const moviments: MovimentCalculat[] = [];
  const proportionalActiu = teNormesCompresProporcional(normes, lnIdByCodi);

  if (proportionalActiu) {
    let pool = directeLn(directe, centralLnId, NODE_COMPRES);

    const detallRestes: string[] = [];
    for (const codi of CODIS_COMPRES_PERCENT_VENDES) {
      const lnId = lnIdByCodi.get(codi);
      if (!lnId) continue;
      const imputat = compresPercentImputat(lnId, directe, normes);
      if (imputat == null) continue;
      pool -= imputat;
      detallRestes.push(`${codi} ${imputat.toFixed(2)}`);
    }

    for (const codi of CODIS_COMPRES_PROPORCIONAL) {
      const lnId = lnIdByCodi.get(codi);
      if (!lnId) continue;
      const pes = pesMap.get(`${grupCompresId}:${lnId}`) ?? 0;
      const quotaPool = pool * pes;
      const extra = sapDirecteExtra(codi, lnId, directe);
      const objectiu = quotaPool + extra.suma;

      const norma = normes.find(
        (n) =>
          n.actiu &&
          n.tipus === "REPARTIMENT_PROPORCIONAL" &&
          n.concepteNode === NODE_COMPRES &&
          n.liniaNegociDestiId === lnId
      );
      if (!norma) continue;

      const parts = [
        `${(pes * 100).toFixed(2)}% × pool ${pool.toFixed(2)} = ${quotaPool.toFixed(2)}`,
        ...extra.detall,
      ];
      moviments.push({
        normaId: norma.id,
        liniaNegociDestiId: lnId,
        concepteNode: NODE_COMPRES,
        importCalculat: objectiu,
        detallCalcul: `${parts.join(" + ")} (Central SAP − restes: ${detallRestes.join(", ")})`,
      });
    }
  }

  // LN00000 també és LN destí: mateix objectiu % × vendes pròpies que 04/05/06.
  // (La quota ja s’ha restat del pool de 02/03 més amunt.)
  for (const codi of CODIS_COMPRES_PERCENT_VENDES) {
    const lnId = lnIdByCodi.get(codi);
    if (!lnId) continue;
    const mov = movimentCompresLn(codi, lnId, directe, normes);
    if (mov) moviments.push(mov);
  }

  return moviments;
}

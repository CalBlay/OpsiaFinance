/**
 * Norma: 25% del personal SAP (sous + SS) del centre d'Administració de restaurants (LN00001)
 * s'imputa a LN00006 (Green Vita). El mateix import es treu de LN00001.
 *
 * Base: SAP (DadaResultat) del centre, nodes 13 i 15.
 */
import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import {
  NODE_COST_SALARIAL,
  NODE_SEGURETAT_SOCIAL,
  NODE_SOUS_SALARIS,
} from "@/lib/repartiment/nodes";
import type { NormaRepartiment } from "@prisma/client";

export const CODI_LN_RESTAURANTS = "LN00001";
export const CODI_LN_GREEN_VITA = "LN00006";

/** Nom estable de la norma (editable % a settings). */
export const NOM_NORMA_ADMIN_REST_GREEN_VITA =
  "Green Vita · 25% personal centre Admin restaurants (LN00001)";

/**
 * Codi del centre d'Administració dins LN00001 (CCR00000 · ADMINISTRACIO RESTAURANTS).
 * Si és null, el loader busca centres LN00001 amb nom/codi «Admin…».
 */
export const CODI_CENTRE_ADMIN_RESTAURANTS: string | null = "CCR00000";

export const PERCENT_DEFECTE_ADMIN_REST_GREEN_VITA = 25;

export type CostSapAdminRestaurants = {
  centreId: string;
  centreCodi: string;
  centreNom: string;
  sous: number;
  seguretatSocial: number;
};

export function esNormaAdminRestGreenVita(nom: string | null): boolean {
  return nom === NOM_NORMA_ADMIN_REST_GREEN_VITA;
}

export function percentAdminRestGreenVita(
  normes: Pick<NormaRepartiment, "nom" | "actiu" | "valorPercent">[]
): number {
  const norma = normes.find((n) => esNormaAdminRestGreenVita(n.nom));
  if (!norma?.actiu) return 0;
  return Number(norma.valorPercent ?? PERCENT_DEFECTE_ADMIN_REST_GREEN_VITA);
}

/**
 * Genera moviments objectiu (abans de deltas):
 *   LN00006 = SAP + (−quota)
 *   LN00001 = SAP + (+quota)  → treu el cost
 * quota = % × (|sous| + |SS|) del centre Admin.
 */
export function calcularMovimentsAdminRestGreenVita(
  normes: NormaRepartiment[],
  directe: Map<string, Map<number, number>>,
  lnIdByCodi: Map<string, string>,
  costAdmin: CostSapAdminRestaurants | null
): MovimentCalculat[] {
  const pct = percentAdminRestGreenVita(normes);
  if (pct <= 0 || !costAdmin) return [];

  const lnRestId = lnIdByCodi.get(CODI_LN_RESTAURANTS);
  const lnGvId = lnIdByCodi.get(CODI_LN_GREEN_VITA);
  if (!lnRestId || !lnGvId) return [];

  const norma = normes.find((n) => n.actiu && esNormaAdminRestGreenVita(n.nom));
  if (!norma) return [];

  const baseAbs = Math.abs(costAdmin.sous) + Math.abs(costAdmin.seguretatSocial);
  if (baseAbs < 0.005) return [];

  const quotaAbs = baseAbs * (pct / 100);
  const imputatGv = -quotaAbs;
  const imputatRest = +quotaAbs;

  const sapGv = directe.get(lnGvId)?.get(NODE_COST_SALARIAL) ?? 0;
  const sapRest = directe.get(lnRestId)?.get(NODE_COST_SALARIAL) ?? 0;

  const detallBase = `traspass LN00001→LN00006 · ${costAdmin.centreCodi} ${costAdmin.centreNom}: |sous| ${Math.abs(costAdmin.sous).toFixed(2)} + |SS| ${Math.abs(costAdmin.seguretatSocial).toFixed(2)} = ${baseAbs.toFixed(2)}; ${pct}% = ${quotaAbs.toFixed(2)}`;

  return [
    {
      normaId: norma.id,
      liniaNegociDestiId: lnGvId,
      concepteNode: NODE_COST_SALARIAL,
      importCalculat: sapGv + imputatGv,
      detallCalcul: `SAP ${sapGv.toFixed(2)} + imputat Admin rest. ${imputatGv.toFixed(2)} € (${detallBase})`,
    },
    {
      normaId: norma.id,
      liniaNegociDestiId: lnRestId,
      concepteNode: NODE_COST_SALARIAL,
      importCalculat: sapRest + imputatRest,
      detallCalcul: `SAP ${sapRest.toFixed(2)} + retorn Admin→GV ${imputatRest.toFixed(2)} € (${detallBase})`,
    },
  ];
}

export { NODE_SOUS_SALARIS, NODE_SEGURETAT_SOCIAL };

import { type PesGrupCalculat, vendesLn } from "@/lib/repartiment/bases-vendes";
import { calcularMovimentsCentralLn } from "@/lib/repartiment/central-ln";
import { type MovimentCalculat, calcularMovimentsCompres } from "@/lib/repartiment/compres-pool";
import {
  calcularMovimentsGestioEspecial,
  esNormaGestioEspecial,
  restarGestioImputadaDelPool,
} from "@/lib/repartiment/gestio-ln";
import { NODE_COMPRES, NODE_COST_SALARIAL, NODE_INGRESSOS } from "@/lib/repartiment/nodes";
import {
  type CostSapAdminRestaurants,
  calcularMovimentsAdminRestGreenVita,
  esNormaAdminRestGreenVita,
} from "@/lib/repartiment/personal-admin-restaurants";
import {
  type ConfigPersonalDept,
  type ConfigPersonalLn,
  type CostDeptMes,
  type PesDefecteComercial,
  calcularMovimentsPersonalDepartaments,
} from "@/lib/repartiment/personal-departaments";
import type { NormaRepartiment, TipusNormaRepartiment } from "@prisma/client";

export type { MovimentCalculat };

export type ContextPersonalDept = {
  costs: CostDeptMes[];
  configsLn: ConfigPersonalLn[];
  configsDept: ConfigPersonalDept[];
  pesDefecte: PesDefecteComercial[];
  fraccioSobrantIguals: number;
  /** Cost SAP sous+SS del centre Admin restaurants (opcional). */
  costAdminRestaurants?: CostSapAdminRestaurants | null;
};

/** Redueix el pool distribuïble segons normes pròpies de Central (destí LN00000). */
function aplicarRetencioCentral(
  poolRestant: Map<number, number>,
  directe: Map<string, Map<number, number>>,
  centralLnId: string,
  normes: NormaRepartiment[]
): void {
  const centralNormes = normes
    .filter((n) => n.actiu && n.liniaNegociDestiId === centralLnId)
    .sort((a, b) => a.ordre - b.ordre);

  for (const norma of centralNormes) {
    const pct = norma.valorPercent != null ? Number(norma.valorPercent) / 100 : 0;
    const fix = norma.valorImport != null ? Number(norma.valorImport) : 0;
    const node = norma.concepteNode;
    const pool = poolRestant.get(node) ?? 0;

    switch (norma.tipus as TipusNormaRepartiment) {
      case "PERCENT_VENDES_PROPIES": {
        const vendes = vendesLn(directe, centralLnId);
        const retain = -(Math.abs(vendes) * pct);
        poolRestant.set(node, pool - retain);
        break;
      }
      case "IMPORT_FIX":
        poolRestant.set(node, pool - fix);
        break;
      case "PERCENT_POOL_CENTRAL": {
        const keep = pool * pct;
        poolRestant.set(node, pool - keep);
        break;
      }
      default:
        break;
    }
  }
}

function esNormaCompresExterna(norma: NormaRepartiment): boolean {
  return (
    norma.concepteNode === NODE_COMPRES &&
    (norma.tipus === "PERCENT_VENDES_PROPIES" || norma.tipus === "REPARTIMENT_PROPORCIONAL")
  );
}

/** Genera moviments de repartiment segons normes actives i pesos del mes. */
export function calcularMoviments(
  normes: NormaRepartiment[],
  directe: Map<string, Map<number, number>>,
  centralLnId: string,
  pesos: PesGrupCalculat[],
  pesOverrides: Map<string, number>,
  lnIdByCodi: Map<string, string>,
  grupCompresId: string,
  personalDept: ContextPersonalDept
): MovimentCalculat[] {
  const normesActives = normes.filter((n) => n.actiu).sort((a, b) => a.ordre - b.ordre);

  const pesMap = new Map<string, number>();
  for (const p of pesos) {
    const key = `${p.grupId}:${p.liniaNegociId}`;
    pesMap.set(key, pesOverrides.get(key) ?? p.pesCalculat);
  }

  const movimentsCompres = calcularMovimentsCompres(
    normesActives,
    directe,
    centralLnId,
    lnIdByCodi,
    pesMap,
    grupCompresId
  );

  const movimentsCentral = calcularMovimentsCentralLn(normesActives, directe, centralLnId);
  const movimentsGestio = calcularMovimentsGestioEspecial(
    normesActives,
    directe,
    centralLnId,
    lnIdByCodi
  );
  const movimentsPersonal = calcularMovimentsPersonalDepartaments(
    personalDept.costs,
    personalDept.configsLn,
    personalDept.configsDept,
    directe,
    lnIdByCodi,
    personalDept.pesDefecte,
    personalDept.fraccioSobrantIguals
  );
  const movimentsAdminRest = calcularMovimentsAdminRestGreenVita(
    normesActives,
    directe,
    lnIdByCodi,
    personalDept.costAdminRestaurants ?? null
  );

  const moviments: MovimentCalculat[] = [
    ...movimentsCompres,
    ...movimentsCentral,
    ...movimentsGestio,
    ...movimentsPersonal,
    ...movimentsAdminRest,
  ];
  const poolRestant = new Map<number, number>();
  const central = directe.get(centralLnId) ?? new Map();
  for (const [node, val] of central) {
    if (node === NODE_COMPRES) continue;
    poolRestant.set(node, val);
  }

  aplicarRetencioCentral(poolRestant, directe, centralLnId, normesActives);
  restarGestioImputadaDelPool(poolRestant, directe, centralLnId, normesActives, lnIdByCodi);

  const proportionalPendents: NormaRepartiment[] = [];

  for (const norma of normesActives) {
    if (esNormaCompresExterna(norma)) continue;
    if (esNormaGestioEspecial(norma, lnIdByCodi)) continue;
    if (norma.concepteNode === NODE_COST_SALARIAL) continue;
    if (esNormaAdminRestGreenVita(norma.nom)) continue;

    const pct = norma.valorPercent != null ? Number(norma.valorPercent) / 100 : 0;
    const fix = norma.valorImport != null ? Number(norma.valorImport) : 0;
    const destId = norma.liniaNegociDestiId;
    if (!destId || destId === centralLnId) continue;

    switch (norma.tipus as TipusNormaRepartiment) {
      case "PERCENT_VENDES_PROPIES": {
        const vendes = vendesLn(directe, destId);
        const imputat = -(Math.abs(vendes) * pct);
        const sap = directe.get(destId)?.get(norma.concepteNode) ?? 0;
        moviments.push({
          normaId: norma.id,
          liniaNegociDestiId: destId,
          concepteNode: norma.concepteNode,
          importCalculat: sap + imputat,
          detallCalcul: `SAP ${sap.toFixed(2)} + ${(pct * 100).toFixed(2)}% × vendes ${vendes.toFixed(2)}`,
        });
        break;
      }
      case "PERCENT_POOL_CENTRAL": {
        const pool = poolRestant.get(norma.concepteNode) ?? 0;
        const imputat = pool * pct;
        const sap = directe.get(destId)?.get(norma.concepteNode) ?? 0;
        moviments.push({
          normaId: norma.id,
          liniaNegociDestiId: destId,
          concepteNode: norma.concepteNode,
          importCalculat: sap + imputat,
          detallCalcul: `SAP ${sap.toFixed(2)} + ${(pct * 100).toFixed(2)}% × pool ${pool.toFixed(2)}`,
        });
        poolRestant.set(norma.concepteNode, pool - imputat);
        break;
      }
      case "IMPORT_FIX": {
        const sap = directe.get(destId)?.get(norma.concepteNode) ?? 0;
        moviments.push({
          normaId: norma.id,
          liniaNegociDestiId: destId,
          concepteNode: norma.concepteNode,
          importCalculat: sap + fix,
          detallCalcul: `SAP ${sap.toFixed(2)} + fix ${fix.toFixed(2)} €`,
        });
        break;
      }
      case "RESTEM": {
        const pool = poolRestant.get(norma.concepteNode) ?? 0;
        const resta = norma.valorImport != null ? Number(norma.valorImport) : pool * pct;
        poolRestant.set(norma.concepteNode, pool - resta);
        break;
      }
      case "REPARTIMENT_PROPORCIONAL":
        proportionalPendents.push(norma);
        break;
    }
  }

  const propPerGrupNode = new Map<string, NormaRepartiment[]>();
  for (const norma of proportionalPendents) {
    const key = `${norma.grupId}:${norma.concepteNode}`;
    const list = propPerGrupNode.get(key) ?? [];
    list.push(norma);
    propPerGrupNode.set(key, list);
  }

  for (const [, grupNormes] of propPerGrupNode) {
    const ref = grupNormes[0];
    if (!ref) continue;

    const node = ref.concepteNode;
    const pool = poolRestant.get(node) ?? 0;
    let sumaImput = 0;

    for (const norma of grupNormes.sort((a, b) => a.ordre - b.ordre)) {
      if (!norma.grupId || !norma.liniaNegociDestiId) continue;
      const pes = pesMap.get(`${norma.grupId}:${norma.liniaNegociDestiId}`) ?? 0;
      const imputat = pool * pes;
      const sap = directe.get(norma.liniaNegociDestiId)?.get(node) ?? 0;
      sumaImput += imputat;
      moviments.push({
        normaId: norma.id,
        liniaNegociDestiId: norma.liniaNegociDestiId,
        concepteNode: node,
        importCalculat: sap + imputat,
        detallCalcul: `SAP ${sap.toFixed(2)} + ${(pes * 100).toFixed(2)}% × pool distribuïble ${pool.toFixed(2)}`,
      });
    }
    poolRestant.set(node, pool - sumaImput);
  }

  return moviments;
}

/**
 * Converteix imports objectiu en deltas respecte la base Directe (SAP + ajustos) de cada LN.
 */
export function movimentsADeltas(
  moviments: MovimentCalculat[],
  directe: Map<string, Map<number, number>>
): MovimentCalculat[] {
  return moviments.map((m) => {
    const directeVal = directe.get(m.liniaNegociDestiId)?.get(m.concepteNode) ?? 0;
    const delta = m.importCalculat - directeVal;
    return {
      ...m,
      importCalculat: delta,
      detallCalcul: `${m.detallCalcul} → objectiu ${m.importCalculat.toFixed(2)}, Δ ${delta.toFixed(2)}`,
    };
  });
}

export { NODE_INGRESSOS };

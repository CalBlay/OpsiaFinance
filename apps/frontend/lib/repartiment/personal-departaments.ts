import { sumaNodesPersonalDetall } from "@/lib/cost-personal-centre/nodes";
import { vendesLn } from "@/lib/repartiment/bases-vendes";
import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import {
  CODIS_LN_PERSONAL_COMERCIAL,
  CODIS_LN_PERSONAL_CONFIG,
  FRACCIO_SOBRANT_IGUALS_DEFECTE,
  clampFraccio01,
  marcaSobrantPersonal,
} from "@/lib/repartiment/personal-departaments-constants";
import type { ModeRepartimentPersonalLn } from "@prisma/client";

export type CostDeptMes = {
  departamentId: string;
  centreId: string;
  centreCodi: string;
  centreNom: string;
  deptCodi: string;
  deptNom: string;
  /** Valor absolut (nòmina + millores). */
  costPersonal: number;
};

export type ConfigPersonalLn = {
  liniaNegociId: string;
  codiLn: string;
  mode: ModeRepartimentPersonalLn;
  importFixTotal: number | null;
};

export type ConfigPersonalDept = {
  liniaNegociId: string;
  departamentId: string;
  actiu: boolean;
  percentDept: number | null;
  pesInternFix: number | null;
};

export type PesDefecteComercial = {
  liniaNegociId: string;
  pesDefecte: number;
};

export type AllocacioDeptLn = {
  departamentId: string;
  liniaNegociId: string;
  importAbs: number;
  origen: "EXPLICIT" | "SOBRANT";
};

function directeLn(directe: Map<string, Map<number, number>>, lnId: string, node: number): number {
  // El node 17 és un subtotal: el pool ha de partir sempre del total visible
  // de personal (detall 13–16 + 44), no del subtotal importat SAP.
  if (node === NODE_COST_SALARIAL) {
    return sumaNodesPersonalDetall(directe.get(lnId));
  }
  return directe.get(lnId)?.get(node) ?? 0;
}

/** Pesos LN00002/LN00003: facturació del mes; sense vendes → pes per defecte. */
export function calcularPesosComercialPersonal(
  directe: Map<string, Map<number, number>>,
  lnIdByCodi: Map<string, string>,
  pesDefecte: PesDefecteComercial[]
): Map<string, number> {
  const defecteByLn = new Map(pesDefecte.map((p) => [p.liniaNegociId, p.pesDefecte]));
  const vendesPerLn = CODIS_LN_PERSONAL_COMERCIAL.map((codi) => {
    const lnId = lnIdByCodi.get(codi);
    return {
      lnId: lnId ?? "",
      vendes: lnId ? Math.max(0, vendesLn(directe, lnId)) : 0,
    };
  }).filter((v) => v.lnId);

  const totalVendes = vendesPerLn.reduce((s, v) => s + v.vendes, 0);
  const result = new Map<string, number>();

  if (totalVendes > 0) {
    for (const v of vendesPerLn) {
      result.set(v.lnId, v.vendes / totalVendes);
    }
    return result;
  }

  const totalDefecte = vendesPerLn.reduce((s, v) => s + (defecteByLn.get(v.lnId) ?? 0.5), 0);
  for (const v of vendesPerLn) {
    const pes = defecteByLn.get(v.lnId) ?? 0.5;
    result.set(v.lnId, totalDefecte > 0 ? pes / totalDefecte : 1 / vendesPerLn.length);
  }
  return result;
}

/**
 * Pes del sobrant per a una LN comercial:
 * part a parts iguals entre 02/03 + resta pel pes de vendes del mes.
 */
export function pesSobrantPersonalComercial(
  lnId: string,
  pesosComercial: Map<string, number>,
  nComercial = CODIS_LN_PERSONAL_COMERCIAL.length,
  fraccioIguals = FRACCIO_SOBRANT_IGUALS_DEFECTE
): number {
  const pesIgual = nComercial > 0 ? 1 / nComercial : 0;
  const pesVendes = pesosComercial.get(lnId) ?? 0;
  const iguals = clampFraccio01(fraccioIguals);
  return iguals * pesIgual + (1 - iguals) * pesVendes;
}

function configsDeptLn(
  configsDept: ConfigPersonalDept[],
  lnId: string,
  deptId: string
): ConfigPersonalDept | undefined {
  return configsDept.find((c) => c.liniaNegociId === lnId && c.departamentId === deptId && c.actiu);
}

function sumaPesIntern(configLn: ConfigPersonalLn, configsDept: ConfigPersonalDept[]): number {
  return configsDept
    .filter((c) => c.liniaNegociId === configLn.liniaNegociId && c.actiu)
    .reduce((s, c) => s + Math.max(0, c.pesInternFix ?? 1), 0);
}

/**
 * Import explícit mensual d’una LN de config (absolut).
 * FIX_TOTAL → importFixTotal (tal qual, sense dependre de depts actius).
 * PERCENT_DEPT → Σ % × cost nòmina de cada dept actiu.
 */
export function importExplicitPersonalLn(
  configLn: ConfigPersonalLn,
  configsDept: ConfigPersonalDept[],
  costs: CostDeptMes[]
): number {
  if (configLn.mode === "FIX_TOTAL") {
    return Math.abs(configLn.importFixTotal ?? 0);
  }
  let total = 0;
  for (const dept of costs) {
    const cfg = configsDeptLn(configsDept, configLn.liniaNegociId, dept.departamentId);
    if (!cfg) continue;
    const pct = cfg.percentDept ?? 0;
    if (pct === 0) continue;
    total += Math.abs(dept.costPersonal) * (pct / 100);
  }
  return total;
}

/** Calcula assignacions € (absolut) per departament × LN (vista config / detall). */
export function calcularAllocacionsPersonalDept(
  costs: CostDeptMes[],
  configsLn: ConfigPersonalLn[],
  configsDept: ConfigPersonalDept[],
  lnIdByCodi: Map<string, string>,
  pesosComercial: Map<string, number>,
  fraccioSobrantIguals = FRACCIO_SOBRANT_IGUALS_DEFECTE
): AllocacioDeptLn[] {
  const allocations: AllocacioDeptLn[] = [];
  const configLnById = new Map(configsLn.map((c) => [c.liniaNegociId, c]));

  for (const dept of costs) {
    const costBase = Math.abs(dept.costPersonal);
    if (costBase === 0) continue;

    let explicitTotal = 0;

    for (const codi of CODIS_LN_PERSONAL_CONFIG) {
      const lnId = lnIdByCodi.get(codi);
      if (!lnId) continue;
      const configLn = configLnById.get(lnId);
      if (!configLn) continue;
      const cfgDept = configsDeptLn(configsDept, lnId, dept.departamentId);
      if (!cfgDept) continue;

      let importAbs = 0;
      if (configLn.mode === "PERCENT_DEPT") {
        const pct = cfgDept.percentDept ?? 0;
        importAbs = costBase * (pct / 100);
      } else {
        const fixTotal = Math.abs(configLn.importFixTotal ?? 0);
        const sumPes = sumaPesIntern(configLn, configsDept);
        const pes = cfgDept.pesInternFix ?? 1;
        if (fixTotal > 0 && sumPes > 0 && Math.max(0, pes) > 0) {
          importAbs = fixTotal * (pes / sumPes);
        }
      }

      if (importAbs > 0) {
        explicitTotal += importAbs;
        allocations.push({
          departamentId: dept.departamentId,
          liniaNegociId: lnId,
          importAbs,
          origen: "EXPLICIT",
        });
      }
    }

    const remainder = Math.max(0, costBase - explicitTotal);
    if (remainder > 0) {
      for (const codi of CODIS_LN_PERSONAL_COMERCIAL) {
        const lnId = lnIdByCodi.get(codi);
        if (!lnId) continue;
        const pes = pesSobrantPersonalComercial(
          lnId,
          pesosComercial,
          CODIS_LN_PERSONAL_COMERCIAL.length,
          fraccioSobrantIguals
        );
        if (pes <= 0) continue;
        allocations.push({
          departamentId: dept.departamentId,
          liniaNegociId: lnId,
          importAbs: remainder * pes,
          origen: "SOBRANT",
        });
      }
    }
  }

  return allocations;
}

/**
 * Moviments Personal SC (objectiu abans de deltas).
 *
 * Regla:
 *   pool     = |SAP personal Central| (font del cost)
 *   LN00000  = LN destí amb import fix/% (com 01/04/05/06)
 *   fixes    = LN00001/04/05/06
 *   sobrant  = pool − LN00000 − fixes → LN00002 i LN00003
 *              mix (fracció editable a parts iguals + resta pel pes de vendes)
 *
 * LN00000 genera moviment destí propi (no només residual opac).
 */
export function calcularMovimentsPersonalDepartaments(
  costs: CostDeptMes[],
  configsLn: ConfigPersonalLn[],
  configsDept: ConfigPersonalDept[],
  directe: Map<string, Map<number, number>>,
  lnIdByCodi: Map<string, string>,
  pesDefecte: PesDefecteComercial[],
  fraccioSobrantIguals = FRACCIO_SOBRANT_IGUALS_DEFECTE
): MovimentCalculat[] {
  const pesosComercial = calcularPesosComercialPersonal(directe, lnIdByCodi, pesDefecte);
  const configLnById = new Map(configsLn.map((c) => [c.liniaNegociId, c]));

  const centralLnId = lnIdByCodi.get("LN00000");
  const sapCentralAbs = centralLnId
    ? Math.abs(directeLn(directe, centralLnId, NODE_COST_SALARIAL))
    : 0;

  const explicitPerLn = new Map<string, number>();
  for (const codi of CODIS_LN_PERSONAL_CONFIG) {
    const lnId = lnIdByCodi.get(codi);
    if (!lnId) continue;
    const configLn = configLnById.get(lnId);
    if (!configLn) continue;
    const importAbs = importExplicitPersonalLn(configLn, configsDept, costs);
    if (importAbs > 0) explicitPerLn.set(lnId, importAbs);
  }

  const retencioAbs = Math.min(
    centralLnId ? (explicitPerLn.get(centralLnId) ?? 0) : 0,
    sapCentralAbs
  );

  /** Fixes que surten de Central (tot menys la retenció LN00000). */
  const fixAltres = new Map<string, number>();
  let sumaFixAltres = 0;
  for (const [lnId, v] of explicitPerLn) {
    if (centralLnId && lnId === centralLnId) continue;
    fixAltres.set(lnId, v);
    sumaFixAltres += v;
  }

  const budgetSortides = Math.max(0, sapCentralAbs - retencioAbs);
  const escalaFix =
    sumaFixAltres > budgetSortides && sumaFixAltres > 1e-9 ? budgetSortides / sumaFixAltres : 1;
  if (escalaFix < 1) {
    for (const [lnId, v] of fixAltres) fixAltres.set(lnId, v * escalaFix);
    sumaFixAltres *= escalaFix;
  }

  const sobrantAbs = Math.max(0, budgetSortides - sumaFixAltres);

  const nComercial = CODIS_LN_PERSONAL_COMERCIAL.length;
  const pesSobrant = (lnId: string) =>
    pesSobrantPersonalComercial(lnId, pesosComercial, nComercial, fraccioSobrantIguals);

  const imputatPerLn = new Map<string, number>(fixAltres);
  for (const codi of CODIS_LN_PERSONAL_COMERCIAL) {
    const lnId = lnIdByCodi.get(codi);
    if (!lnId) continue;
    const pes = pesSobrant(lnId);
    if (pes <= 0 || sobrantAbs <= 0) continue;
    imputatPerLn.set(lnId, (imputatPerLn.get(lnId) ?? 0) + sobrantAbs * pes);
  }

  const marcaSobrant = marcaSobrantPersonal(fraccioSobrantIguals);
  const moviments: MovimentCalculat[] = [];
  const reglaInfo = `pool SAP Central ${sapCentralAbs.toFixed(2)} − LN00000 ${retencioAbs.toFixed(2)} − fixes ${sumaFixAltres.toFixed(2)} → sobrant ${sobrantAbs.toFixed(2)} a 02/03 (${marcaSobrant})`;

  // LN00000 com a LN destí: objectiu = import fix (no residual opac).
  if (centralLnId && retencioAbs > 1e-9) {
    moviments.push({
      normaId: null,
      liniaNegociDestiId: centralLnId,
      concepteNode: NODE_COST_SALARIAL,
      importCalculat: -retencioAbs,
      detallCalcul: `Personal SC · LN00000 destí (import fix): ${(-retencioAbs).toFixed(2)} €. ${reglaInfo}`,
    });
  }

  for (const [lnId, imputatAbs] of imputatPerLn) {
    if (imputatAbs < 1e-9) continue;
    const sapPropi = directeLn(directe, lnId, NODE_COST_SALARIAL);
    const imputat = -imputatAbs;
    const objectiu = sapPropi + imputat;
    const esComercial = [...CODIS_LN_PERSONAL_COMERCIAL].some(
      (codi) => lnIdByCodi.get(codi) === lnId
    );
    const pesInfo = esComercial
      ? ` · pes mix ${(pesSobrant(lnId) * 100).toFixed(1)}% (${marcaSobrant} ${((pesosComercial.get(lnId) ?? 0) * 100).toFixed(1)}%)`
      : " · import fix";

    moviments.push({
      normaId: null,
      liniaNegociDestiId: lnId,
      concepteNode: NODE_COST_SALARIAL,
      importCalculat: objectiu,
      detallCalcul: `Personal SC: SAP ${sapPropi.toFixed(2)} + imputat ${imputat.toFixed(2)} €${pesInfo}. ${reglaInfo}`,
    });
  }

  return moviments;
}

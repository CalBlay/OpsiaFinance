import { vendesLn } from "@/lib/repartiment/bases-vendes";
import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import type { NormaRepartiment, TipusNormaRepartiment } from "@prisma/client";

/** LN amb personal agregat (fix + %); inclouSap = suma també el TOTAL COST SALARIAL SAP. */
const PERSONAL_AGREGAT: Record<string, { inclouSap: boolean }> = {
  LN00005: { inclouSap: true },
  LN00006: { inclouSap: true },
};

const CODIS_PERSONAL_AGREGAT = new Set(Object.keys(PERSONAL_AGREGAT));

function directeLn(directe: Map<string, Map<number, number>>, lnId: string, node: number): number {
  return directe.get(lnId)?.get(node) ?? 0;
}

function codiPerLnId(lnId: string, lnIdByCodi: Map<string, string>): string | undefined {
  for (const [codi, id] of lnIdByCodi) {
    if (id === lnId) return codi;
  }
  return undefined;
}

function normesPersonalLn(lnId: string, normes: NormaRepartiment[]): NormaRepartiment[] {
  return normes
    .filter(
      (n) =>
        n.actiu &&
        n.liniaNegociDestiId === lnId &&
        n.concepteNode === NODE_COST_SALARIAL &&
        (n.tipus === "PERCENT_VENDES_PROPIES" || n.tipus === "IMPORT_FIX")
    )
    .sort((a, b) => a.ordre - b.ordre);
}

function calcularImputatPersonal(
  normesLn: NormaRepartiment[],
  ingressos: number
): { imputat: number; parts: string[] } {
  let imputat = 0;
  const parts: string[] = [];

  for (const norma of normesLn) {
    const pct = norma.valorPercent != null ? Number(norma.valorPercent) / 100 : 0;
    const fix = norma.valorImport != null ? Number(norma.valorImport) : 0;

    switch (norma.tipus as TipusNormaRepartiment) {
      case "PERCENT_VENDES_PROPIES": {
        const imp = -(Math.abs(ingressos) * pct);
        imputat += imp;
        parts.push(
          `${(pct * 100).toFixed(2)}% × ingressos ${ingressos.toFixed(2)} = ${imp.toFixed(2)}`
        );
        break;
      }
      case "IMPORT_FIX": {
        imputat += fix;
        parts.push(`fix ${fix.toFixed(2)} €`);
        break;
      }
      default:
        break;
    }
  }

  return { imputat, parts };
}

export function esNormaPersonalEspecial(
  norma: NormaRepartiment,
  lnIdByCodi: Map<string, string>
): boolean {
  if (norma.concepteNode !== NODE_COST_SALARIAL || !norma.liniaNegociDestiId) return false;
  const codi = codiPerLnId(norma.liniaNegociDestiId, lnIdByCodi);
  return codi != null && CODIS_PERSONAL_AGREGAT.has(codi);
}

/**
 * Personal agregat per LN:
 *   Foodlovers / Green Vita: SAP personal (sous, SS, etc.) + fix + % ingressos
 */
export function calcularMovimentsPersonalEspecial(
  normes: NormaRepartiment[],
  directe: Map<string, Map<number, number>>,
  lnIdByCodi: Map<string, string>
): MovimentCalculat[] {
  const moviments: MovimentCalculat[] = [];

  for (const [codi, config] of Object.entries(PERSONAL_AGREGAT)) {
    const lnId = lnIdByCodi.get(codi);
    if (!lnId) continue;

    const normesLn = normesPersonalLn(lnId, normes);
    if (!normesLn.length) continue;

    const ingressos = vendesLn(directe, lnId);
    const { imputat, parts } = calcularImputatPersonal(normesLn, ingressos);

    let objectiu = imputat;
    if (config.inclouSap) {
      const sap = directeLn(directe, lnId, NODE_COST_SALARIAL);
      if (sap !== 0) parts.unshift(`SAP personal ${sap.toFixed(2)}`);
      objectiu = sap + imputat;
    }

    moviments.push({
      normaId: normesLn[0]!.id,
      liniaNegociDestiId: lnId,
      concepteNode: NODE_COST_SALARIAL,
      importCalculat: objectiu,
      detallCalcul: parts.join(" + "),
    });
  }

  return moviments;
}

/** Imputació Central (fix + %) sense la part SAP pròpia. */
export function personalImputatLn(
  codi: string,
  lnId: string,
  directe: Map<string, Map<number, number>>,
  normes: NormaRepartiment[]
): number {
  if (!CODIS_PERSONAL_AGREGAT.has(codi)) return 0;
  const { imputat } = calcularImputatPersonal(
    normesPersonalLn(lnId, normes),
    vendesLn(directe, lnId)
  );
  return imputat;
}

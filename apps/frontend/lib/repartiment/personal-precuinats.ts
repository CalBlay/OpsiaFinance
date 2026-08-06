import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import type { NormaRepartiment } from "@prisma/client";

export const CODI_LN_PRECUINATS = "LN00004";

export const PERCENTATGES_SUPORT_PERSONAL_PRECUINATS = [
  { codiCentre: "CCC00007", nomCentre: "Cuina Central", percent: 5 },
  { codiCentre: "CCC00004", nomCentre: "Logística", percent: 10 },
  { codiCentre: "CCC00006", nomCentre: "Manteniment", percent: 10 },
  { codiCentre: "CCC00005", nomCentre: "Oficines Cal Blay", percent: 5 },
] as const;

export type SuportPersonalPrecuinats = {
  import: number;
  detall: string;
};

export function suportPersonalPrecuinatsDesDeCentres(
  costPerCentre: Map<string, number>
): SuportPersonalPrecuinats {
  let importSuport = 0;
  const parts: string[] = [];

  for (const regla of PERCENTATGES_SUPORT_PERSONAL_PRECUINATS) {
    const costCentre = costPerCentre.get(regla.codiCentre) ?? 0;
    const quota = costCentre * (regla.percent / 100);
    importSuport += quota;
    parts.push(
      `${regla.nomCentre} ${regla.percent}% × ${costCentre.toFixed(2)} = ${quota.toFixed(2)}`
    );
  }

  return {
    import: importSuport,
    detall: parts.join(" + "),
  };
}

export function esNormaPersonalPrecuinats(
  norma: NormaRepartiment,
  lnIdByCodi: Map<string, string>
): boolean {
  return (
    norma.concepteNode === NODE_COST_SALARIAL &&
    norma.tipus === "REPARTIMENT_PROPORCIONAL" &&
    norma.liniaNegociDestiId === lnIdByCodi.get(CODI_LN_PRECUINATS)
  );
}

export function calcularMovimentPersonalPrecuinats(
  normes: NormaRepartiment[],
  directe: Map<string, Map<number, number>>,
  lnIdByCodi: Map<string, string>,
  suport: SuportPersonalPrecuinats
): MovimentCalculat[] {
  const lnId = lnIdByCodi.get(CODI_LN_PRECUINATS);
  if (!lnId) return [];

  const norma = normes.find(
    (n) =>
      n.actiu &&
      n.liniaNegociDestiId === lnId &&
      n.concepteNode === NODE_COST_SALARIAL &&
      n.tipus === "REPARTIMENT_PROPORCIONAL"
  );
  if (!norma) return [];

  const sapPropi = directe.get(lnId)?.get(NODE_COST_SALARIAL) ?? 0;
  return [
    {
      normaId: norma.id,
      liniaNegociDestiId: lnId,
      concepteNode: NODE_COST_SALARIAL,
      importCalculat: sapPropi + suport.import,
      detallCalcul: `SAP ${sapPropi.toFixed(2)} + suport Precuinats (${suport.detall})`,
    },
  ];
}

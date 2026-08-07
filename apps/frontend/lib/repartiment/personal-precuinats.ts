import type { MovimentCalculat } from "@/lib/repartiment/compres-pool";
import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";
import type { NormaRepartiment } from "@prisma/client";

export const CODI_LN_PRECUINATS = "LN00004";

export const SUPORT_PERSONAL_PRECUINATS_CENTRES = [
  {
    codiCentre: "CCC00007",
    nomCentre: "Cuina Central",
    nomNorma: "Precuinats · suport CCC00007 · Cuina Central",
    ordre: 451,
    percentDefecte: 5,
  },
  {
    codiCentre: "CCC00004",
    nomCentre: "Logística",
    nomNorma: "Precuinats · suport CCC00004 · Logística",
    ordre: 452,
    percentDefecte: 10,
  },
  {
    codiCentre: "CCC00006",
    nomCentre: "Manteniment",
    nomNorma: "Precuinats · suport CCC00006 · Manteniment",
    ordre: 453,
    percentDefecte: 10,
  },
  {
    codiCentre: "CCC00005",
    nomCentre: "Oficines Cal Blay",
    nomNorma: "Precuinats · suport CCC00005 · Oficines Cal Blay",
    ordre: 454,
    percentDefecte: 5,
  },
] as const;

export type ReglaSuportPersonalPrecuinats = {
  codiCentre: string;
  nomCentre: string;
  percent: number;
};

export function esNormaSuportPersonalPrecuinats(nom: string | null): boolean {
  return SUPORT_PERSONAL_PRECUINATS_CENTRES.some((regla) => regla.nomNorma === nom);
}

export function reglesSuportPersonalPrecuinats(
  normes: Pick<NormaRepartiment, "nom" | "actiu" | "valorPercent">[]
): ReglaSuportPersonalPrecuinats[] {
  return SUPORT_PERSONAL_PRECUINATS_CENTRES.map((regla) => {
    const norma = normes.find((n) => n.nom === regla.nomNorma);
    return {
      codiCentre: regla.codiCentre,
      nomCentre: regla.nomCentre,
      percent: norma?.actiu ? Number(norma.valorPercent ?? 0) : 0,
    };
  });
}

export type SuportPersonalPrecuinats = {
  import: number;
  detall: string;
};

export function suportPersonalPrecuinatsDesDeCentres(
  costPerCentre: Map<string, number>,
  regles: ReglaSuportPersonalPrecuinats[]
): SuportPersonalPrecuinats {
  let importSuport = 0;
  const parts: string[] = [];

  for (const regla of regles) {
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
    norma.tipus === "PERCENT_POOL_CENTRAL" &&
    esNormaSuportPersonalPrecuinats(norma.nom) &&
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

  const norma = normes.find((n) => esNormaPersonalPrecuinats(n, lnIdByCodi));
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

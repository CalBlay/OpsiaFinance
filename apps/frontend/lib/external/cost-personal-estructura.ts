import { carregarCostPersonalDeptSc } from "@/lib/repartiment/personal-departaments-data";

export const CENTRE_LOGISTICA = "CCC00004" as const;
export const CENTRE_CUINA_CENTRAL = "CCC00007" as const;

export type PotCostEstructura = "gestio" | "preparacio" | "rentat";
export type CentreEstructuraKey = "logistica" | "cuina";

export type CostPersonalEstructuraLine = {
  deptCodi: string;
  deptNom: string;
  costPersonal: number;
  pot: PotCostEstructura | null;
};

export type CostPersonalEstructuraCentre = {
  key: CentreEstructuraKey;
  centre: { codi: string; nom: string };
  pots: { gestio: number; preparacio: number; rentat: number };
  lines: CostPersonalEstructuraLine[];
};

const CENTRE_BY_KEY: Record<CentreEstructuraKey, { codi: string; defaultNom: string }> = {
  logistica: { codi: CENTRE_LOGISTICA, defaultNom: "LOGISTICA" },
  cuina: { codi: CENTRE_CUINA_CENTRAL, defaultNom: "CUINA CENTRAL" },
};

/** Logística: Admin / Preparador / Rentador */
const POT_LOGISTICA_CODI: Record<string, PotCostEstructura> = {
  DCL0001: "gestio",
  DCL0002: "preparacio",
  DCL0003: "rentat",
};

/**
 * Cuina central:
 * Admin → gestió; Neteja → rentat; producció/càtering/pastisseria/bases → preparació.
 */
const POT_CUINA_CODI: Record<string, PotCostEstructura> = {
  DCC0001: "gestio",
  DCC0007: "rentat",
  DCC0004: "preparacio",
  DCC0005: "preparacio",
  DCC0006: "preparacio",
  DPP0002: "preparacio",
};

const POT_BY_NOM: Array<{ match: RegExp; pot: PotCostEstructura }> = [
  { match: /admin/i, pot: "gestio" },
  { match: /rentad|netej/i, pot: "rentat" },
  { match: /prepar|produc|cater|pastis|bases/i, pot: "preparacio" },
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function resolvePotForCentre(
  key: CentreEstructuraKey,
  deptCodi: string,
  deptNom: string
): PotCostEstructura | null {
  const codi = String(deptCodi || "")
    .trim()
    .toUpperCase();
  const map = key === "logistica" ? POT_LOGISTICA_CODI : POT_CUINA_CODI;
  if (codi && map[codi]) return map[codi];
  const nom = String(deptNom || "").trim();
  for (const row of POT_BY_NOM) {
    if (row.match.test(nom)) return row.pot;
  }
  return null;
}

export async function buildCostPersonalCentre(
  key: CentreEstructuraKey,
  year: number,
  month: number
): Promise<CostPersonalEstructuraCentre> {
  const meta = CENTRE_BY_KEY[key];
  const all = await carregarCostPersonalDeptSc(year, month);
  const rows = all.filter((r) => String(r.centreCodi || "").toUpperCase() === meta.codi);

  const centreNom = rows[0]?.centreNom || meta.defaultNom;
  const pots = { gestio: 0, preparacio: 0, rentat: 0 };
  const lines: CostPersonalEstructuraLine[] = [];

  for (const row of rows) {
    const pot = resolvePotForCentre(key, row.deptCodi, row.deptNom);
    const cost = round2(Number(row.costPersonal) || 0);
    lines.push({
      deptCodi: row.deptCodi,
      deptNom: row.deptNom,
      costPersonal: cost,
      pot,
    });
    if (pot) pots[pot] = round2(pots[pot] + cost);
  }

  lines.sort((a, b) => a.deptCodi.localeCompare(b.deptCodi) || a.deptNom.localeCompare(b.deptNom));

  return {
    key,
    centre: { codi: meta.codi, nom: centreNom },
    pots,
    lines,
  };
}

/** Compat: mateix shape que l’API logística original. */
export async function buildCostPersonalLogistica(year: number, month: number) {
  const c = await buildCostPersonalCentre("logistica", year, month);
  return {
    year,
    month,
    centre: c.centre,
    pots: c.pots,
    lines: c.lines,
  };
}

export async function buildCostPersonalCuina(year: number, month: number) {
  const c = await buildCostPersonalCentre("cuina", year, month);
  return {
    year,
    month,
    centre: c.centre,
    pots: c.pots,
    lines: c.lines,
  };
}

export function assertExternalApiKey(authHeader: string | null): boolean {
  const expected = String(process.env.OPSIA_EXTERNAL_API_KEY || "").trim();
  if (!expected) return false;
  const raw = String(authHeader || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return false;
  const token = raw.slice(7).trim();
  return token.length > 0 && token === expected;
}

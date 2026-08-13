import { NODE_COMPRES, NODE_COST_GESTIO } from "@/lib/repartiment/nodes";

export type NormaSeed = {
  nom: string;
  tipus:
    | "PERCENT_VENDES_PROPIES"
    | "PERCENT_POOL_CENTRAL"
    | "IMPORT_FIX"
    | "REPARTIMENT_PROPORCIONAL"
    | "RESTEM";
  destCodi: string;
  concepteNode: number;
  valorPercent?: number;
  valorImport?: number;
  grupCodi?: string;
  ordre: number;
};

/** Grups per repartiments proporcionals de compres. */
export const GRUPS_REPARTIMENT = [
  {
    codi: "GRUP_COMPRES_CENTRAL",
    nom: "Compres Central (Empresa + Casaments)",
    membres: ["LN00002", "LN00003"],
  },
] as const;

/**
 * Reconstrucció LN per LN — normes confirmades (personal SC via matriu dept., no aquí).
 */
export const NORMES_PER_LN: Record<string, NormaSeed[]> = {
  LN00000: [
    {
      nom: "Central · compres s/ ingressos explotació",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00000",
      concepteNode: NODE_COMPRES,
      valorPercent: 25,
      ordre: 110,
    },
    {
      nom: "Central · gestió s/ cost gestió SAP (Agenda)",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00000",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 5,
      ordre: 113,
    },
  ],
  LN00002: [
    {
      nom: "Empresa · compres pool Central + SAP propi",
      tipus: "REPARTIMENT_PROPORCIONAL",
      destCodi: "LN00002",
      concepteNode: NODE_COMPRES,
      grupCodi: "GRUP_COMPRES_CENTRAL",
      ordre: 310,
    },
    {
      nom: "Empresa · gestió s/ cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00002",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 35,
      ordre: 321,
    },
  ],
  LN00003: [
    {
      nom: "Casaments · compres pool Central + SAP propi",
      tipus: "REPARTIMENT_PROPORCIONAL",
      destCodi: "LN00003",
      concepteNode: NODE_COMPRES,
      grupCodi: "GRUP_COMPRES_CENTRAL",
      ordre: 315,
    },
    {
      nom: "Casaments · gestió s/ cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00003",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 15,
      ordre: 331,
    },
  ],
  LN00004: [
    {
      nom: "Precuinats · compres s/ ingressos explotació",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00004",
      concepteNode: NODE_COMPRES,
      valorPercent: 45,
      ordre: 450,
    },
    {
      nom: "Precuinats · gestió s/ cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00004",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 20,
      ordre: 455,
    },
  ],
  LN00005: [
    {
      nom: "Foodlovers · compres s/ ingressos + SAP compres i altres aprov.",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00005",
      concepteNode: NODE_COMPRES,
      valorPercent: 28,
      ordre: 550,
    },
    {
      nom: "Foodlovers · gestió s/ cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00005",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 10,
      ordre: 553,
    },
  ],
  LN00006: [
    {
      nom: "Green Vita · compres s/ ingressos + SAP compres i altres aprov.",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00006",
      concepteNode: NODE_COMPRES,
      valorPercent: 25,
      ordre: 650,
    },
    {
      nom: "Green Vita · gestió s/ cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00006",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 5,
      ordre: 653,
    },
  ],
};

export function normesConfirmades(): NormaSeed[] {
  return Object.values(NORMES_PER_LN).flat();
}

/** Noms antics amb quantitat → noms sense xifres (els valors són a la norma, editables). */
export const RENOMBRA_NOMS_NORMES_SENSE_QUANTITAT: Record<string, string> = {
  "Central · compres 25% ingressos explotació": "Central · compres s/ ingressos explotació",
  "Precuinats · compres 45% ingressos explotació": "Precuinats · compres s/ ingressos explotació",
  "Foodlovers · compres 28% ingressos + SAP compres i altres aprov.":
    "Foodlovers · compres s/ ingressos + SAP compres i altres aprov.",
  "Green Vita · compres 25% ingressos + SAP compres i altres aprov.":
    "Green Vita · compres s/ ingressos + SAP compres i altres aprov.",
  "Green Vita · 25% personal centre Admin restaurants (LN00001)":
    "Green Vita · personal centre Admin restaurants (LN00001)",
  "Central · gestió % cost gestió SAP (Agenda)": "Central · gestió s/ cost gestió SAP (Agenda)",
  "Empresa · gestió % cost gestió Central SAP": "Empresa · gestió s/ cost gestió Central SAP",
  "Casaments · gestió % cost gestió Central SAP": "Casaments · gestió s/ cost gestió Central SAP",
  "Precuinats · gestió % cost gestió Central SAP": "Precuinats · gestió s/ cost gestió Central SAP",
  "Foodlovers · gestió % cost gestió Central SAP": "Foodlovers · gestió s/ cost gestió Central SAP",
  "Green Vita · gestió % cost gestió Central SAP": "Green Vita · gestió s/ cost gestió Central SAP",
};

/** Treu xifres del nom (el %/import van al camp Valor). */
export function nomNormaSenseQuantitat(nom: string): string {
  const mapped = RENOMBRA_NOMS_NORMES_SENSE_QUANTITAT[nom];
  if (mapped) return mapped;
  return nom
    .replace(/gestió\s+\d+(?:[.,]\d+)?\s*%\s+/gi, "gestió s/ ")
    .replace(/gestió\s+%\s+/gi, "gestió s/ ")
    .replace(/\s*\d+(?:[.,]\d+)?\s*%/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+·\s+/g, " · ")
    .trim();
}

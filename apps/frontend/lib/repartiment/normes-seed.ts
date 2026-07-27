import { NODE_COMPRES, NODE_COST_GESTIO, NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";

export type NormaSeed = {
  nom: string;
  tipus:
    | "PERCENT_VENDES_PROPIES"
    | "PERCENT_POOL_CENTRAL"
    | "IMPORT_FIX"
    | "REPARTIMENT_PROPORCIONAL";
  destCodi: string;
  concepteNode: number;
  valorPercent?: number;
  valorImport?: number;
  grupCodi?: string;
  ordre: number;
};

/** Grups per repartiments proporcionals (es crearan buits fins que afegim normes). */
export const GRUPS_REPARTIMENT = [
  {
    codi: "GRUP_COMPRES_CENTRAL",
    nom: "Compres Central (Empresa + Casaments)",
    membres: ["LN00002", "LN00003"],
  },
  {
    codi: "GRUP_PERSONAL_CENTRAL",
    nom: "Personal Central (Empresa + Casaments + Precuinats)",
    membres: ["LN00002", "LN00003", "LN00004"],
  },
] as const;

/**
 * Reconstrucció LN per LN — només normes confirmades.
 */
export const NORMES_PER_LN: Record<string, NormaSeed[]> = {
  LN00000: [
    {
      nom: "Central · compres 25% ingressos explotació",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00000",
      concepteNode: NODE_COMPRES,
      valorPercent: 25,
      ordre: 110,
    },
    {
      nom: "Central · estructura fixa personal",
      tipus: "IMPORT_FIX",
      destCodi: "LN00000",
      concepteNode: NODE_COST_SALARIAL,
      valorImport: -5000,
      ordre: 111,
    },
    {
      nom: "Central · personal 15% ingressos explotació",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00000",
      concepteNode: NODE_COST_SALARIAL,
      valorPercent: 15,
      ordre: 112,
    },
    {
      nom: "Central · gestió 10% cost gestió SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00000",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 10,
      ordre: 113,
    },
  ],
  LN00001: [
    {
      nom: "Restaurants · estructura fixa personal",
      tipus: "IMPORT_FIX",
      destCodi: "LN00001",
      concepteNode: NODE_COST_SALARIAL,
      valorImport: -20000,
      ordre: 210,
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
      nom: "Empresa · personal SAP + pool Central proporcional",
      tipus: "REPARTIMENT_PROPORCIONAL",
      destCodi: "LN00002",
      concepteNode: NODE_COST_SALARIAL,
      grupCodi: "GRUP_PERSONAL_CENTRAL",
      ordre: 320,
    },
    {
      nom: "Empresa · gestió 44% cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00002",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 44,
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
      nom: "Casaments · personal SAP + pool Central proporcional",
      tipus: "REPARTIMENT_PROPORCIONAL",
      destCodi: "LN00003",
      concepteNode: NODE_COST_SALARIAL,
      grupCodi: "GRUP_PERSONAL_CENTRAL",
      ordre: 330,
    },
    {
      nom: "Casaments · gestió 14% cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00003",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 14,
      ordre: 331,
    },
  ],
  LN00004: [
    {
      nom: "Precuinats · compres 45% ingressos explotació",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00004",
      concepteNode: NODE_COMPRES,
      valorPercent: 45,
      ordre: 450,
    },
    {
      nom: "Precuinats · personal SAP + pool Central proporcional",
      tipus: "REPARTIMENT_PROPORCIONAL",
      destCodi: "LN00004",
      concepteNode: NODE_COST_SALARIAL,
      grupCodi: "GRUP_PERSONAL_CENTRAL",
      ordre: 451,
    },
    {
      nom: "Precuinats · gestió 30% cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00004",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 30,
      ordre: 452,
    },
  ],
  LN00005: [
    {
      nom: "Foodlovers · compres 28% ingressos + SAP compres i altres aprov.",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00005",
      concepteNode: NODE_COMPRES,
      valorPercent: 28,
      ordre: 550,
    },
    {
      nom: "Foodlovers · estructura fixa personal",
      tipus: "IMPORT_FIX",
      destCodi: "LN00005",
      concepteNode: NODE_COST_SALARIAL,
      valorImport: -5000,
      ordre: 551,
    },
    {
      nom: "Foodlovers · personal 17% ingressos + SAP sous/SS",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00005",
      concepteNode: NODE_COST_SALARIAL,
      valorPercent: 17,
      ordre: 552,
    },
    {
      nom: "Foodlovers · gestió 8% cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00005",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 8,
      ordre: 553,
    },
  ],
  LN00006: [
    {
      nom: "Green Vita · compres 25% ingressos + SAP compres i altres aprov.",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00006",
      concepteNode: NODE_COMPRES,
      valorPercent: 25,
      ordre: 650,
    },
    {
      nom: "Green Vita · estructura fixa personal",
      tipus: "IMPORT_FIX",
      destCodi: "LN00006",
      concepteNode: NODE_COST_SALARIAL,
      valorImport: -5000,
      ordre: 651,
    },
    {
      nom: "Green Vita · personal 15% ingressos explotació",
      tipus: "PERCENT_VENDES_PROPIES",
      destCodi: "LN00006",
      concepteNode: NODE_COST_SALARIAL,
      valorPercent: 15,
      ordre: 652,
    },
    {
      nom: "Green Vita · gestió 4% cost gestió Central SAP",
      tipus: "PERCENT_POOL_CENTRAL",
      destCodi: "LN00006",
      concepteNode: NODE_COST_GESTIO,
      valorPercent: 4,
      ordre: 653,
    },
  ],
};

export function normesConfirmades(): NormaSeed[] {
  return Object.values(NORMES_PER_LN).flat();
}

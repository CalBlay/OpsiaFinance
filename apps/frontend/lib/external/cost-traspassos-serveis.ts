import { db } from "@/lib/db";
import { assertExternalApiKey } from "@/lib/external/cost-personal-estructura";

export { assertExternalApiKey };

export const CENTRE_ORIGEN_COST_SERVEIS = "CCC00007" as const;
export const LN_DESTI_COST_SERVEIS = ["LN00002", "LN00003", "LN00007"] as const;
export const CENTRE_FOODLOVERS = "CCF00001" as const;
export const DEPARTAMENT_CATERING = "DCC0005" as const;

export type GrupOrigenCostServeis = "CUINA" | "CATERING";
export type GrupDestiCostServeis = "EMPRESA" | "CASAMENTS" | "FOODLOVERS" | "CATERING";
export type EstatTraspassosCostServeis = "CONFIRMAT" | "BORRADOR" | "SENSE_DADES";

export type CostTraspassosServeisLine = {
  id: string;
  origenGrup: GrupOrigenCostServeis;
  origenCentreCodi: string;
  origenCentreNom: string;
  origenDeptCodi: string | null;
  origenDeptNom: string | null;
  destiCentreCodi: string;
  destiCentreNom: string;
  destiDeptCodi: string | null;
  destiDeptNom: string | null;
  destiGrup: GrupDestiCostServeis;
  destiLnCodi: string;
  destiLnNom: string;
  minuts: number;
  hores: number;
  tarifaHora: number;
  importTotal: number;
};

export type CostTraspassosServeisSummary = {
  origenGrup: GrupOrigenCostServeis;
  origenDeptCodi: string | null;
  origenDeptNom: string;
  destiCentreCodi: string;
  destiCentreNom: string;
  destiDeptCodi: string | null;
  destiDeptNom: string | null;
  destiGrup: GrupDestiCostServeis;
  destiLnCodi: string;
  destiLnNom: string;
  minuts: number;
  hores: number;
  importTotal: number;
  moviments: number;
};

export type CostTraspassosServeisResponse = {
  year: number;
  month: number;
  estat: EstatTraspassosCostServeis;
  sourceExecutionId: string | null;
  sourceConfirmedAt: string | null;
  filters: {
    origenGrups: GrupOrigenCostServeis[];
    destiGrups: GrupDestiCostServeis[];
  };
  totals: {
    minuts: number;
    hores: number;
    importTotal: number;
    moviments: number;
  };
  summary: CostTraspassosServeisSummary[];
  lines: CostTraspassosServeisLine[];
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function origenGrup(input: {
  departamentCodi: string | null;
  departamentNom: string | null;
}): GrupOrigenCostServeis {
  if (
    input.departamentCodi === "DCC0005" ||
    /catering|càtering/i.test(input.departamentNom ?? "")
  ) {
    return "CATERING";
  }
  return "CUINA";
}

function destiGrup(input: {
  centreCodi: string;
  departamentCodi: string | null;
  lnCodi: string;
}): GrupDestiCostServeis {
  if (input.centreCodi === "CCC00007" && input.departamentCodi === DEPARTAMENT_CATERING) {
    return "CATERING";
  }
  if (input.centreCodi === CENTRE_FOODLOVERS || input.lnCodi === "LN00007") {
    return "FOODLOVERS";
  }
  return input.lnCodi === "LN00003" ? "CASAMENTS" : "EMPRESA";
}

function emptyResponse(
  year: number,
  month: number,
  estat: EstatTraspassosCostServeis,
  sourceExecutionId: string | null = null
): CostTraspassosServeisResponse {
  return {
    year,
    month,
    estat,
    sourceExecutionId,
    sourceConfirmedAt: null,
    filters: {
      origenGrups: ["CUINA", "CATERING"],
      destiGrups: ["EMPRESA", "CASAMENTS", "FOODLOVERS", "CATERING"],
    },
    totals: { minuts: 0, hores: 0, importTotal: 0, moviments: 0 },
    summary: [],
    lines: [],
  };
}

/**
 * Traspassos confirmats de Cuina Central que poden solapar-se amb el personal
 * directe dels esdeveniments. No retorna la resta de moviments d'Opsia.
 */
export async function buildCostTraspassosServeis(
  year: number,
  month: number
): Promise<CostTraspassosServeisResponse> {
  const period = await db.period.findFirst({
    where: { any: year, mes: month },
    select: {
      execucioTraspassPersonal: {
        select: { id: true, estat: true, confirmatAt: true },
      },
    },
  });
  const execucio = period?.execucioTraspassPersonal;
  if (!execucio) return emptyResponse(year, month, "SENSE_DADES");
  if (execucio.estat !== "CONFIRMAT") {
    return emptyResponse(year, month, "BORRADOR", execucio.id);
  }

  const moviments = await db.movimentTraspassPersonal.findMany({
    where: {
      execucioId: execucio.id,
      // Només Cuina Central; no es limita el departament d'origen.
      centreOrigen: { codi: CENTRE_ORIGEN_COST_SERVEIS },
      OR: [
        { centreDesti: { liniaNegoci: { codi: { in: [...LN_DESTI_COST_SERVEIS] } } } },
        { centreDesti: { codi: CENTRE_FOODLOVERS } },
        {
          centreDesti: { codi: "CCC00007" },
          departamentDesti: { codi: DEPARTAMENT_CATERING },
        },
      ],
    },
    select: {
      id: true,
      minuts: true,
      hores: true,
      tarifaHora: true,
      import_: true,
      centreOrigen: { select: { codi: true, nom: true } },
      departamentOrigen: { select: { codi: true, nom: true } },
      centreDesti: {
        select: {
          codi: true,
          nom: true,
          liniaNegoci: { select: { codi: true, nom: true } },
        },
      },
      departamentDesti: { select: { codi: true, nom: true } },
    },
    orderBy: [
      { centreOrigen: { nom: "asc" } },
      { departamentOrigen: { nom: "asc" } },
      { centreDesti: { liniaNegoci: { codi: "asc" } } },
      { centreDesti: { nom: "asc" } },
    ],
  });

  const lines: CostTraspassosServeisLine[] = moviments.map((moviment) => ({
    id: moviment.id,
    origenGrup: origenGrup({
      departamentCodi: moviment.departamentOrigen?.codi ?? null,
      departamentNom: moviment.departamentOrigen?.nom ?? null,
    }),
    origenCentreCodi: moviment.centreOrigen.codi,
    origenCentreNom: moviment.centreOrigen.nom,
    origenDeptCodi: moviment.departamentOrigen?.codi ?? null,
    origenDeptNom: moviment.departamentOrigen?.nom ?? null,
    destiCentreCodi: moviment.centreDesti.codi,
    destiCentreNom: moviment.centreDesti.nom,
    destiDeptCodi: moviment.departamentDesti?.codi ?? null,
    destiDeptNom: moviment.departamentDesti?.nom ?? null,
    destiGrup: destiGrup({
      centreCodi: moviment.centreDesti.codi,
      departamentCodi: moviment.departamentDesti?.codi ?? null,
      lnCodi: moviment.centreDesti.liniaNegoci.codi,
    }),
    destiLnCodi: moviment.centreDesti.liniaNegoci.codi,
    destiLnNom: moviment.centreDesti.liniaNegoci.nom,
    minuts: round2(Number(moviment.minuts)),
    hores: round2(Number(moviment.hores)),
    tarifaHora: round2(Number(moviment.tarifaHora)),
    importTotal: round2(Number(moviment.import_)),
  }));

  const summaryMap = new Map<string, CostTraspassosServeisSummary>();
  for (const line of lines) {
    const key = [
      line.origenGrup,
      line.origenDeptCodi ?? line.origenDeptNom ?? line.origenCentreCodi,
      line.destiCentreCodi,
      line.destiDeptCodi ?? "",
    ].join("|");
    const row = summaryMap.get(key) ?? {
      origenGrup: line.origenGrup,
      origenDeptCodi: line.origenDeptCodi,
      origenDeptNom: line.origenDeptNom || line.origenCentreNom,
      destiCentreCodi: line.destiCentreCodi,
      destiCentreNom: line.destiCentreNom,
      destiDeptCodi: line.destiDeptCodi,
      destiDeptNom: line.destiDeptNom,
      destiGrup: line.destiGrup,
      destiLnCodi: line.destiLnCodi,
      destiLnNom: line.destiLnNom,
      minuts: 0,
      hores: 0,
      importTotal: 0,
      moviments: 0,
    };
    row.minuts += line.minuts;
    row.hores += line.hores;
    row.importTotal += line.importTotal;
    row.moviments += 1;
    summaryMap.set(key, row);
  }

  const summary = [...summaryMap.values()]
    .map((row) => ({
      ...row,
      minuts: round2(row.minuts),
      hores: round2(row.hores),
      importTotal: round2(row.importTotal),
    }))
    .sort(
      (a, b) =>
        a.destiLnCodi.localeCompare(b.destiLnCodi) ||
        a.origenDeptNom.localeCompare(b.origenDeptNom) ||
        a.destiCentreNom.localeCompare(b.destiCentreNom)
    );

  return {
    year,
    month,
    estat: "CONFIRMAT",
    sourceExecutionId: execucio.id,
    sourceConfirmedAt: execucio.confirmatAt?.toISOString() ?? null,
    filters: {
      origenGrups: ["CUINA", "CATERING"],
      destiGrups: ["EMPRESA", "CASAMENTS", "FOODLOVERS", "CATERING"],
    },
    totals: {
      minuts: round2(lines.reduce((sum, line) => sum + line.minuts, 0)),
      hores: round2(lines.reduce((sum, line) => sum + line.hores, 0)),
      importTotal: round2(lines.reduce((sum, line) => sum + line.importTotal, 0)),
      moviments: lines.length,
    },
    summary,
    lines,
  };
}

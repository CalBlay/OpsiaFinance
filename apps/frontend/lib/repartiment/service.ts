import { carregarBaseGestioPersonal } from "@/lib/cost-personal-centre/base-gestio";
import { db } from "@/lib/db";
import { type RangMesos, prismaPeriodFilter } from "@/lib/periodes";
import {
  calcularPesosGrups,
  calcularPesosGrupsFromDirecte,
  getDirectePerLnNode,
  getDirectePerLnNodeMany,
} from "@/lib/repartiment/bases-vendes";
import {
  aplicarDeltaDesti,
  balanceZeroSumCentral,
  validarZeroSumDeltas,
} from "@/lib/repartiment/gestio-consultes";
import { calcularMoviments, movimentsADeltas } from "@/lib/repartiment/motor";
import { CODI_LN_CENTRAL } from "@/lib/repartiment/nodes";
import {
  getNormesVigents,
  syncGrupsRepartiment,
  syncNormaPersonalPrecuinats,
} from "@/lib/repartiment/normes-default";
import {
  SUPORT_PERSONAL_PRECUINATS_CENTRES,
  type SuportPersonalPrecuinats,
  reglesSuportPersonalPrecuinats,
  suportPersonalPrecuinatsDesDeCentres,
} from "@/lib/repartiment/personal-precuinats";
import type { NormaRepartiment } from "@prisma/client";

export function validarZeroSumMoviments(
  moviments: { liniaNegociDestiId: string; concepteNode: number; importCalculat: number }[],
  centralId: string
) {
  const perLn = new Map<string, Map<number, number>>();
  for (const m of moviments) {
    // No acumular moviments amb destí Central: la columna és sempre residual.
    if (m.liniaNegociDestiId === centralId) continue;
    aplicarDeltaDesti(perLn, m.liniaNegociDestiId, m.concepteNode, m.importCalculat);
  }
  balanceZeroSumCentral(perLn, centralId);
  return validarZeroSumDeltas(perLn);
}

type DirectePerLn = Map<string, Map<number, number>>;

type ExecucioDeltaSelect = {
  pesos: { grupId: string; liniaNegociId: string; pesOverride: unknown }[];
  moviments: {
    liniaNegociDestiId: string;
    concepteNode: number;
    importOverride: unknown;
  }[];
};

type DepsComunsDelta = {
  normes: Awaited<ReturnType<typeof getNormesVigents>>;
  lnIdByCodi: Map<string, string>;
  grupCompresId: string;
  grupPersonalId: string;
  grups: { id: string; membres: { liniaNegociId: string }[] }[];
};

type PeriodeSuportPrecuinats = {
  id: string;
  any: number;
  mes: number;
};

/**
 * Suport de personal que Precuinats consumeix de Central, calculat sobre els
 * costos Gestió dels centres del mateix mes.
 */
async function carregarSuportPersonalPrecuinats(
  periods: PeriodeSuportPrecuinats[],
  centralLnId: string,
  normes: Pick<NormaRepartiment, "nom" | "actiu" | "valorPercent">[]
): Promise<Map<string, SuportPersonalPrecuinats>> {
  const regles = reglesSuportPersonalPrecuinats(normes);
  const codisCentre = SUPORT_PERSONAL_PRECUINATS_CENTRES.map((r) => r.codiCentre);
  const centres = await db.centre.findMany({
    where: { liniaNegociId: centralLnId, codi: { in: codisCentre } },
    select: { id: true, codi: true },
  });
  const idByCodi = new Map(centres.map((centre) => [centre.codi, centre.id]));
  const centreIds = centres.map((centre) => centre.id);

  const resultats = await Promise.all(
    periods.map(async (period) => {
      const base = await carregarBaseGestioPersonal({
        any: period.any,
        mes: period.mes,
        centreIds,
      });
      const costPerCentre = new Map<string, number>();
      for (const regla of regles) {
        const centreId = idByCodi.get(regla.codiCentre);
        const cost = centreId
          ? (base.get(centreId)?.get(period.mes)?.imports.costPersonal ?? 0)
          : 0;
        costPerCentre.set(regla.codiCentre, cost);
      }
      return [period.id, suportPersonalPrecuinatsDesDeCentres(costPerCentre, regles)] as const;
    })
  );

  return new Map(resultats);
}

function deltasDesDeDirecte(
  centralId: string,
  directe: DirectePerLn,
  deps: DepsComunsDelta,
  execucio: ExecucioDeltaSelect | null | undefined,
  suportPrecuinats: SuportPersonalPrecuinats
): Map<string, Map<number, number>> {
  const pesosCalc = calcularPesosGrupsFromDirecte(directe, deps.grups);

  const pesOverrides = new Map<string, number>();
  for (const p of execucio?.pesos ?? []) {
    if (p.pesOverride != null) {
      pesOverrides.set(`${p.grupId}:${p.liniaNegociId}`, Number(p.pesOverride));
    }
  }

  const moviments = movimentsADeltas(
    calcularMoviments(
      deps.normes,
      directe,
      centralId,
      pesosCalc,
      pesOverrides,
      deps.lnIdByCodi,
      deps.grupCompresId,
      deps.grupPersonalId,
      suportPrecuinats
    ),
    directe
  );

  const perLn = new Map<string, Map<number, number>>();
  for (const m of moviments) {
    if (m.liniaNegociDestiId === centralId) continue;
    aplicarDeltaDesti(perLn, m.liniaNegociDestiId, m.concepteNode, m.importCalculat);
  }

  for (const o of execucio?.moviments ?? []) {
    if (o.liniaNegociDestiId === centralId || o.importOverride == null) continue;
    let perNode = perLn.get(o.liniaNegociDestiId);
    if (!perNode) {
      perNode = new Map();
      perLn.set(o.liniaNegociDestiId, perNode);
    }
    perNode.set(o.concepteNode, Number(o.importOverride));
  }

  balanceZeroSumCentral(perLn, centralId);
  return perLn;
}

async function carregarDepsComunsDelta(): Promise<DepsComunsDelta> {
  const [normes, lns, grupCompres, grupPersonal, grups] = await Promise.all([
    getNormesVigents(),
    db.liniaNegoci.findMany({ select: { id: true, codi: true } }),
    db.repartimentGrup.findUnique({
      where: { codi: "GRUP_COMPRES_CENTRAL" },
      select: { id: true },
    }),
    db.repartimentGrup.findUnique({
      where: { codi: "GRUP_PERSONAL_CENTRAL" },
      select: { id: true },
    }),
    db.repartimentGrup.findMany({
      where: { isActive: true },
      include: { membres: { orderBy: { ordre: "asc" } } },
    }),
  ]);

  return {
    normes,
    lnIdByCodi: new Map(lns.map((l) => [l.codi, l.id])),
    grupCompresId: grupCompres?.id ?? "",
    grupPersonalId: grupPersonal?.id ?? "",
    grups,
  };
}

export async function calcularExecucioRepartiment(periodId: string) {
  const [central, period] = await Promise.all([
    db.liniaNegoci.findUnique({ where: { codi: CODI_LN_CENTRAL } }),
    db.period.findUnique({ where: { id: periodId }, select: { id: true, any: true, mes: true } }),
  ]);
  if (!central) throw new Error("LN00000 no trobada.");
  if (!period) throw new Error("Període no trobat.");

  await syncGrupsRepartiment();
  await syncNormaPersonalPrecuinats();
  const normes = await getNormesVigents();
  const directe = await getDirectePerLnNode(periodId);
  const suportPrecuinats = (
    await carregarSuportPersonalPrecuinats([period], central.id, normes)
  ).get(period.id) ?? { import: 0, detall: "Sense cost als centres de suport" };
  // Reutilitza directe ja carregat (abans calcularPesosGrups tornava a demanar-lo).
  const pesosCalc = await calcularPesosGrups(periodId, directe);

  const [lns, grupCompres, grupPersonal] = await Promise.all([
    db.liniaNegoci.findMany({ select: { id: true, codi: true } }),
    db.repartimentGrup.findUnique({
      where: { codi: "GRUP_COMPRES_CENTRAL" },
      select: { id: true },
    }),
    db.repartimentGrup.findUnique({
      where: { codi: "GRUP_PERSONAL_CENTRAL" },
      select: { id: true },
    }),
  ]);
  const lnIdByCodi = new Map(lns.map((l) => [l.codi, l.id]));
  const grupCompresId = grupCompres?.id ?? "";
  const grupPersonalId = grupPersonal?.id ?? "";

  const execucio = await db.execucioRepartiment.upsert({
    where: { periodId },
    update: { calculatAt: new Date(), estat: "BORRADOR" },
    create: { periodId, calculatAt: new Date(), estat: "BORRADOR" },
  });

  const pesOverrides = new Map<string, number>();
  const pesAnterior = await db.pesRepartiment.findMany({ where: { execucioId: execucio.id } });
  for (const p of pesAnterior) {
    if (p.pesOverride != null) {
      pesOverrides.set(`${p.grupId}:${p.liniaNegociId}`, Number(p.pesOverride));
    }
  }

  await db.pesRepartiment.deleteMany({ where: { execucioId: execucio.id } });
  await db.movimentRepartiment.deleteMany({ where: { execucioId: execucio.id } });

  if (pesosCalc.length) {
    await db.pesRepartiment.createMany({
      data: pesosCalc.map((p) => ({
        execucioId: execucio.id,
        grupId: p.grupId,
        liniaNegociId: p.liniaNegociId,
        vendesBase: p.vendesBase,
        pesCalculat: p.pesCalculat,
      })),
    });
  }

  const movimentsBruts = calcularMoviments(
    normes,
    directe,
    central.id,
    pesosCalc,
    pesOverrides,
    lnIdByCodi,
    grupCompresId,
    grupPersonalId,
    suportPrecuinats
  );
  const moviments = movimentsADeltas(movimentsBruts, directe);
  const zeroSum = validarZeroSumMoviments(moviments, central.id);
  if (!zeroSum.ok) {
    const detall = zeroSum.desquadraments
      .map((d) => `node ${d.node}: ${d.suma.toFixed(2)} €`)
      .join("; ");
    console.warn(`[repartiment] Zero-sum no quadra (${periodId}): ${detall}`);
  }

  if (moviments.length) {
    await db.movimentRepartiment.createMany({
      data: moviments.map((m) => ({
        execucioId: execucio.id,
        normaId: m.normaId,
        liniaNegociDestiId: m.liniaNegociDestiId,
        concepteNode: m.concepteNode,
        importCalculat: m.importCalculat,
        detallCalcul: m.detallCalcul,
      })),
    });
  }

  return db.execucioRepartiment.findUnique({
    where: { id: execucio.id },
    include: {
      period: true,
      pesos: {
        include: {
          liniaNegoci: { select: { codi: true, nom: true } },
          grup: { select: { codi: true, nom: true } },
        },
      },
      moviments: {
        include: {
          liniaNegociDesti: { select: { codi: true, nom: true } },
          norma: { select: { nom: true, tipus: true } },
        },
        orderBy: { concepteNode: "asc" },
      },
    },
  });
}

export async function confirmarExecucioRepartiment(execucioId: string, userId: string) {
  return db.execucioRepartiment.update({
    where: { id: execucioId },
    data: { estat: "CONFIRMAT", confirmatAt: new Date(), confirmatPer: userId },
  });
}

/**
 * Mapa node → delta gestió per LN (només execucions confirmades).
 * Es recalcula en viu (imputació, no substitució) amb Central residual zero-sum
 * → Directe i Gestió tenen el mateix total empresa; només canvia el pes per LN.
 *
 * Carrega normes/grups/dades/execucions en batch (no N recàlculs amb 2× P&L cadascun).
 */
export async function getDeltasGestioPerLn(
  periodIds: string[]
): Promise<Map<string, Map<string, Map<number, number>>>> {
  if (!periodIds.length) return new Map();

  const central = await db.liniaNegoci.findUnique({
    where: { codi: CODI_LN_CENTRAL },
    select: { id: true },
  });
  if (!central) return new Map();

  const confirmats = await db.execucioRepartiment.findMany({
    where: { periodId: { in: periodIds }, estat: "CONFIRMAT" },
    select: { periodId: true },
  });
  const confirmatsIds = confirmats.map((c) => c.periodId);
  if (!confirmatsIds.length) return new Map();

  const [deps, directeByPeriod, execucions, periods] = await Promise.all([
    carregarDepsComunsDelta(),
    getDirectePerLnNodeMany(confirmatsIds),
    db.execucioRepartiment.findMany({
      where: { periodId: { in: confirmatsIds } },
      select: {
        periodId: true,
        pesos: { select: { grupId: true, liniaNegociId: true, pesOverride: true } },
        moviments: {
          where: { importOverride: { not: null } },
          select: {
            liniaNegociDestiId: true,
            concepteNode: true,
            importOverride: true,
          },
        },
      },
    }),
    db.period.findMany({
      where: { id: { in: confirmatsIds } },
      select: { id: true, any: true, mes: true },
    }),
  ]);

  const execByPeriod = new Map(execucions.map((e) => [e.periodId, e]));
  const suportByPeriod = await carregarSuportPersonalPrecuinats(periods, central.id, deps.normes);
  const result = new Map<string, Map<string, Map<number, number>>>();

  for (const periodId of confirmatsIds) {
    const directe = directeByPeriod.get(periodId) ?? new Map();
    result.set(
      periodId,
      deltasDesDeDirecte(
        central.id,
        directe,
        deps,
        execByPeriod.get(periodId),
        suportByPeriod.get(periodId) ?? { import: 0, detall: "Sense cost als centres de suport" }
      )
    );
  }
  return result;
}

/** Suma deltas de diversos mesos per LN (consulta acumulada). */
export function sumarDeltasGestio(
  perPeriode: Map<string, Map<string, Map<number, number>>>,
  lnId: string,
  node: number
): number {
  let sum = 0;
  for (const perLn of perPeriode.values()) {
    sum += perLn.get(lnId)?.get(node) ?? 0;
  }
  return sum;
}

export interface InfoGestioConsulta {
  mesosAmbDades: number;
  mesosConfirmats: number;
  teGestio: boolean;
  nomsConfirmats: string[];
  nomsPendents: string[];
}

/** Estat del repartiment confirmat per al avís de consulta gestió. */
export async function getInfoGestioConsulta(
  any: number,
  rang: RangMesos
): Promise<InfoGestioConsulta> {
  const periods = await db.period.findMany({
    where: {
      ...prismaPeriodFilter(any, rang),
      dadesResultat: { some: {} },
    },
    orderBy: { mes: "asc" },
    select: {
      nom: true,
      execucioRepartiment: { select: { estat: true } },
    },
  });

  const confirmats = periods.filter((p) => p.execucioRepartiment?.estat === "CONFIRMAT");
  const pendents = periods.filter((p) => p.execucioRepartiment?.estat !== "CONFIRMAT");

  return {
    mesosAmbDades: periods.length,
    mesosConfirmats: confirmats.length,
    teGestio: confirmats.length > 0,
    nomsConfirmats: confirmats.map((p) => p.nom),
    nomsPendents: pendents.map((p) => p.nom),
  };
}

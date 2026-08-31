import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { type RangMesos, prismaPeriodFilter } from "@/lib/periodes";
import {
  calcularPesosGrups,
  calcularPesosGrupsFromDirecte,
  getDirectePerLnNode,
  getDirectePerLnNodeMany,
} from "@/lib/repartiment/bases-vendes";
import {
  NODES_REPARTIMENT_GESTIO_ACTIUS,
  REPARTIMENT_APLICAT_A_GESTIO,
} from "@/lib/repartiment/constants";
import {
  NODES_INVARIANT_EMPRESA,
  aplicarDeltaDesti,
  balanceZeroSumCentral,
  validarZeroSumDeltas,
} from "@/lib/repartiment/gestio-consultes";
import type { InfoGestioConsulta } from "@/lib/repartiment/info-gestio";
import {
  type ContextPersonalDept,
  calcularMoviments,
  movimentsADeltas,
} from "@/lib/repartiment/motor";
import { CODI_LN_CENTRAL } from "@/lib/repartiment/nodes";
import { getNormesVigents, syncGrupsRepartiment } from "@/lib/repartiment/normes-default";
import {
  carregarCostSapAdminRestaurants,
  ensureNormaAdminRestGreenVita,
} from "@/lib/repartiment/personal-admin-restaurants-data";
import {
  carregarConfigPersonal,
  carregarCostPersonalDeptSc,
  desactivarNormesPersonalObsoletes,
  ensureConfigPersonalInicial,
} from "@/lib/repartiment/personal-departaments-data";
import { unstable_cache } from "next/cache";
import { cache } from "react";

export function validarZeroSumMoviments(
  moviments: { liniaNegociDestiId: string; concepteNode: number; importCalculat: number }[],
  centralId: string
) {
  const perLn = new Map<string, Map<number, number>>();
  for (const m of moviments) {
    // LN00000 no aporta delta propi: és el residual de redistribuir el seu cost.
    if (m.liniaNegociDestiId === centralId) continue;
    aplicarDeltaDesti(perLn, m.liniaNegociDestiId, m.concepteNode, m.importCalculat);
  }
  balanceZeroSumCentral(perLn, centralId, NODES_INVARIANT_EMPRESA);
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
  grups: { id: string; membres: { liniaNegociId: string }[] }[];
};

async function carregarContextPersonalDept(
  any: number,
  mes: number,
  periodId?: string
): Promise<ContextPersonalDept> {
  const [costs, config, costAdminRestaurants] = await Promise.all([
    carregarCostPersonalDeptSc(any, mes),
    carregarConfigPersonal(),
    periodId ? carregarCostSapAdminRestaurants(periodId) : Promise.resolve(null),
  ]);
  return { costs, ...config, costAdminRestaurants };
}

function pesosOverridesDesDeExecucio(
  execucio: ExecucioDeltaSelect | null | undefined
): Map<string, number> {
  const pesOverrides = new Map<string, number>();
  for (const p of execucio?.pesos ?? []) {
    if (p.pesOverride != null) {
      pesOverrides.set(`${p.grupId}:${p.liniaNegociId}`, Number(p.pesOverride));
    }
  }
  return pesOverrides;
}

function movimentsDeltaDesDeDirecte(
  centralId: string,
  directe: DirectePerLn,
  deps: DepsComunsDelta,
  personalDept: ContextPersonalDept,
  execucio: ExecucioDeltaSelect | null | undefined
) {
  const pesosCalc = calcularPesosGrupsFromDirecte(directe, deps.grups);
  return movimentsADeltas(
    calcularMoviments(
      deps.normes,
      directe,
      centralId,
      pesosCalc,
      pesosOverridesDesDeExecucio(execucio),
      deps.lnIdByCodi,
      deps.grupCompresId,
      personalDept
    ),
    directe
  );
}

function deltasDesDeDirecte(
  centralId: string,
  directe: DirectePerLn,
  deps: DepsComunsDelta,
  personalDept: ContextPersonalDept,
  execucio: ExecucioDeltaSelect | null | undefined
): Map<string, Map<number, number>> {
  const moviments = movimentsDeltaDesDeDirecte(centralId, directe, deps, personalDept, execucio);

  const perLn = new Map<string, Map<number, number>>();
  for (const m of moviments) {
    // Retenció LN00000: ja s'ha restat del pool en calcular les altres LN.
    // El delta de Central és sempre −Σ altres (Compres / Personal / Gestió invariants).
    if (m.liniaNegociDestiId === centralId) continue;
    aplicarDeltaDesti(perLn, m.liniaNegociDestiId, m.concepteNode, m.importCalculat);
  }

  for (const o of execucio?.moviments ?? []) {
    if (o.importOverride == null) continue;
    if (o.liniaNegociDestiId === centralId) continue;
    let perNode = perLn.get(o.liniaNegociDestiId);
    if (!perNode) {
      perNode = new Map();
      perLn.set(o.liniaNegociDestiId, perNode);
    }
    perNode.set(o.concepteNode, Number(o.importOverride));
  }

  balanceZeroSumCentral(perLn, centralId, NODES_INVARIANT_EMPRESA);
  return perLn;
}

export type MovimentGestioDetall = {
  periodId: string;
  liniaNegociDestiId: string;
  concepteNode: number;
  import_: number;
  normaNom: string;
  detallCalcul: string | null;
};

/**
 * Moviments de repartiment en viu (deltas) per al drill-down de Gestió.
 * Una línia per norma (ex. Admin→GV i Personal SC) + residual Central.
 * Si `nodePresentacio` és un detall (13/15 o 7/8), l'import es prorrateja.
 */
export async function getMovimentsGestioDetall(
  periodIds: string[],
  concepteNode: number,
  liniaNegociIds?: string[],
  nodePresentacio?: number
): Promise<MovimentGestioDetall[]> {
  if (!REPARTIMENT_APLICAT_A_GESTIO) return [];
  if (!NODES_REPARTIMENT_GESTIO_ACTIUS.includes(concepteNode)) return [];
  if (!periodIds.length) return [];

  const periodIdsKey = [...periodIds].sort().join(",");
  const moviments = await getMovimentsGestioDetallCached(
    periodIdsKey,
    concepteNode,
    nodePresentacio ?? 0
  );
  if (!liniaNegociIds?.length) return moviments;

  const lnIds = new Set(liniaNegociIds);
  return moviments.filter((m) => lnIds.has(m.liniaNegociDestiId));
}

const getMovimentsGestioDetallCached = cache(
  async (
    periodIdsKey: string,
    concepteNode: number,
    nodePresentacio: number
  ): Promise<MovimentGestioDetall[]> =>
    unstable_cache(
      () =>
        getMovimentsGestioDetallImpl(
          periodIdsKey.split(",").filter(Boolean),
          concepteNode,
          nodePresentacio || undefined
        ),
      consultesCacheKey(
        "repartiment-gestio-detall-v1",
        periodIdsKey,
        String(concepteNode),
        String(nodePresentacio)
      ),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 600 }
    )()
);

async function getMovimentsGestioDetallImpl(
  periodIds: string[],
  concepteNode: number,
  nodePresentacio?: number
): Promise<MovimentGestioDetall[]> {
  const { fraccioDetallDinsTotal, nodesPresentacioGestio } = await import(
    "@/lib/repartiment/nodes"
  );

  const [central, confirmats] = await Promise.all([
    db.liniaNegoci.findUnique({
      where: { codi: CODI_LN_CENTRAL },
      select: { id: true },
    }),
    db.execucioRepartiment.findMany({
      where: { periodId: { in: periodIds }, estat: "CONFIRMAT" },
      select: { periodId: true },
    }),
  ]);
  if (!central) return [];
  const confirmatsIds = confirmats.map((c) => c.periodId);
  if (!confirmatsIds.length) return [];

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

  const normaNomById = new Map(deps.normes.map((n) => [n.id, n.nom]));
  const execByPeriod = new Map(execucions.map((e) => [e.periodId, e]));
  const personalByPeriod = new Map(
    await Promise.all(
      periods.map(
        async (p) => [p.id, await carregarContextPersonalDept(p.any, p.mes, p.id)] as const
      )
    )
  );

  const detallsPresentacio = nodesPresentacioGestio(concepteNode);
  const calProrratejar =
    nodePresentacio != null &&
    nodePresentacio !== concepteNode &&
    detallsPresentacio.includes(nodePresentacio);

  const out: MovimentGestioDetall[] = [];
  for (const period of periods) {
    const directe = directeByPeriod.get(period.id) ?? new Map();
    const personalDept =
      personalByPeriod.get(period.id) ??
      (await carregarContextPersonalDept(period.any, period.mes, period.id));
    const exec = execByPeriod.get(period.id);
    const moviments = movimentsDeltaDesDeDirecte(central.id, directe, deps, personalDept, exec);

    for (const m of moviments) {
      if (m.concepteNode !== concepteNode) continue;
      if (m.liniaNegociDestiId === central.id) continue;
      if (Math.abs(m.importCalculat) < 0.005) continue;
      out.push({
        periodId: period.id,
        liniaNegociDestiId: m.liniaNegociDestiId,
        concepteNode: m.concepteNode,
        import_: m.importCalculat,
        normaNom: (m.normaId ? normaNomById.get(m.normaId) : undefined) ?? "ESTRUCTURA",
        detallCalcul: m.detallCalcul,
      });
    }

    const perLn = deltasDesDeDirecte(central.id, directe, deps, personalDept, exec);
    const residual = perLn.get(central.id)?.get(concepteNode) ?? 0;
    if (Math.abs(residual) >= 0.005) {
      out.push({
        periodId: period.id,
        liniaNegociDestiId: central.id,
        concepteNode,
        import_: residual,
        normaNom: "Residual LN00000 (zero-sum)",
        detallCalcul:
          "Redistribució: −Σ imputacions a les altres LN (el total d'empresa no canvia)",
      });
    }
  }

  if (calProrratejar && nodePresentacio != null) {
    for (const item of out) {
      const perNode = directeByPeriod.get(item.periodId)?.get(item.liniaNegociDestiId);
      const bases = new Map<number, number>();
      for (const d of detallsPresentacio) {
        bases.set(d, perNode?.get(d) ?? 0);
      }
      const f = fraccioDetallDinsTotal(nodePresentacio, concepteNode, bases);
      item.import_ *= f;
    }
  }

  return out.filter((m) => Math.abs(m.import_) >= 0.005);
}

async function carregarDepsComunsDelta(): Promise<DepsComunsDelta> {
  const [normes, lns, grupCompres, grups] = await Promise.all([
    getNormesVigents(),
    db.liniaNegoci.findMany({ select: { id: true, codi: true } }),
    db.repartimentGrup.findUnique({
      where: { codi: "GRUP_COMPRES_CENTRAL" },
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
  await ensureConfigPersonalInicial();
  await ensureNormaAdminRestGreenVita();
  await desactivarNormesPersonalObsoletes();

  const directe = await getDirectePerLnNode(periodId);
  const [normes, personalDept, pesosCalc, lns, grupCompres] = await Promise.all([
    getNormesVigents(),
    carregarContextPersonalDept(period.any, period.mes, periodId),
    calcularPesosGrups(periodId, directe),
    db.liniaNegoci.findMany({ select: { id: true, codi: true } }),
    db.repartimentGrup.findUnique({
      where: { codi: "GRUP_COMPRES_CENTRAL" },
      select: { id: true },
    }),
  ]);

  const lnIdByCodi = new Map(lns.map((l) => [l.codi, l.id]));
  const grupCompresId = grupCompres?.id ?? "";

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
    personalDept
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
 * Es llegeix de l'execució confirmada. LN00000 és residual zero-sum:
 * Compres / Personal / Gestió tenen el mateix total empresa que Traspassos;
 * només canvia el pes per LN.
 *
 * Així la consulta coincideix amb el repartiment aprovat i no torna a executar
 * el motor de repartiment a cada càrrega.
 */
export async function getDeltasGestioPerLn(
  periodIds: string[]
): Promise<Map<string, Map<string, Map<number, number>>>> {
  if (!REPARTIMENT_APLICAT_A_GESTIO) return new Map();
  if (!periodIds.length) return new Map();
  const key = [...periodIds].sort().join(",");
  return getDeltasGestioPerLnCached(key);
}

const getDeltasGestioPerLnCached = cache(async (periodIdsKey: string) => {
  const periodIds = periodIdsKey.split(",").filter(Boolean);
  return getDeltasGestioPerLnImpl(periodIds);
});

async function getDeltasGestioPerLnImpl(
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

  const execucions = await db.execucioRepartiment.findMany({
    where: { periodId: { in: confirmatsIds }, estat: "CONFIRMAT" },
    select: {
      periodId: true,
      moviments: {
        where: { concepteNode: { in: [...NODES_REPARTIMENT_GESTIO_ACTIUS] } },
        select: {
          liniaNegociDestiId: true,
          concepteNode: true,
          importCalculat: true,
          importOverride: true,
        },
      },
    },
  });
  const result = new Map<string, Map<string, Map<number, number>>>();

  for (const execucio of execucions) {
    const perLn = new Map<string, Map<number, number>>();
    for (const moviment of execucio.moviments) {
      if (moviment.liniaNegociDestiId === central.id) continue;
      aplicarDeltaDesti(
        perLn,
        moviment.liniaNegociDestiId,
        moviment.concepteNode,
        Number(moviment.importOverride ?? moviment.importCalculat)
      );
    }
    balanceZeroSumCentral(perLn, central.id, NODES_INVARIANT_EMPRESA);
    result.set(execucio.periodId, filtrarDeltasCompresGestio(perLn));
  }
  return result;
}

/** Fase Compres i gestió: només nodes 11 i 30 (sense personal SC). */
function filtrarDeltasCompresGestio(
  perLn: Map<string, Map<number, number>>
): Map<string, Map<number, number>> {
  const out = new Map<string, Map<number, number>>();
  for (const [lnId, nodes] of perLn) {
    const filtered = new Map<number, number>();
    for (const node of NODES_REPARTIMENT_GESTIO_ACTIUS) {
      const v = nodes.get(node);
      if (v != null && v !== 0) filtered.set(node, v);
    }
    if (filtered.size) out.set(lnId, filtered);
  }
  return out;
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

export type { InfoGestioConsulta } from "@/lib/repartiment/info-gestio";

/** Estat del repartiment confirmat per al avís de consulta gestió. */
export async function getInfoGestioConsulta(
  any: number,
  rang: RangMesos
): Promise<InfoGestioConsulta> {
  if (!REPARTIMENT_APLICAT_A_GESTIO || NODES_REPARTIMENT_GESTIO_ACTIUS.length === 0) {
    return {
      mesosAmbDades: 0,
      mesosConfirmats: 0,
      teGestio: false,
      nomsConfirmats: [],
      nomsPendents: [],
      enReconstruccio: true,
    };
  }

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

  const { NODE_COMPRES, NODE_COST_GESTIO, NODE_COST_SALARIAL } = await import(
    "@/lib/repartiment/nodes"
  );
  const actius = NODES_REPARTIMENT_GESTIO_ACTIUS;

  return {
    mesosAmbDades: periods.length,
    mesosConfirmats: confirmats.length,
    teGestio: confirmats.length > 0,
    nomsConfirmats: confirmats.map((p) => p.nom),
    nomsPendents: pendents.map((p) => p.nom),
    faseGestioDespeses: actius.includes(NODE_COST_GESTIO),
    faseCompres: actius.includes(NODE_COMPRES),
    faseCompresGestio: actius.includes(NODE_COMPRES) || actius.includes(NODE_COST_GESTIO),
    fasePersonalSc: actius.includes(NODE_COST_SALARIAL),
  };
}

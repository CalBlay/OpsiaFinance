/**
 * Dades necessàries per calcular el personal indirecte per LN:
 * total real del compte Gestió + personal SC imputat i part de L+C.
 *
 * Càlcul per departament (mateixa lògica que el repartiment personal SC),
 * no un % global sobre el total Central — així LN00001 Restaurants (import fix
 * admin/RRHH/…) no es redueix artificialment amb el pes de L+C.
 */

import { getComparativaLn } from "@/lib/consultes";
import { db } from "@/lib/db";
import { assertExternalApiKey } from "@/lib/external/cost-personal-estructura";
import { calcularPesosGrups, getDirectePerLnNode } from "@/lib/repartiment/bases-vendes";
import { NODES_REPARTIMENT_GESTIO_ACTIUS } from "@/lib/repartiment/constants";
import { calcularMoviments, movimentsADeltas } from "@/lib/repartiment/motor";
import {
  CODI_LN_CENTRAL,
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
} from "@/lib/repartiment/nodes";
import { getNormesVigents } from "@/lib/repartiment/normes-default";
import { esNormaAdminRestGreenVita } from "@/lib/repartiment/personal-admin-restaurants";
import {
  calcularAllocacionsPersonalDept,
  calcularPesosComercialPersonal,
} from "@/lib/repartiment/personal-departaments";
import {
  carregarConfigPersonal,
  carregarCostPersonalDeptSc,
} from "@/lib/repartiment/personal-departaments-data";

export { assertExternalApiKey };

/** Centres ja imputats als pots gestió/prep/rentat de CalBlapp. */
const CENTRES_EXCLOSOS_POTS = new Set(["CCC00004", "CCC00007"]);

/**
 * En aquestes LN el personal indirecte ja és un import fix distribuït per
 * departaments a Opsia; no s'ha de recalcular com un residual del compte.
 */
const LN_PERSONAL_FIX_PER_DEPARTAMENTS = new Set(["LN00001", "LN00005", "LN00006"]);

export type PersonalIndirecteMode = "FIX_DEPARTAMENTS" | "RESIDUAL_LN";

export type ExecucioEstatEstructura = "CONFIRMAT" | "LIVE_FALLBACK" | "SENSE_DADES";

export type CostEstructuraLnRow = {
  lnCodi: string;
  lnNom: string;
  vista: "gestio";
  compresImputades: number;
  /** Personal SC imputat (tots els depts SC). */
  personalImputat: number;
  /** Total de personal del compte d'explotacio de la LN en vista Gestio. */
  personalTotalLn: number;
  personalIndirecteMode: PersonalIndirecteMode;
  /** Part provinent de Logística + Cuina Central. */
  personalExclosLogisticaCuina: number;
  /** Personal SC imputat sense L+C (referència; no és el pot indirecte final). */
  personalImputatNet: number;
  gestioImputada: number;
  estructuraCentral: number;
  estructuraNeta: number;
  execucioEstat: ExecucioEstatEstructura;
};

export type CostEstructuraLnResponse = {
  year: number;
  month: number;
  vista: "gestio";
  execucioEstat: ExecucioEstatEstructura;
  logisticaCuinaPersonal: number;
  personalCentralSap: number;
  /** @deprecated Ja no s'aplica un ratio global; es conserva per compat. */
  ratioLogisticaCuina: number;
  lines: CostEstructuraLnRow[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function esMovimentAdminRestGreenVita(
  normaNom: string | null | undefined,
  detallCalcul: string | null | undefined
): boolean {
  if (esNormaAdminRestGreenVita(normaNom ?? null)) return true;
  if (!detallCalcul) return false;
  return (
    detallCalcul.includes("LN00001→LN00006") ||
    detallCalcul.includes("Admin→GV") ||
    detallCalcul.includes("imputat Admin rest")
  );
}

type AccByLn = Map<string, { 11: number; 17: number; 30: number }>;
type PersonalSplit = { brut: number; exclos: number; net: number };

async function loadPersonalTotalByLn(
  lns: Array<{ id: string; codi: string }>,
  year: number,
  month: number
): Promise<Map<string, number>> {
  const totals = await Promise.all(
    lns.map(async (ln) => {
      const compte = await getComparativaLn(ln.id, year, { des: month, fins: month }, "gestio");
      const personal = compte.concepts.find((concepte) => concepte.node === NODE_COST_SALARIAL);
      return [ln.id, round2(Math.abs(Number(personal?.total) || 0))] as const;
    })
  );
  return new Map(totals);
}

function emptyAcc(): { 11: number; 17: number; 30: number } {
  return { 11: 0, 17: 0, 30: 0 };
}

function addAbs(acc: AccByLn, lnId: string, node: number, amount: number) {
  if (!NODES_REPARTIMENT_GESTIO_ACTIUS.includes(node)) return;
  const row = acc.get(lnId) ?? emptyAcc();
  const abs = Math.abs(Number(amount) || 0);
  if (node === NODE_COMPRES) row[11] += abs;
  else if (node === NODE_COST_SALARIAL) row[17] += abs;
  else if (node === NODE_COST_GESTIO) row[30] += abs;
  acc.set(lnId, row);
}

async function loadConfirmedByLn(periodId: string, centralId: string): Promise<AccByLn | null> {
  const exec = await db.execucioRepartiment.findFirst({
    where: { periodId, estat: "CONFIRMAT" },
    select: {
      moviments: {
        where: { concepteNode: { in: [...NODES_REPARTIMENT_GESTIO_ACTIUS] } },
        select: {
          liniaNegociDestiId: true,
          concepteNode: true,
          importCalculat: true,
          importOverride: true,
          detallCalcul: true,
          norma: { select: { nom: true } },
        },
      },
    },
  });
  if (!exec) return null;

  const acc: AccByLn = new Map();
  for (const m of exec.moviments) {
    if (m.liniaNegociDestiId === centralId) continue;
    if (esMovimentAdminRestGreenVita(m.norma?.nom, m.detallCalcul)) continue;
    addAbs(acc, m.liniaNegociDestiId, m.concepteNode, Number(m.importOverride ?? m.importCalculat));
  }
  return acc;
}

async function loadLiveGestioByLn(
  period: { id: string; any: number; mes: number },
  centralId: string
): Promise<AccByLn> {
  const [normes, configPers, lns, grupCompres] = await Promise.all([
    getNormesVigents(),
    carregarConfigPersonal(),
    db.liniaNegoci.findMany({ select: { id: true, codi: true } }),
    db.repartimentGrup.findUnique({
      where: { codi: "GRUP_COMPRES_CENTRAL" },
      select: { id: true },
    }),
  ]);

  const lnIdByCodi = new Map(lns.map((l) => [l.codi, l.id]));
  const [directe, costs] = await Promise.all([
    getDirectePerLnNode(period.id),
    carregarCostPersonalDeptSc(period.any, period.mes),
  ]);
  const pesosCalc = await calcularPesosGrups(period.id, directe);
  const moviments = movimentsADeltas(
    calcularMoviments(
      normes,
      directe,
      centralId,
      pesosCalc,
      new Map(),
      lnIdByCodi,
      grupCompres?.id ?? "",
      {
        costs,
        configsLn: configPers.configsLn,
        configsDept: configPers.configsDept,
        pesDefecte: configPers.pesDefecte,
        fraccioSobrantIguals: configPers.fraccioSobrantIguals,
        costAdminRestaurants: null,
      }
    ),
    directe
  );

  const acc: AccByLn = new Map();
  for (const m of moviments) {
    if (m.liniaNegociDestiId === centralId) continue;
    if (esMovimentAdminRestGreenVita(null, m.detallCalcul)) continue;
    addAbs(acc, m.liniaNegociDestiId, m.concepteNode, m.importCalculat);
  }
  return acc;
}

/**
 * Personal SC per LN desglossat per dept: exclou centres Logística i Cuina Central.
 */
async function personalSplitPerLn(
  periodId: string,
  year: number,
  month: number
): Promise<{
  byLnId: Map<string, PersonalSplit>;
  logisticaCuinaPersonal: number;
  personalCentralSap: number;
}> {
  const [directe, costs, configPers, lns, central] = await Promise.all([
    getDirectePerLnNode(periodId),
    carregarCostPersonalDeptSc(year, month),
    carregarConfigPersonal(),
    db.liniaNegoci.findMany({ select: { id: true, codi: true } }),
    db.liniaNegoci.findUnique({
      where: { codi: CODI_LN_CENTRAL },
      select: { id: true },
    }),
  ]);

  const lnIdByCodi = new Map(lns.map((l) => [l.codi, l.id]));
  const pesosComercial = calcularPesosComercialPersonal(directe, lnIdByCodi, configPers.pesDefecte);
  const allocs = calcularAllocacionsPersonalDept(
    costs,
    configPers.configsLn,
    configPers.configsDept,
    lnIdByCodi,
    pesosComercial,
    configPers.fraccioSobrantIguals
  );

  const deptsExclosos = new Set<string>();
  let logisticaCuinaPersonal = 0;
  for (const c of costs) {
    if (CENTRES_EXCLOSOS_POTS.has(String(c.centreCodi || "").toUpperCase())) {
      deptsExclosos.add(c.departamentId);
      logisticaCuinaPersonal += Number(c.costPersonal) || 0;
    }
  }

  const byLnId = new Map<string, PersonalSplit>();
  for (const a of allocs) {
    const prev = byLnId.get(a.liniaNegociId) ?? { brut: 0, exclos: 0, net: 0 };
    prev.brut += a.importAbs;
    if (deptsExclosos.has(a.departamentId)) {
      prev.exclos += a.importAbs;
    } else {
      prev.net += a.importAbs;
    }
    byLnId.set(a.liniaNegociId, prev);
  }

  const personalCentralSap = central
    ? Math.abs(Number(directe.get(central.id)?.get(NODE_COST_SALARIAL) ?? 0))
    : 0;

  return {
    byLnId,
    logisticaCuinaPersonal: round2(logisticaCuinaPersonal),
    personalCentralSap: round2(personalCentralSap),
  };
}

function toRow(
  ln: { id: string; codi: string; nom: string },
  gestioAcc: { 11: number; 17: number; 30: number } | undefined,
  personal: PersonalSplit | undefined,
  personalTotalLn: number,
  execucioEstat: ExecucioEstatEstructura
): CostEstructuraLnRow {
  const g = gestioAcc ?? emptyAcc();
  const compresImputades = round2(g[11]);
  const gestioImputada = round2(g[30]);

  // Personal: font = allocacions per dept (no ratio global)
  const personalImputat = round2(personal?.brut ?? 0);
  const personalExclosLogisticaCuina = round2(personal?.exclos ?? 0);
  const personalImputatNet = round2(personal?.net ?? 0);

  const estructuraCentral = round2(compresImputades + personalImputat + gestioImputada);
  const estructuraNeta = round2(compresImputades + personalImputatNet + gestioImputada);

  return {
    lnCodi: ln.codi,
    lnNom: ln.nom,
    vista: "gestio",
    compresImputades,
    personalImputat,
    personalTotalLn: round2(personalTotalLn),
    personalIndirecteMode: LN_PERSONAL_FIX_PER_DEPARTAMENTS.has(ln.codi)
      ? "FIX_DEPARTAMENTS"
      : "RESIDUAL_LN",
    personalExclosLogisticaCuina,
    personalImputatNet,
    gestioImputada,
    estructuraCentral,
    estructuraNeta,
    execucioEstat,
  };
}

export async function buildCostEstructuraLn(
  year: number,
  month: number
): Promise<CostEstructuraLnResponse> {
  const [period, central, lns] = await Promise.all([
    db.period.findFirst({
      where: { any: year, mes: month },
      select: { id: true, any: true, mes: true },
    }),
    db.liniaNegoci.findUnique({
      where: { codi: CODI_LN_CENTRAL },
      select: { id: true },
    }),
    db.liniaNegoci.findMany({
      where: { isActive: true, codi: { not: CODI_LN_CENTRAL } },
      orderBy: [{ ordre: "asc" }, { codi: "asc" }],
      select: { id: true, codi: true, nom: true },
    }),
  ]);

  if (!period || !central) {
    return {
      year,
      month,
      vista: "gestio",
      execucioEstat: "SENSE_DADES",
      logisticaCuinaPersonal: 0,
      personalCentralSap: 0,
      ratioLogisticaCuina: 0,
      lines: lns.map((ln) => toRow(ln, undefined, undefined, 0, "SENSE_DADES")),
    };
  }

  const [confirmed, personalSplit, personalTotalByLn] = await Promise.all([
    loadConfirmedByLn(period.id, central.id),
    personalSplitPerLn(period.id, year, month),
    loadPersonalTotalByLn(lns, year, month),
  ]);

  let gestioAcc: AccByLn;
  let execucioEstat: ExecucioEstatEstructura;
  if (confirmed) {
    gestioAcc = confirmed;
    execucioEstat = "CONFIRMAT";
  } else {
    gestioAcc = await loadLiveGestioByLn(period, central.id);
    execucioEstat = "LIVE_FALLBACK";
  }

  const ratioLogisticaCuina =
    personalSplit.personalCentralSap > 0
      ? Math.min(
          1,
          Math.max(0, personalSplit.logisticaCuinaPersonal / personalSplit.personalCentralSap)
        )
      : 0;

  return {
    year,
    month,
    vista: "gestio",
    execucioEstat,
    logisticaCuinaPersonal: personalSplit.logisticaCuinaPersonal,
    personalCentralSap: personalSplit.personalCentralSap,
    ratioLogisticaCuina: round2(ratioLogisticaCuina * 1000) / 1000,
    lines: lns.map((ln) =>
      toRow(
        ln,
        gestioAcc.get(ln.id),
        personalSplit.byLnId.get(ln.id),
        personalTotalByLn.get(ln.id) ?? 0,
        execucioEstat
      )
    ),
  };
}

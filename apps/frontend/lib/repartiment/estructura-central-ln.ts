/**
 * Imputació d'estructura Central a una LN.
 *
 * Inclou tot el que surt del repartiment Central (compres, personal SC —fixes i
 * sobrant 02/03—, gestió), i exclou el traspass intern Admin restaurants → Green Vita
 * (és C.Explotació de la LN, no estructura Central).
 */
import { db } from "@/lib/db";
import { type RangMesos, prismaPeriodFilter } from "@/lib/periodes";
import { calcularPesosGrups, getDirectePerLnNode } from "@/lib/repartiment/bases-vendes";
import { NODES_REPARTIMENT_GESTIO_ACTIUS } from "@/lib/repartiment/constants";
import { calcularMoviments, movimentsADeltas } from "@/lib/repartiment/motor";
import { CODI_LN_CENTRAL } from "@/lib/repartiment/nodes";
import { getNormesVigents } from "@/lib/repartiment/normes-default";
import { esNormaAdminRestGreenVita } from "@/lib/repartiment/personal-admin-restaurants";
import {
  carregarConfigPersonal,
  carregarCostPersonalDeptSc,
} from "@/lib/repartiment/personal-departaments-data";

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

/**
 * € d'estructura Central imputada a la LN al rang (suma |Δ| mensual).
 * Preferència: moviments d'execucions CONFIRMAT (mateixa base que Gestió).
 * Fallback: motor en viu sense Admin→GV.
 */
export async function importEstructuraCentralLn(
  liniaNegociId: string,
  any: number,
  rang: RangMesos
): Promise<number> {
  const periods = await db.period.findMany({
    where: prismaPeriodFilter(any, rang),
    select: { id: true, mes: true, any: true },
    orderBy: { mes: "asc" },
  });
  if (!periods.length) return 0;

  const periodIds = periods.map((p) => p.id);
  const execucions = await db.execucioRepartiment.findMany({
    where: { periodId: { in: periodIds }, estat: "CONFIRMAT" },
    select: {
      periodId: true,
      moviments: {
        where: {
          liniaNegociDestiId: liniaNegociId,
          concepteNode: { in: [...NODES_REPARTIMENT_GESTIO_ACTIUS] },
        },
        select: {
          importCalculat: true,
          importOverride: true,
          detallCalcul: true,
          norma: { select: { nom: true } },
        },
      },
    },
  });

  const confirmats = new Set(execucions.map((e) => e.periodId));
  let total = 0;

  for (const exec of execucions) {
    for (const m of exec.moviments) {
      if (esMovimentAdminRestGreenVita(m.norma?.nom, m.detallCalcul)) continue;
      total += Math.abs(Number(m.importOverride ?? m.importCalculat));
    }
  }

  const pendents = periods.filter((p) => !confirmats.has(p.id));
  if (pendents.length) {
    total += await importEstructuraCentralLnLive(liniaNegociId, pendents);
  }

  return total;
}

/** Motor en viu (mesos sense repartiment confirmat), sense Admin→GV. */
async function importEstructuraCentralLnLive(
  liniaNegociId: string,
  periods: { id: string; any: number; mes: number }[]
): Promise<number> {
  const [normes, configPers, lns, grupCompres, central] = await Promise.all([
    getNormesVigents(),
    carregarConfigPersonal(),
    db.liniaNegoci.findMany({ select: { id: true, codi: true } }),
    db.repartimentGrup.findUnique({
      where: { codi: "GRUP_COMPRES_CENTRAL" },
      select: { id: true },
    }),
    db.liniaNegoci.findUnique({ where: { codi: CODI_LN_CENTRAL }, select: { id: true } }),
  ]);
  if (!central) return 0;

  const lnIdByCodi = new Map(lns.map((l) => [l.codi, l.id]));
  const grupCompresId = grupCompres?.id ?? "";
  let total = 0;

  for (const period of periods) {
    const [directe, costs] = await Promise.all([
      getDirectePerLnNode(period.id),
      carregarCostPersonalDeptSc(period.any, period.mes),
    ]);
    const pesosCalc = await calcularPesosGrups(period.id, directe);
    const moviments = movimentsADeltas(
      calcularMoviments(
        normes,
        directe,
        central.id,
        pesosCalc,
        new Map(),
        lnIdByCodi,
        grupCompresId,
        {
          costs,
          configsLn: configPers.configsLn,
          configsDept: configPers.configsDept,
          pesDefecte: configPers.pesDefecte,
          fraccioSobrantIguals: configPers.fraccioSobrantIguals,
          // Sense cost Admin → no es generen moviments LN00001↔LN00006.
          costAdminRestaurants: null,
        }
      ),
      directe
    );

    for (const m of moviments) {
      if (m.liniaNegociDestiId !== liniaNegociId) continue;
      if (!NODES_REPARTIMENT_GESTIO_ACTIUS.includes(m.concepteNode)) continue;
      if (esMovimentAdminRestGreenVita(null, m.detallCalcul)) continue;
      total += Math.abs(m.importCalculat);
    }
  }

  return total;
}

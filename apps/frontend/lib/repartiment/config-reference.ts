import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { prismaWhereDadaPerLnInforme } from "@/lib/linia-informe";
import { CODI_LN_CENTRAL, NODES_GESTIO_DETALL } from "@/lib/repartiment/nodes";
import { unstable_cache } from "next/cache";

type CostosGestioPerNode = Record<number, number>;

async function carregarCostosGestioCentralUncached(periodId: string): Promise<CostosGestioPerNode> {
  const central = await db.liniaNegoci.findUnique({
    where: { codi: CODI_LN_CENTRAL },
    select: { id: true },
  });
  if (!central) return {};

  const filtreConcepte = {
    node: { in: [...NODES_GESTIO_DETALL] },
  };
  const [dades, ajustos] = await Promise.all([
    db.dadaResultat.findMany({
      where: {
        periodId,
        concepteResultat: filtreConcepte,
        ...prismaWhereDadaPerLnInforme(central.id),
      },
      select: {
        import_: true,
        concepteResultat: { select: { node: true } },
      },
    }),
    db.ajust.findMany({
      where: {
        periodId,
        concepteResultat: filtreConcepte,
        OR: [
          { liniaNegociId: central.id },
          { liniaNegociId: null, centre: { liniaNegociId: central.id } },
        ],
      },
      select: {
        import_: true,
        concepteResultat: { select: { node: true } },
      },
    }),
  ]);

  const result: CostosGestioPerNode = {};
  for (const row of [...dades, ...ajustos]) {
    const node = row.concepteResultat.node;
    result[node] = (result[node] ?? 0) + Number(row.import_);
  }
  return result;
}

/** Imports Central necessaris per a la previsualització de la matriu de Gestió. */
export async function carregarCostosGestioCentral(periodId: string): Promise<CostosGestioPerNode> {
  return unstable_cache(
    () => carregarCostosGestioCentralUncached(periodId),
    consultesCacheKey("config-repartiment-gestio-central", periodId),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
}

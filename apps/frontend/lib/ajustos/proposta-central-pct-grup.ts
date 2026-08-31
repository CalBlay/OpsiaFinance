import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { filtraLiniesPerGrup } from "@/lib/grups-empresa";
import {
  esColumnaTotalLnRedundant,
  lnInformePerAgregacio,
  prismaWhereDadaPerLnInforme,
  prismaWhereDadaPerLnInformeIds,
} from "@/lib/linia-informe";
import { MESOS_LLARGS } from "@/lib/periodes";
import { NODE_COMPRES, NODE_COMPRES_DETALL, NODE_INGRESSOS } from "@/lib/repartiment/nodes";
import { unstable_cache } from "next/cache";
import { cache } from "react";

const CODI_CENTRAL = "LN00000";
const MESOS = [3, 4, 5, 6, 7] as const;
const PCT = 32.5921;

export type PropostaAjustCentralPctGrup = {
  any: number;
  percent: number;
  percentTxt: string;
  formula: string;
  files: {
    mes: number;
    mesNom: string;
    baseEmpresa: number;
    pctActual: number | null;
    objectiuCompres: number;
    compresSapEmpresa: number;
    deltaCentral: number;
    compresSapCentral: number;
    compresCentralDespres: number;
  }[];
};

async function computePropostaAjustCentralPctSobreVendesGrup(
  any: number,
  percent: number
): Promise<PropostaAjustCentralPctGrup | null> {
  const [central, linies, conceptes] = await Promise.all([
    db.liniaNegoci.findUnique({
      where: { codi: CODI_CENTRAL },
      select: { id: true },
    }),
    db.liniaNegoci.findMany({
      where: { isActive: true },
      select: { id: true, codi: true, nom: true },
    }),
    db.concepteResultat.findMany({
      where: { node: { in: [NODE_INGRESSOS, NODE_COMPRES, NODE_COMPRES_DETALL] } },
      select: { id: true, node: true },
    }),
  ]);
  if (!central) return null;

  const lnIds = filtraLiniesPerGrup(linies, "calblay").map((l) => l.id);
  const lnIdSet = new Set(lnIds);
  if (lnIds.length === 0) return null;

  const concepteIdByNode = new Map(conceptes.map((c) => [c.node, c.id]));
  const ingressosId = concepteIdByNode.get(NODE_INGRESSOS);
  const compresId = concepteIdByNode.get(NODE_COMPRES);
  const compresDetallId = concepteIdByNode.get(NODE_COMPRES_DETALL);
  if (!ingressosId || !compresId) return null;

  const mesos = [...MESOS];

  const [dadesEmpresaRaw, dadesCentralRaw] = await Promise.all([
    db.dadaResultat.findMany({
      where: {
        concepteResultatId: { in: [ingressosId, compresId] },
        period: { any, mes: { in: mesos } },
        ...prismaWhereDadaPerLnInformeIds(lnIds),
      },
      select: {
        import_: true,
        concepteResultatId: true,
        liniaNegociId: true,
        centreId: true,
        senseCentre: true,
        importacio: { select: { liniaNegociId: true } },
        period: { select: { mes: true } },
      },
    }),
    compresDetallId
      ? db.dadaResultat.findMany({
          where: {
            concepteResultatId: compresDetallId,
            period: { any, mes: { in: mesos } },
            ...prismaWhereDadaPerLnInforme(central.id),
          },
          select: { import_: true, period: { select: { mes: true } } },
        })
      : Promise.resolve([]),
  ]);

  const dadesEmpresa = dadesEmpresaRaw.filter((d) => {
    if (esColumnaTotalLnRedundant(d)) return false;
    const lnId = lnInformePerAgregacio(d);
    return !!lnId && lnIdSet.has(lnId);
  });

  const sumaPerMesConcepte = new Map<string, number>();
  for (const d of dadesEmpresa) {
    const key = `${d.period.mes}:${d.concepteResultatId}`;
    sumaPerMesConcepte.set(key, (sumaPerMesConcepte.get(key) ?? 0) + Number(d.import_));
  }

  const centralPerMes = new Map<number, number>();
  for (const d of dadesCentralRaw) {
    centralPerMes.set(d.period.mes, (centralPerMes.get(d.period.mes) ?? 0) + Number(d.import_));
  }

  const files = [];

  for (const mes of MESOS) {
    const baseEmpresa = sumaPerMesConcepte.get(`${mes}:${ingressosId}`) ?? 0;
    const compresSapEmpresa = sumaPerMesConcepte.get(`${mes}:${compresId}`) ?? 0;
    const compresSapCentral = centralPerMes.get(mes) ?? 0;

    const objectiuCompres = -(Math.abs(baseEmpresa) * (percent / 100));
    const deltaCentral = Math.round((objectiuCompres - compresSapEmpresa) * 100) / 100;
    const pctActual =
      Math.abs(baseEmpresa) > 0.01
        ? (Math.abs(compresSapEmpresa) / Math.abs(baseEmpresa)) * 100
        : null;

    files.push({
      mes,
      mesNom: MESOS_LLARGS[mes - 1] ?? `Mes ${mes}`,
      baseEmpresa: Math.round(baseEmpresa * 100) / 100,
      pctActual: pctActual != null ? Math.round(pctActual * 10) / 10 : null,
      objectiuCompres: Math.round(objectiuCompres * 100) / 100,
      compresSapEmpresa: Math.round(compresSapEmpresa * 100) / 100,
      deltaCentral,
      compresSapCentral: Math.round(compresSapCentral * 100) / 100,
      compresCentralDespres: Math.round((compresSapCentral + deltaCentral) * 100) / 100,
    });
  }

  return {
    any,
    percent,
    percentTxt: Number.isInteger(percent)
      ? String(percent)
      : percent.toFixed(4).replace(".", ",").replace(/0+$/, "").replace(/,$/, ""),
    formula: `objectiu = −${String(percent).replace(".", ",")}% × ingressos Cal Blay; Δ = objectiu − TOTAL COMPRES SAP; Δ → COMPRES LN00000`,
    files,
  };
}

/**
 * Alineat amb el KPI de Resultats (Cal Blay):
 *   objectiu = −% × |ingressos explotació empresa|
 *   Δ = objectiu − TOTAL COMPRES SAP empresa (node 11)
 *   Δ → ajust a COMPRES detall (7) de LN00000
 *
 * Si el % actual > objectiu → Δ positiu (reduir cost a Central).
 */
export const propostaAjustCentralPctSobreVendesGrup = cache(
  async (any: number, percent = PCT): Promise<PropostaAjustCentralPctGrup | null> => {
    return unstable_cache(
      () => computePropostaAjustCentralPctSobreVendesGrup(any, percent),
      consultesCacheKey("ajustos-proposta-central-pct", String(any), String(percent)),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
    )();
  }
);

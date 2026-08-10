import { db } from "@/lib/db";
import { filtraLiniesPerGrup } from "@/lib/grups-empresa";
import { prismaWhereDadaPerLnInforme } from "@/lib/linia-informe";
import { MESOS_LLARGS } from "@/lib/periodes";
import { NODE_COMPRES, NODE_COMPRES_DETALL, NODE_INGRESSOS } from "@/lib/repartiment/nodes";

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

async function sumaNodeEmpresaMes(
  any: number,
  mes: number,
  node: number,
  lnIds: string[]
): Promise<number> {
  const concepte = await db.concepteResultat.findUnique({
    where: { node },
    select: { id: true },
  });
  if (!concepte) return 0;

  let total = 0;
  for (const lnId of lnIds) {
    const dades = await db.dadaResultat.findMany({
      where: {
        concepteResultatId: concepte.id,
        period: { any, mes },
        ...prismaWhereDadaPerLnInforme(lnId),
      },
      select: { import_: true },
    });
    for (const d of dades) total += Number(d.import_);
  }
  return total;
}

async function sumaNodeLnMes(
  any: number,
  mes: number,
  node: number,
  lnId: string
): Promise<number> {
  const concepte = await db.concepteResultat.findUnique({
    where: { node },
    select: { id: true },
  });
  if (!concepte) return 0;
  const dades = await db.dadaResultat.findMany({
    where: {
      concepteResultatId: concepte.id,
      period: { any, mes },
      ...prismaWhereDadaPerLnInforme(lnId),
    },
    select: { import_: true },
  });
  return dades.reduce((s, d) => s + Number(d.import_), 0);
}

/**
 * Alineat amb el KPI de Resultats (Cal Blay):
 *   objectiu = −% × |ingressos explotació empresa|
 *   Δ = objectiu − TOTAL COMPRES SAP empresa (node 11)
 *   Δ → ajust a COMPRES detall (7) de LN00000
 *
 * Si el % actual > objectiu → Δ positiu (reduir cost a Central).
 */
export async function propostaAjustCentralPctSobreVendesGrup(
  any: number,
  percent = PCT
): Promise<PropostaAjustCentralPctGrup | null> {
  const central = await db.liniaNegoci.findUnique({
    where: { codi: CODI_CENTRAL },
    select: { id: true },
  });
  if (!central) return null;

  const linies = await db.liniaNegoci.findMany({
    where: { isActive: true },
    select: { id: true, codi: true, nom: true },
  });
  const lnIds = filtraLiniesPerGrup(linies, "calblay").map((l) => l.id);

  const files = [];

  for (const mes of MESOS) {
    const [baseEmpresa, compresSapEmpresa, compresSapCentral] = await Promise.all([
      sumaNodeEmpresaMes(any, mes, NODE_INGRESSOS, lnIds),
      sumaNodeEmpresaMes(any, mes, NODE_COMPRES, lnIds),
      sumaNodeLnMes(any, mes, NODE_COMPRES_DETALL, central.id),
    ]);

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

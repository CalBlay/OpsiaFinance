import { db } from "@/lib/db";
import { prismaWhereDadaPerLnInforme } from "@/lib/linia-informe";
import { MESOS_LLARGS } from "@/lib/periodes";
import {
  NODE_COMPRES,
  NODE_COMPRES_DETALL,
  NODE_INGRESSOS,
  NODE_VENDES,
} from "@/lib/repartiment/nodes";

const CODI_LN = "LN00000";
const MESOS_AJUST = [3, 4, 5, 6, 7] as const;
const MESOS_OK = [1, 2, 8, 9, 10, 11, 12] as const;
const TOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type CalculAjustCompresCentral = {
  any: number;
  lnCodi: string;
  lnNom: string;
  nodeCompres: number;
  nodeCompresLabel: string;
  nodeBase: number;
  nodeBaseLabel: string;
  percent: number;
  percentTxt: string;
  compresAny: number;
  compresOk: number;
  compresMj: number;
  baseAny: number;
  baseOk: number;
  baseMj: number;
  percentOk: number | null;
  percentAny: number | null;
  files: {
    mes: number;
    mesNom: string;
    base: number;
    sap: number;
    objectiu: number;
    ajust: number;
  }[];
  sumaAjust: number;
};

async function sumaNodePerMes(
  lnId: string,
  any: number,
  node: number,
  mesos: readonly number[]
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (const m of mesos) out.set(m, 0);

  const concepte = await db.concepteResultat.findUnique({
    where: { node },
    select: { id: true },
  });
  if (!concepte) return out;

  const dades = await db.dadaResultat.findMany({
    where: {
      concepteResultatId: concepte.id,
      period: { any, mes: { in: [...mesos] } },
      ...prismaWhereDadaPerLnInforme(lnId),
    },
    select: { import_: true, period: { select: { mes: true } } },
  });

  for (const d of dades) {
    const mes = d.period.mes;
    out.set(mes, (out.get(mes) ?? 0) + Number(d.import_));
  }
  return out;
}

function suma(map: Map<number, number>, mesos: readonly number[]) {
  return mesos.reduce((s, m) => s + (map.get(m) ?? 0), 0);
}

/** % i deltas Març–Juliol per Central, preservant el total de compres d’aquests mesos. */
export async function calcularAjustCompresCentralMarJul(
  any: number
): Promise<CalculAjustCompresCentral | null> {
  const ln = await db.liniaNegoci.findUnique({
    where: { codi: CODI_LN },
    select: { id: true, codi: true, nom: true },
  });
  if (!ln) return null;

  const [vendes, ingressos, compres7, compres11] = await Promise.all([
    sumaNodePerMes(ln.id, any, NODE_VENDES, TOTS),
    sumaNodePerMes(ln.id, any, NODE_INGRESSOS, TOTS),
    sumaNodePerMes(ln.id, any, NODE_COMPRES_DETALL, TOTS),
    sumaNodePerMes(ln.id, any, NODE_COMPRES, TOTS),
  ]);

  const tot7 = Math.abs(suma(compres7, TOTS));
  const tot11 = Math.abs(suma(compres11, TOTS));
  const usaDetall = tot11 < 0.01 && tot7 >= 0.01;
  const compres = usaDetall ? compres7 : compres11;
  const nodeCompres = usaDetall ? NODE_COMPRES_DETALL : NODE_COMPRES;
  const nodeCompresLabel = usaDetall ? "COMPRES (detall)" : "TOTAL COMPRES";

  // Central: poques vendes (node 2) vs moltes compres → base = ingressos explotació (6).
  const vendesMj = Math.abs(suma(vendes, MESOS_AJUST));
  const ratioVsVendes =
    vendesMj > 0.01 ? Math.abs(suma(compres, MESOS_AJUST)) / vendesMj : Number.POSITIVE_INFINITY;
  const usaIngressos = ln.codi === CODI_LN || ratioVsVendes > 2 || vendesMj < 0.01;
  const base = usaIngressos ? ingressos : vendes;
  const nodeBase = usaIngressos ? NODE_INGRESSOS : NODE_VENDES;
  const nodeBaseLabel = usaIngressos ? "Ingressos explotació" : "Vendes";

  const compresAny = suma(compres, TOTS);
  const compresOk = suma(compres, MESOS_OK);
  const compresMj = suma(compres, MESOS_AJUST);
  const baseAny = suma(base, TOTS);
  const baseOk = suma(base, MESOS_OK);
  const baseMj = suma(base, MESOS_AJUST);

  if (Math.abs(baseMj) < 0.01) return null;

  const percent = (Math.abs(compresMj) / Math.abs(baseMj)) * 100;
  const percentOk = Math.abs(baseOk) > 0.01 ? (Math.abs(compresOk) / Math.abs(baseOk)) * 100 : null;
  const percentAny =
    Math.abs(baseAny) > 0.01 ? (Math.abs(compresAny) / Math.abs(baseAny)) * 100 : null;

  const files = MESOS_AJUST.map((mes) => {
    const b = base.get(mes) ?? 0;
    const sap = compres.get(mes) ?? 0;
    const objectiu = -(Math.abs(b) * (percent / 100));
    const ajust = Math.round((objectiu - sap) * 100) / 100;
    return {
      mes,
      mesNom: MESOS_LLARGS[mes - 1] ?? `Mes ${mes}`,
      base: b,
      sap,
      objectiu: Math.round(objectiu * 100) / 100,
      ajust,
    };
  });

  const sumaAjust = files.reduce((s, f) => s + f.ajust, 0);

  return {
    any,
    lnCodi: ln.codi,
    lnNom: ln.nom,
    nodeCompres,
    nodeCompresLabel,
    nodeBase,
    nodeBaseLabel,
    percent,
    percentTxt: percent.toFixed(2).replace(".", ","),
    compresAny,
    compresOk,
    compresMj,
    baseAny,
    baseOk,
    baseMj,
    percentOk,
    percentAny,
    files,
    sumaAjust: Math.round(sumaAjust * 100) / 100,
  };
}

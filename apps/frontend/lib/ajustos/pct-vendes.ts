import { db } from "@/lib/db";
import { prismaWhereDadaPerLnInforme } from "@/lib/linia-informe";
import { MESOS_LLARGS } from "@/lib/periodes";
import { NODE_INGRESSOS, NODE_VENDES } from "@/lib/repartiment/nodes";

export type BasePctVendes = "vendes" | "ingressos";

export type AmbitAjustPct = {
  centreId: string | null;
  liniaNegociId: string | null;
};

export type PreviewAjustPctMes = {
  mes: number;
  periodId: string | null;
  base: number;
  sap: number;
  objectiu: number;
  importAjust: number;
};

function nodeBase(base: BasePctVendes): number {
  return base === "ingressos" ? NODE_INGRESSOS : NODE_VENDES;
}

function whereAmbitDades(ambit: AmbitAjustPct) {
  if (ambit.centreId) return { centreId: ambit.centreId };
  if (ambit.liniaNegociId) return prismaWhereDadaPerLnInforme(ambit.liniaNegociId);
  return null;
}

export function whereAmbitAjust(ambit: AmbitAjustPct) {
  if (ambit.centreId) return { centreId: ambit.centreId, liniaNegociId: null as string | null };
  if (ambit.liniaNegociId)
    return { centreId: null as string | null, liniaNegociId: ambit.liniaNegociId };
  return null;
}

async function sumaNodePerMes(
  any: number,
  mesos: number[],
  node: number,
  ambit: AmbitAjustPct
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (const m of mesos) out.set(m, 0);

  const whereAmbit = whereAmbitDades(ambit);
  if (!whereAmbit) return out;

  const concepte = await db.concepteResultat.findUnique({
    where: { node },
    select: { id: true },
  });
  if (!concepte) return out;

  const dades = await db.dadaResultat.findMany({
    where: {
      concepteResultatId: concepte.id,
      period: { any, mes: { in: mesos } },
      ...whereAmbit,
    },
    select: { import_: true, period: { select: { mes: true } } },
  });

  for (const d of dades) {
    const mes = d.period.mes;
    out.set(mes, (out.get(mes) ?? 0) + Number(d.import_));
  }
  return out;
}

/**
 * Objectiu de cost = −% × |base|.
 * Ajust = objectiu − SAP (perquè Directe = SAP + ajust quedi a l'objectiu).
 */
export function calcularImportAjustPct(opts: {
  base: number;
  sap: number;
  percent: number;
}): { objectiu: number; importAjust: number } {
  const objectiu = -(Math.abs(opts.base) * (opts.percent / 100));
  const importAjust = objectiu - opts.sap;
  return { objectiu, importAjust };
}

export async function previsualitzaAjustPctVendes(opts: {
  any: number;
  mesos: number[];
  concepteResultatId: string;
  centreId: string | null;
  liniaNegociId: string | null;
  percent: number;
  basePct: BasePctVendes;
}): Promise<{ ok: true; files: PreviewAjustPctMes[] } | { ok: false; missatge: string }> {
  const mesos = [...new Set(opts.mesos)]
    .map((m) => Number(m))
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12)
    .sort((a, b) => a - b);

  if (!opts.concepteResultatId) return { ok: false, missatge: "Cal seleccionar un concepte." };
  if ((!opts.centreId && !opts.liniaNegociId) || (opts.centreId && opts.liniaNegociId)) {
    return { ok: false, missatge: "Cal seleccionar un centre o una línia de negoci (no ambdós)." };
  }
  if (!Number.isFinite(opts.percent) || opts.percent <= 0 || opts.percent > 100) {
    return { ok: false, missatge: "El % ha d'estar entre 0 (exclòs) i 100." };
  }
  if (mesos.length === 0) return { ok: false, missatge: "Selecciona com a mínim un mes." };

  const ambit: AmbitAjustPct = {
    centreId: opts.centreId,
    liniaNegociId: opts.liniaNegociId,
  };

  const concepte = await db.concepteResultat.findUnique({
    where: { id: opts.concepteResultatId },
    select: { id: true, node: true, esSubtotal: true, descripcio: true },
  });
  if (!concepte) return { ok: false, missatge: "Concepte no trobat." };
  if (concepte.esSubtotal) {
    return {
      ok: false,
      missatge: `«${concepte.descripcio}» és un subtotal: ajusta la línia de detall (p.ex. COMPRES), no el total.`,
    };
  }

  const periods = await db.period.findMany({
    where: { any: opts.any, mes: { in: mesos } },
    select: { id: true, mes: true },
  });
  const periodByMes = new Map(periods.map((p) => [p.mes, p.id]));

  const [bases, saps] = await Promise.all([
    sumaNodePerMes(opts.any, mesos, nodeBase(opts.basePct), ambit),
    sumaNodePerMes(opts.any, mesos, concepte.node, ambit),
  ]);

  const files: PreviewAjustPctMes[] = mesos.map((mes) => {
    const base = bases.get(mes) ?? 0;
    const sap = saps.get(mes) ?? 0;
    const { objectiu, importAjust } = calcularImportAjustPct({
      base,
      sap,
      percent: opts.percent,
    });
    return {
      mes,
      periodId: periodByMes.get(mes) ?? null,
      base,
      sap,
      objectiu,
      importAjust: Math.round(importAjust * 100) / 100,
    };
  });

  return { ok: true, files };
}

export function motiuPctVendes(percent: number, basePct: BasePctVendes, any: number): string {
  const pctTxt = String(percent).replace(".", ",");
  const baseTxt = basePct === "ingressos" ? "ingressos" : "vendes";
  return `${pctTxt}% s/ ${baseTxt} · reconstrucció ${any}`;
}

export function etiquetaMes(mes: number): string {
  return MESOS_LLARGS[mes - 1] ?? `Mes ${mes}`;
}

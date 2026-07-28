/** Constants de períodes — segures per a client i servidor (sense dependències de BD). */

export const MESOS_CURTS = [
  "Gen",
  "Feb",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Oct",
  "Nov",
  "Des",
];

export const MESOS_LLARGS = [
  "Gener",
  "Febrer",
  "Març",
  "Abril",
  "Maig",
  "Juny",
  "Juliol",
  "Agost",
  "Setembre",
  "Octubre",
  "Novembre",
  "Desembre",
];

/** Interval inclusiu de mesos (1 = gener … 12 = desembre). */
export type RangMesos = { des: number; fins: number };

export function normalitzaRangMesos(des: number, fins: number): RangMesos {
  const clamp = (n: number) => Math.min(12, Math.max(1, Math.round(n)));
  const d = clamp(Number.isFinite(des) ? des : 1);
  const f = clamp(Number.isFinite(fins) ? fins : 12);
  return d <= f ? { des: d, fins: f } : { des: f, fins: d };
}

/**
 * Llegeix el rang des de searchParams.
 * - `des` + `fins` (nou)
 * - `mes` sol (llegat: un sol mes)
 * - sense params → tot l'any
 */
export function parseRangMesosFromSearchParams(sp: {
  mes?: string;
  des?: string;
  fins?: string;
}): RangMesos {
  if (sp.des != null || sp.fins != null) {
    const des = sp.des != null && sp.des !== "" ? Number(sp.des) : 1;
    const fins = sp.fins != null && sp.fins !== "" ? Number(sp.fins) : des;
    return normalitzaRangMesos(des, fins);
  }
  if (sp.mes != null && sp.mes !== "") {
    const m = Number(sp.mes);
    return normalitzaRangMesos(m, m);
  }
  return { des: 1, fins: 12 };
}

export function esAnyComplet(r: RangMesos): boolean {
  return r.des === 1 && r.fins === 12;
}

export function esUnMes(r: RangMesos): boolean {
  return r.des === r.fins;
}

/** Etiqueta curta per KPIs / subtítols (p.ex. «Gen – Mai 2026»). */
export function etiquetaRangMesos(r: RangMesos, any: number): string {
  if (esAnyComplet(r)) return `Acumulat ${any}`;
  if (esUnMes(r)) return `${MESOS_LLARGS[r.des - 1]} ${any}`;
  return `${MESOS_CURTS[r.des - 1]} – ${MESOS_CURTS[r.fins - 1]} ${any}`;
}

/** Etiqueta llarga per presentació (p.ex. «Gener – Maig 2026»). */
export function etiquetaRangMesosLlarga(r: RangMesos, any: number): string {
  if (esAnyComplet(r)) return `Any ${any}`;
  if (esUnMes(r)) return `${MESOS_LLARGS[r.des - 1]} ${any}`;
  return `${MESOS_LLARGS[r.des - 1]} – ${MESOS_LLARGS[r.fins - 1]} ${any}`;
}

/** Filtre Prisma `period` per un any i rang de mesos. */
export function prismaPeriodFilter(any: number, r: RangMesos) {
  if (esAnyComplet(r)) return { any };
  if (esUnMes(r)) return { any, mes: r.des };
  return { any, mes: { gte: r.des, lte: r.fins } };
}

/** Fragment de query string (`&des=1&fins=5`). Tot l'any → cadena buida. */
export function rangToQuery(r: RangMesos): string {
  if (esAnyComplet(r)) return "";
  return `&des=${r.des}&fins=${r.fins}`;
}

/**
 * Noms de mes corporatius (català) — única font de veritat.
 *
 * Usar sempre aquest mòdul. No definir llistes locals de mesos.
 * Als selects i etiquetes visibles: `lang="ca" translate="no"` per evitar
 * que el traductor del navegador deformi abreviatures (p.ex. «Set» → «Conjunt»).
 */

export type MesDef = {
  /** 1 = gener … 12 = desembre */
  num: number;
  /** Abreviatura corporativa (taules, gràfics, columnes). */
  curt: string;
  /** Nom complet (selectors, títols, imports). */
  llarg: string;
};

/** Font canònica. Qualsevol canvi de naming es fa només aquí. */
export const MESOS: readonly MesDef[] = [
  { num: 1, curt: "Gen", llarg: "Gener" },
  { num: 2, curt: "Feb", llarg: "Febrer" },
  { num: 3, curt: "Mar", llarg: "Març" },
  { num: 4, curt: "Abr", llarg: "Abril" },
  { num: 5, curt: "Mai", llarg: "Maig" },
  { num: 6, curt: "Jun", llarg: "Juny" },
  { num: 7, curt: "Jul", llarg: "Juliol" },
  { num: 8, curt: "Ago", llarg: "Agost" },
  { num: 9, curt: "Set", llarg: "Setembre" },
  { num: 10, curt: "Oct", llarg: "Octubre" },
  { num: 11, curt: "Nov", llarg: "Novembre" },
  { num: 12, curt: "Des", llarg: "Desembre" },
] as const;

/** Abreviatures (índex 0 = gener). Preferir `nomMes` / `etiquetaMesos`. */
export const MESOS_CURTS: string[] = MESOS.map((m) => m.curt);

/** Noms complets (índex 0 = gener). Preferir als `<select>`. */
export const MESOS_LLARGS: string[] = MESOS.map((m) => m.llarg);

export type FormaMes = "curt" | "llarg";

/** Nom d’un mes (1–12). Fora de rang → «Mes N». */
export function nomMes(mes: number, forma: FormaMes = "llarg"): string {
  const def = MESOS[mes - 1];
  if (!def) return `Mes ${mes}`;
  return forma === "curt" ? def.curt : def.llarg;
}

/** Opcions per a `<select>` (value = 1–12). */
export function opcionsMesos(forma: FormaMes = "llarg"): { value: number; label: string }[] {
  return MESOS.map((m) => ({
    value: m.num,
    label: forma === "curt" ? m.curt : m.llarg,
  }));
}

/** Llista de mesos 1–12 → etiqueta unida (p.ex. «Gen · Feb · Mar»). */
export function etiquetaMesos(
  mesos: readonly number[],
  forma: FormaMes = "curt",
  sep = " · "
): string {
  return mesos.map((m) => nomMes(m, forma)).join(sep);
}

/** Map 1–12 → nom llarg (compat. amb codi antic tipus `MESOS_NOMS[mes]`). */
export const MESOS_PER_NUM: Record<number, string> = Object.fromEntries(
  MESOS.map((m) => [m.num, m.llarg])
);

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
  if (esUnMes(r)) return `${nomMes(r.des, "llarg")} ${any}`;
  return `${nomMes(r.des, "curt")} – ${nomMes(r.fins, "curt")} ${any}`;
}

/** Etiqueta llarga per presentació (p.ex. «Gener – Maig 2026»). */
export function etiquetaRangMesosLlarga(r: RangMesos, any: number): string {
  if (esAnyComplet(r)) return `Any ${any}`;
  if (esUnMes(r)) return `${nomMes(r.des, "llarg")} ${any}`;
  return `${nomMes(r.des, "llarg")} – ${nomMes(r.fins, "llarg")} ${any}`;
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

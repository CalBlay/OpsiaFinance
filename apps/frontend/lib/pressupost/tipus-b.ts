/** Categories Tipus B per defecte (catàleg general, no per departament). */
export const CATEGORIES_TIPUS_B_DEFAULT = [
  { key: "personal", label: "Personal" },
  { key: "publicitat", label: "Publicitat / comunicació" },
  { key: "serveis", label: "Serveis externs" },
  { key: "viatges", label: "Viatges / representació" },
  { key: "material", label: "Material / consumibles" },
  { key: "formacio", label: "Formació" },
  { key: "altres", label: "Altres" },
] as const;

/** @deprecated usa CATEGORIES_TIPUS_B_DEFAULT */
export const CATEGORIES_TIPUS_B = CATEGORIES_TIPUS_B_DEFAULT;

export type CategoriaOpt = { key: string; label: string };

export const PERIODICITATS_TIPUS_B = [
  { key: "MENSUAL", label: "Mensual", hint: "Cada mes de l’any" },
  { key: "TRIMESTRAL", label: "Trimestral", hint: "4 desemborsaments" },
  { key: "ANUAL", label: "Anual", hint: "Un sol desemborsament" },
  { key: "PUNTUAL", label: "Puntual", hint: "Un mes concret" },
  { key: "PERSONALITZAT", label: "Personalitzat", hint: "Tries els mesos" },
] as const;

export type PeriodicitatTipusB = (typeof PERIODICITATS_TIPUS_B)[number]["key"];

export function esPeriodicitatTipusB(v: string): v is PeriodicitatTipusB {
  return PERIODICITATS_TIPUS_B.some((p) => p.key === v);
}

export function labelPeriodicitat(key: string): string {
  return PERIODICITATS_TIPUS_B.find((p) => p.key === key)?.label ?? key;
}

/** Genera clau estable a partir del nom visible. */
export function slugCategoria(label: string): string {
  const s = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return s || "altres";
}

export function esCategoriaKeyValida(key: string): boolean {
  return /^[a-z0-9_]{1,64}$/.test(key);
}

export function labelDesDeKey(key: string): string {
  const def = CATEGORIES_TIPUS_B_DEFAULT.find((c) => c.key === key);
  if (def) return def.label;
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function labelCategoria(key: string, cataleg?: CategoriaOpt[]): string {
  const fromList = cataleg?.find((c) => c.key === key)?.label;
  if (fromList) return fromList;
  return labelDesDeKey(key);
}

/** Mesos per defecte segons periodicitat (1–12). */
export function mesosPerDefecte(periodicitat: PeriodicitatTipusB, mesAncora = 1): number[] {
  const a = Math.min(12, Math.max(1, mesAncora));
  switch (periodicitat) {
    case "MENSUAL":
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    case "TRIMESTRAL": {
      const out: number[] = [];
      for (let m = a; m <= 12; m += 3) out.push(m);
      return out.length ? out : [a];
    }
    case "ANUAL":
    case "PUNTUAL":
      return [a];
    case "PERSONALITZAT":
      return [a];
  }
}

export function normalitzaMesos(raw: unknown): number[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      return [];
    }
  } else if (raw && typeof raw === "object") {
    arr = Object.values(raw as Record<string, unknown>);
  } else {
    return [];
  }
  const set = new Set<number>();
  for (const v of arr) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 12) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export function importAnualLinia(importUnitari: number, mesos: number[]): number {
  const u = Math.round(Math.abs(importUnitari) * 100) / 100;
  return Math.round(u * mesos.length * 100) / 100;
}

export function distribucioMensual(importUnitari: number, mesos: number[]): number[] {
  const out = Array.from({ length: 12 }, () => 0);
  const u = Math.round(Math.abs(importUnitari) * 100) / 100;
  for (const m of mesos) {
    if (m >= 1 && m <= 12) out[m - 1] = u;
  }
  return out;
}

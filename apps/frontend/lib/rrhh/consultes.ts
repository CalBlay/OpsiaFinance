import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { MESOS_CURTS, MESOS_LLARGS } from "@/lib/periodes";
import { unstable_cache } from "next/cache";
import { cache } from "react";

export type RrhhFila = {
  key: string;
  label: string;
  sublabel?: string;
  nombrePersones: number;
  horesSetmanals: number;
  /** Hores mitjanes per persona (si persones > 0). */
  horesPerPersona: number | null;
};

export type RrhhInforme = {
  any: number;
  mes: number | null;
  periodeLabel: string;
  totals: { nombrePersones: number; horesSetmanals: number };
  files: RrhhFila[];
  buit: boolean;
};

export type RrhhComparativaFila = {
  key: string;
  label: string;
  sublabel?: string;
  personesA: number;
  personesB: number;
  deltaPersones: number;
  horesA: number;
  horesB: number;
  deltaHores: number;
};

export type RrhhComparativa = {
  labelA: string;
  labelB: string;
  totalsA: { nombrePersones: number; horesSetmanals: number };
  totalsB: { nombrePersones: number; horesSetmanals: number };
  files: RrhhComparativaFila[];
  buit: boolean;
};

type RawRow = {
  centreId: string;
  departamentId: string | null;
  nombrePersones: number;
  horesSetmanals: number;
  centre: {
    id: string;
    codi: string;
    nom: string;
    liniaNegociId: string;
    liniaNegoci: { id: string; codi: string; nom: string };
  };
  departament: { id: string; codi: string; nom: string } | null;
  period: { any: number; mes: number; nom: string };
};

function periodWhere(any: number, mes: number | null) {
  return mes != null ? { any, mes } : { any };
}

function periodeLabel(any: number, mes: number | null): string {
  if (mes == null) return `Acumulat ${any}`;
  return `${MESOS_LLARGS[mes - 1]} ${any}`;
}

function horesPerPersona(persones: number, hores: number): number | null {
  if (persones <= 0) return null;
  return hores / persones;
}

async function carregarFiles(
  any: number,
  mes: number | null,
  filtre?: { liniaNegociId?: string | null; centreId?: string | null }
): Promise<RawRow[]> {
  const rows = await db.plantillaJornada.findMany({
    where: {
      period: periodWhere(any, mes),
      ...(filtre?.centreId ? { centreId: filtre.centreId } : {}),
      ...(filtre?.liniaNegociId ? { centre: { liniaNegociId: filtre.liniaNegociId } } : {}),
    },
    select: {
      centreId: true,
      departamentId: true,
      nombrePersones: true,
      horesSetmanals: true,
      centre: {
        select: {
          id: true,
          codi: true,
          nom: true,
          liniaNegociId: true,
          liniaNegoci: { select: { id: true, codi: true, nom: true } },
        },
      },
      departament: { select: { id: true, codi: true, nom: true } },
      period: { select: { any: true, mes: true, nom: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    horesSetmanals: Number(r.horesSetmanals),
  }));
}

/** Mitjana mensual quan es consulta tot l'any (mesos amb dades). */
function agregarAmbMitjanaAnual(
  rows: RawRow[],
  mes: number | null,
  keyFor: (r: RawRow) => string,
  labelFor: (r: RawRow) => { label: string; sublabel?: string }
): RrhhFila[] {
  type Acc = {
    key: string;
    label: string;
    sublabel?: string;
    perMes: Map<number, { persones: number; hores: number }>;
  };
  const map = new Map<string, Acc>();

  for (const r of rows) {
    if (mes != null && r.period.mes !== mes) continue;
    const key = keyFor(r);
    const meta = labelFor(r);
    let acc = map.get(key);
    if (!acc) {
      acc = { key, label: meta.label, sublabel: meta.sublabel, perMes: new Map() };
      map.set(key, acc);
    }
    const m = r.period.mes;
    const prev = acc.perMes.get(m) ?? { persones: 0, hores: 0 };
    prev.persones += r.nombrePersones;
    prev.hores += r.horesSetmanals;
    acc.perMes.set(m, prev);
  }

  const out: RrhhFila[] = [];
  for (const acc of map.values()) {
    const mesos = [...acc.perMes.values()];
    if (!mesos.length) continue;
    const divisor = mes == null ? mesos.length : 1;
    const persones = mesos.reduce((s, x) => s + x.persones, 0) / divisor;
    const hores = mesos.reduce((s, x) => s + x.hores, 0) / divisor;
    out.push({
      key: acc.key,
      label: acc.label,
      sublabel: acc.sublabel,
      nombrePersones: persones,
      horesSetmanals: hores,
      horesPerPersona: horesPerPersona(persones, hores),
    });
  }

  return out.sort(
    (a, b) => b.nombrePersones - a.nombrePersones || a.label.localeCompare(b.label, "ca")
  );
}

function totalsDe(files: RrhhFila[]) {
  return {
    nombrePersones: files.reduce((s, f) => s + f.nombrePersones, 0),
    horesSetmanals: files.reduce((s, f) => s + f.horesSetmanals, 0),
  };
}

export const getAnysRrhh = cache(async (): Promise<number[]> => {
  return unstable_cache(
    async () => {
      const rows = await db.period.findMany({
        where: { plantillesJornada: { some: {} } },
        select: { any: true },
        distinct: ["any"],
      });
      return rows.map((r) => r.any).sort((a, b) => b - a);
    },
    consultesCacheKey("rrhh-anys-v1"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
});

export async function getInformeRrhhLinies(any: number, mes: number | null): Promise<RrhhInforme> {
  return unstable_cache(
    async () => {
      const rows = await carregarFiles(any, mes);
      const files = agregarAmbMitjanaAnual(
        rows,
        mes,
        (r) => r.centre.liniaNegociId,
        (r) => ({
          label: `${r.centre.liniaNegoci.codi} · ${r.centre.liniaNegoci.nom}`,
        })
      );
      return {
        any,
        mes,
        periodeLabel: periodeLabel(any, mes),
        totals: totalsDe(files),
        files,
        buit: files.length === 0,
      };
    },
    consultesCacheKey("rrhh-ln-v1", String(any), String(mes ?? 0)),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 60 }
  )();
}

export async function getInformeRrhhCentres(
  any: number,
  mes: number | null,
  liniaNegociId?: string | null
): Promise<RrhhInforme> {
  const lnKey = liniaNegociId ?? "";
  return unstable_cache(
    async () => {
      const rows = await carregarFiles(any, mes, { liniaNegociId });
      const files = agregarAmbMitjanaAnual(
        rows,
        mes,
        (r) => r.centreId,
        (r) => ({
          label: `${r.centre.codi} · ${r.centre.nom}`,
          sublabel: `${r.centre.liniaNegoci.codi} · ${r.centre.liniaNegoci.nom}`,
        })
      );
      return {
        any,
        mes,
        periodeLabel: periodeLabel(any, mes),
        totals: totalsDe(files),
        files,
        buit: files.length === 0,
      };
    },
    consultesCacheKey("rrhh-centres-v1", String(any), String(mes ?? 0), lnKey),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 60 }
  )();
}

export async function getInformeRrhhDepartaments(
  any: number,
  mes: number | null,
  filtre?: { liniaNegociId?: string | null; centreId?: string | null }
): Promise<RrhhInforme> {
  const lnKey = filtre?.liniaNegociId ?? "";
  const cKey = filtre?.centreId ?? "";
  return unstable_cache(
    async () => {
      const rows = await carregarFiles(any, mes, filtre);
      const files = agregarAmbMitjanaAnual(
        rows,
        mes,
        (r) => `${r.centreId}::${r.departamentId ?? "_"}`,
        (r) => ({
          label: r.departament
            ? `${r.departament.codi} · ${r.departament.nom}`
            : "Sense departament",
          sublabel: `${r.centre.codi} · ${r.centre.nom}`,
        })
      );
      return {
        any,
        mes,
        periodeLabel: periodeLabel(any, mes),
        totals: totalsDe(files),
        files,
        buit: files.length === 0,
      };
    },
    consultesCacheKey("rrhh-depts-v1", String(any), String(mes ?? 0), lnKey, cKey),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 60 }
  )();
}

export async function getComparativaRrhh(
  a: { any: number; mes: number | null },
  b: { any: number; mes: number | null },
  nivell: "linia" | "centre" | "departament",
  filtre?: { liniaNegociId?: string | null; centreId?: string | null }
): Promise<RrhhComparativa> {
  const [infA, infB] = await Promise.all([
    nivell === "linia"
      ? getInformeRrhhLinies(a.any, a.mes)
      : nivell === "centre"
        ? getInformeRrhhCentres(a.any, a.mes, filtre?.liniaNegociId)
        : getInformeRrhhDepartaments(a.any, a.mes, filtre),
    nivell === "linia"
      ? getInformeRrhhLinies(b.any, b.mes)
      : nivell === "centre"
        ? getInformeRrhhCentres(b.any, b.mes, filtre?.liniaNegociId)
        : getInformeRrhhDepartaments(b.any, b.mes, filtre),
  ]);

  const keys = new Set([...infA.files.map((f) => f.key), ...infB.files.map((f) => f.key)]);
  const meta = new Map<string, { label: string; sublabel?: string }>();
  for (const f of [...infA.files, ...infB.files]) {
    if (!meta.has(f.key)) meta.set(f.key, { label: f.label, sublabel: f.sublabel });
  }
  const mapA = new Map(infA.files.map((f) => [f.key, f]));
  const mapB = new Map(infB.files.map((f) => [f.key, f]));

  const files: RrhhComparativaFila[] = [...keys].map((key) => {
    const fa = mapA.get(key);
    const fb = mapB.get(key);
    const m = meta.get(key)!;
    const personesA = fa?.nombrePersones ?? 0;
    const personesB = fb?.nombrePersones ?? 0;
    const horesA = fa?.horesSetmanals ?? 0;
    const horesB = fb?.horesSetmanals ?? 0;
    return {
      key,
      label: m.label,
      sublabel: m.sublabel,
      personesA,
      personesB,
      deltaPersones: personesB - personesA,
      horesA,
      horesB,
      deltaHores: horesB - horesA,
    };
  });

  files.sort(
    (x, y) =>
      Math.abs(y.deltaPersones) - Math.abs(x.deltaPersones) || x.label.localeCompare(y.label, "ca")
  );

  return {
    labelA: periodeLabel(a.any, a.mes),
    labelB: periodeLabel(b.any, b.mes),
    totalsA: infA.totals,
    totalsB: infB.totals,
    files,
    buit: files.length === 0,
  };
}

export function etiquetaMesCurt(mes: number): string {
  return MESOS_CURTS[mes - 1] ?? String(mes);
}

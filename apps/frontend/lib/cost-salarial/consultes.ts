import { ordenaPerCodi } from "@/lib/consultes-etiquetes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import { costTotalLinia, normalitzaNomRestaurant } from "@/lib/cost-salarial/import";
import { db } from "@/lib/db";
import { NODE_VENDES } from "@/lib/kpi-definitions";

export const PARTIDES_SALARIALS = [
  { key: "totalSalari", label: "Total salari" },
  { key: "incentiusMensual", label: "Incentius mensual" },
  { key: "incentiuTrimestral", label: "Incentiu trimestral" },
  { key: "horesExtres", label: "Hores extres" },
  { key: "altres", label: "Altres" },
  { key: "baixes", label: "Baixes" },
  { key: "indemnitzacions", label: "Indemnitzacions" },
  { key: "foraCentre", label: "Fora centre" },
] as const;

export type PartidaKey = (typeof PARTIDES_SALARIALS)[number]["key"];

export interface PartidaImport {
  key: PartidaKey;
  label: string;
  import_: number;
  pct: number | null;
}

export interface BlocDepartament {
  departament: "SALA" | "CUINA";
  label: string;
  partides: PartidaImport[];
  total: number;
  pctSobreTotal: number | null;
}

export interface InformeRestaurant {
  centre: { id: string; codi: string; nom: string; etiqueta: string };
  any: number;
  mes: number | null;
  sala: BlocDepartament;
  cuina: BlocDepartament;
  partidesTotals: PartidaImport[];
  costTotal: number;
  vendes: number;
  pctSobreVendes: number | null;
  buit: boolean;
}

export interface FilaComparativaRestaurant {
  centre: { id: string; codi: string; nom: string; etiqueta: string };
  sala: number;
  cuina: number;
  costTotal: number;
  partides: Record<PartidaKey, number>;
  pctSala: number | null;
  pctCuina: number | null;
  vendes: number;
  pctSobreVendes: number | null;
}

export interface ComparativaRestaurants {
  any: number;
  mes: number | null;
  files: FilaComparativaRestaurant[];
  totals: {
    sala: number;
    cuina: number;
    costTotal: number;
    partides: Record<PartidaKey, number>;
    vendes: number;
    pctSobreVendes: number | null;
  };
  buit: boolean;
}

type RowDB = {
  centreId: string;
  departament: "SALA" | "CUINA";
  totalSalari: unknown;
  incentiusMensual: unknown;
  incentiuTrimestral: unknown;
  horesExtres: unknown;
  altres: unknown;
  baixes: unknown;
  indemnitzacions: unknown;
  foraCentre: unknown;
  centre: { id: string; codi: string; nom: string };
  period: { any: number; mes: number };
};

function n(v: unknown): number {
  return Number(v);
}

function emptyPartides(): Record<PartidaKey, number> {
  return {
    totalSalari: 0,
    incentiusMensual: 0,
    incentiuTrimestral: 0,
    horesExtres: 0,
    altres: 0,
    baixes: 0,
    indemnitzacions: 0,
    foraCentre: 0,
  };
}

function sumaPartides(acc: Record<PartidaKey, number>, row: RowDB): Record<PartidaKey, number> {
  acc.totalSalari += n(row.totalSalari);
  acc.incentiusMensual += n(row.incentiusMensual);
  acc.incentiuTrimestral += n(row.incentiuTrimestral);
  acc.horesExtres += n(row.horesExtres);
  acc.altres += n(row.altres);
  acc.baixes += n(row.baixes);
  acc.indemnitzacions += n(row.indemnitzacions);
  acc.foraCentre += n(row.foraCentre);
  return acc;
}

function totalDePartides(p: Record<PartidaKey, number>): number {
  return costTotalLinia(p);
}

function aPartidesLlista(p: Record<PartidaKey, number>, total: number): PartidaImport[] {
  return PARTIDES_SALARIALS.map((def) => ({
    key: def.key,
    label: def.label,
    import_: p[def.key],
    pct: total ? (p[def.key] / total) * 100 : null,
  }));
}

function pct(part: number, total: number): number | null {
  return total ? (part / total) * 100 : null;
}

async function getVendesPerCentres(
  centreIds: string[],
  any: number,
  mes: number | null
): Promise<Map<string, number>> {
  if (!centreIds.length) return new Map();

  const concepte = await db.concepteResultat.findUnique({
    where: { node: NODE_VENDES },
    select: { id: true },
  });
  if (!concepte) return new Map();

  const dades = await db.dadaResultat.findMany({
    where: {
      centreId: { in: centreIds },
      concepteResultatId: concepte.id,
      period: mes != null ? { any, mes } : { any },
    },
    select: { centreId: true, import_: true },
  });

  const map = new Map<string, number>();
  for (const d of dades) {
    if (!d.centreId) continue;
    map.set(d.centreId, (map.get(d.centreId) ?? 0) + Number(d.import_));
  }
  return map;
}

async function carregaFiles(
  any: number,
  mes: number | null,
  centreId?: string | null
): Promise<RowDB[]> {
  return db.costSalarialRestaurant.findMany({
    where: {
      ...(centreId ? { centreId } : {}),
      period: mes != null ? { any, mes } : { any },
      centre: { isActive: true, liniaNegoci: { codi: "LN00001" } },
    },
    select: {
      centreId: true,
      departament: true,
      totalSalari: true,
      incentiusMensual: true,
      incentiuTrimestral: true,
      horesExtres: true,
      altres: true,
      baixes: true,
      indemnitzacions: true,
      foraCentre: true,
      centre: { select: { id: true, codi: true, nom: true } },
      period: { select: { any: true, mes: true } },
    },
    orderBy: [{ centre: { ordre: "asc" } }, { departament: "asc" }],
  }) as Promise<RowDB[]>;
}

function blocBuit(departament: "SALA" | "CUINA"): BlocDepartament {
  const partides = emptyPartides();
  return {
    departament,
    label: departament === "SALA" ? "Sala" : "Cuina",
    partides: aPartidesLlista(partides, 0),
    total: 0,
    pctSobreTotal: null,
  };
}

export async function getAnysCostSalarial(): Promise<number[]> {
  const periods = await db.period.findMany({
    where: { costsSalarials: { some: {} } },
    select: { any: true },
    distinct: ["any"],
    orderBy: { any: "desc" },
  });
  return periods.map((p) => p.any);
}

export async function getCentresRestaurants(nomesMirallFdlc = false) {
  const ln = await db.liniaNegoci.findUnique({
    where: { codi: "LN00001" },
    select: {
      centres: {
        where: { isActive: true },
        select: { id: true, codi: true, nom: true },
      },
    },
  });
  const { CENTRE_CODI_MIRALL_SERVEIS_FDLC } = await import("@/lib/fdlc/mirall-vendes-centre");
  return ordenaPerCodi(
    (ln?.centres ?? [])
      .filter((c) => !nomesMirallFdlc || c.codi === CENTRE_CODI_MIRALL_SERVEIS_FDLC)
      .map((c) => ({
        ...c,
        etiqueta: etiquetaGrafic(c) || normalitzaNomRestaurant(c.nom),
      }))
  );
}

export async function getInformeRestaurant(
  centreId: string,
  any: number,
  mes: number | null
): Promise<InformeRestaurant> {
  const [files, centre, vendesMap] = await Promise.all([
    carregaFiles(any, mes, centreId),
    db.centre.findUnique({
      where: { id: centreId },
      select: { id: true, codi: true, nom: true },
    }),
    getVendesPerCentres([centreId], any, mes),
  ]);

  const centreInfo = centre
    ? {
        id: centre.id,
        codi: centre.codi,
        nom: centre.nom,
        etiqueta: etiquetaGrafic(centre),
      }
    : { id: centreId, codi: "", nom: "", etiqueta: "" };

  if (!files.length || !centre) {
    return {
      centre: centreInfo,
      any,
      mes,
      sala: blocBuit("SALA"),
      cuina: blocBuit("CUINA"),
      partidesTotals: aPartidesLlista(emptyPartides(), 0),
      costTotal: 0,
      vendes: 0,
      pctSobreVendes: null,
      buit: true,
    };
  }

  const salaP = emptyPartides();
  const cuinaP = emptyPartides();
  for (const f of files) {
    if (f.departament === "SALA") sumaPartides(salaP, f);
    else sumaPartides(cuinaP, f);
  }

  const salaTotal = totalDePartides(salaP);
  const cuinaTotal = totalDePartides(cuinaP);
  const costTotal = salaTotal + cuinaTotal;
  const totals = emptyPartides();
  for (const k of Object.keys(totals) as PartidaKey[]) {
    totals[k] = salaP[k] + cuinaP[k];
  }

  const vendes = vendesMap.get(centreId) ?? 0;

  return {
    centre: centreInfo,
    any,
    mes,
    sala: {
      departament: "SALA",
      label: "Sala",
      partides: aPartidesLlista(salaP, salaTotal),
      total: salaTotal,
      pctSobreTotal: pct(salaTotal, costTotal),
    },
    cuina: {
      departament: "CUINA",
      label: "Cuina",
      partides: aPartidesLlista(cuinaP, cuinaTotal),
      total: cuinaTotal,
      pctSobreTotal: pct(cuinaTotal, costTotal),
    },
    partidesTotals: aPartidesLlista(totals, costTotal),
    costTotal,
    vendes,
    pctSobreVendes: pct(costTotal, Math.abs(vendes)),
    buit: false,
  };
}

export async function getComparativaRestaurants(
  any: number,
  mes: number | null
): Promise<ComparativaRestaurants> {
  const files = await carregaFiles(any, mes);
  if (!files.length) {
    return {
      any,
      mes,
      files: [],
      totals: {
        sala: 0,
        cuina: 0,
        costTotal: 0,
        partides: emptyPartides(),
        vendes: 0,
        pctSobreVendes: null,
      },
      buit: true,
    };
  }

  const perCentre = new Map<
    string,
    {
      centre: { id: string; codi: string; nom: string };
      sala: Record<PartidaKey, number>;
      cuina: Record<PartidaKey, number>;
    }
  >();

  for (const f of files) {
    let entry = perCentre.get(f.centreId);
    if (!entry) {
      entry = {
        centre: f.centre,
        sala: emptyPartides(),
        cuina: emptyPartides(),
      };
      perCentre.set(f.centreId, entry);
    }
    if (f.departament === "SALA") sumaPartides(entry.sala, f);
    else sumaPartides(entry.cuina, f);
  }

  const centreIds = [...perCentre.keys()];
  const vendesMap = await getVendesPerCentres(centreIds, any, mes);

  const filesOut: FilaComparativaRestaurant[] = [];
  const totalsPartides = emptyPartides();
  let totalSala = 0;
  let totalCuina = 0;
  let totalVendes = 0;

  for (const entry of perCentre.values()) {
    const sala = totalDePartides(entry.sala);
    const cuina = totalDePartides(entry.cuina);
    const costTotal = sala + cuina;
    const partides = emptyPartides();
    for (const k of Object.keys(partides) as PartidaKey[]) {
      partides[k] = entry.sala[k] + entry.cuina[k];
      totalsPartides[k] += partides[k];
    }
    totalSala += sala;
    totalCuina += cuina;
    const vendes = vendesMap.get(entry.centre.id) ?? 0;
    totalVendes += vendes;

    filesOut.push({
      centre: {
        id: entry.centre.id,
        codi: entry.centre.codi,
        nom: entry.centre.nom,
        etiqueta: etiquetaGrafic(entry.centre),
      },
      sala,
      cuina,
      costTotal,
      partides,
      pctSala: pct(sala, costTotal),
      pctCuina: pct(cuina, costTotal),
      vendes,
      pctSobreVendes: pct(costTotal, Math.abs(vendes)),
    });
  }

  filesOut.sort((a, b) => a.centre.codi.localeCompare(b.centre.codi));
  const costTotal = totalSala + totalCuina;

  return {
    any,
    mes,
    files: filesOut,
    totals: {
      sala: totalSala,
      cuina: totalCuina,
      costTotal,
      partides: totalsPartides,
      vendes: totalVendes,
      pctSobreVendes: pct(costTotal, Math.abs(totalVendes)),
    },
    buit: false,
  };
}

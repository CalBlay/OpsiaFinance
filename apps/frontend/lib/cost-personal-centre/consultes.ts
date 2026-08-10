import type { PivotColumn, PivotRow } from "@/components/consultes/PivotTable";
import type { VistaCompte } from "@/lib/consultes";
import { CONSULTES_CACHE_TAG } from "@/lib/consultes-cache";
import { ordenaPerCodi } from "@/lib/consultes-etiquetes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import {
  type FiltreBaseGestio,
  type ImportsPersonalGestio,
  agregarBasePerCentre,
  carregarBaseDirectePersonal,
  carregarBaseGestioPersonal,
} from "@/lib/cost-personal-centre/base-gestio";
import {
  NODE_SEGURETAT_SOCIAL,
  NODE_SOUS_SALARIS,
  NODE_TOTAL_COST_SALARIAL,
} from "@/lib/cost-personal-centre/nodes";
import { db } from "@/lib/db";
import { NODE_VENDES } from "@/lib/kpi-definitions";
import { unstable_cache } from "next/cache";

export type NivellCostPersonal = "linies" | "centres" | "departaments";

export interface BarraCostPersonal {
  id: string;
  name: string;
  costPersonal: number;
  importBrut: number;
  totalSegSocial: number;
  pctSobreTotal: number | null;
  pctSobreVendes: number | null;
  href?: string;
}

export interface MesCostPersonal {
  mes: number;
  label: string;
  costPersonal: number;
  /** % sobre el cost personal total de l'empresa aquell mes. */
  pctSobreEmpresa: number | null;
}

export interface InformeCostPersonal {
  any: number;
  mes: number | null;
  vista: VistaCompte;
  nivell: NivellCostPersonal;
  titol: string;
  subtitol: string;
  columns: PivotColumn[];
  rows: PivotRow[];
  /** Filtre drill-down per colKey. */
  colMap: Record<
    string,
    { mes?: number; centreId?: string; liniaNegociId?: string; departament?: string }
  >;
  barres: BarraCostPersonal[];
  /** Evolució mensual de l'àmbit (amb % s/ empresa). Buit si es filtra un sol mes. */
  evolucioMensual: MesCostPersonal[];
  totals: {
    costPersonal: number;
    importBrut: number;
    totalSegSocial: number;
    vendes: number;
    pctSobreVendes: number | null;
  };
  buit: boolean;
}

type ConceptePersonal = {
  id: string;
  node: number;
  descripcio: string;
  esSubtotal: boolean;
};

type Imports = {
  importBrut: number;
  totalSegSocial: number;
  costPersonal: number;
};

type ColMeta = {
  key: string;
  label: string;
  sublabel?: string;
  liniaNegociId?: string;
  centreId?: string;
  departament?: "SALA" | "CUINA" | "SENSE";
};

const SUBTITOL_GESTIO =
  "Gestió: SAP + ajustos + traspassos (+ estructura a LN). Sense nòmina/millores.";
const SUBTITOL_DIRECTE = "Directe: SAP + ajustos";

/** Delta de repartiment (node 17) agregat per LN i període. */
async function deltasRepartimentPersonalPerLn(
  any: number,
  mes: number | null
): Promise<Map<string, number>> {
  const { carregarDeltasGestioAgregats } = await import("@/lib/repartiment/gestio-consultes");
  const rang = mes != null ? { des: mes, fins: mes } : { des: 1, fins: 12 };
  const deltas = await carregarDeltasGestioAgregats(any, rang);
  const out = new Map<string, number>();
  for (const [lnId, nodes] of deltas) {
    const d = nodes.get(NODE_TOTAL_COST_SALARIAL) ?? 0;
    if (d) out.set(lnId, d);
  }
  return out;
}

/** Delta de repartiment personal per LN × mes (12 valors). */
async function deltasRepartimentPersonalLnMes(any: number): Promise<Map<string, number[]>> {
  const { db: database } = await import("@/lib/db");
  const { getDeltasGestioPerLn } = await import("@/lib/repartiment/service");
  const periods = await database.period.findMany({
    where: { any },
    select: { id: true, mes: true },
  });
  if (!periods.length) return new Map();
  const mesById = new Map(periods.map((p) => [p.id, p.mes]));
  const deltas = await getDeltasGestioPerLn(periods.map((p) => p.id));
  const out = new Map<string, number[]>();
  for (const [periodId, perLn] of deltas) {
    const mes = mesById.get(periodId);
    if (mes == null || mes < 1 || mes > 12) continue;
    for (const [lnId, nodes] of perLn) {
      const d = nodes.get(NODE_TOTAL_COST_SALARIAL) ?? 0;
      if (!d) continue;
      let arr = out.get(lnId);
      if (!arr) {
        arr = new Array(12).fill(0);
        out.set(lnId, arr);
      }
      arr[mes - 1] += d;
    }
  }
  return out;
}

function emptyImports(): Imports {
  return { importBrut: 0, totalSegSocial: 0, costPersonal: 0 };
}

function toImports(imp: ImportsPersonalGestio): Imports {
  return {
    importBrut: imp.importBrut,
    totalSegSocial: imp.totalSegSocial,
    costPersonal: imp.costPersonal,
  };
}

function pct(part: number, total: number): number | null {
  return total ? (part / total) * 100 : null;
}

/** Evita % absurds (p.ex. Central amb vendes ~0). */
function pctSobreVendesSegur(cost: number, vendes: number): number | null {
  const v = Math.abs(vendes);
  if (v < 100) return null;
  const p = (Math.abs(cost) / v) * 100;
  if (!Number.isFinite(p) || p > 250) return null;
  return p;
}

function absCost(v: number): number {
  return Math.abs(v);
}

function subtitolVista(vista: VistaCompte): string {
  return vista === "gestio" ? SUBTITOL_GESTIO : SUBTITOL_DIRECTE;
}

function filtreBase(
  any: number,
  mes: number | null,
  filtre?: { liniaNegociId?: string; centreId?: string }
): FiltreBaseGestio {
  return {
    any,
    mes,
    ...(filtre?.centreId ? { centreId: filtre.centreId } : {}),
    ...(filtre?.liniaNegociId ? { liniaNegociId: filtre.liniaNegociId } : {}),
  };
}

async function getConceptesPersonal(): Promise<ConceptePersonal[]> {
  const nodes = [NODE_SOUS_SALARIS, NODE_SEGURETAT_SOCIAL, NODE_TOTAL_COST_SALARIAL];
  const rows = await db.concepteResultat.findMany({
    where: { node: { in: nodes }, isActive: true },
    select: { id: true, node: true, descripcio: true, esSubtotal: true },
  });
  const byNode = new Map(rows.map((r) => [r.node, r]));
  return nodes
    .map((node) => {
      const c = byNode.get(node);
      if (!c) return null;
      return {
        id: c.id,
        node: c.node,
        descripcio: c.descripcio,
        esSubtotal: node === NODE_TOTAL_COST_SALARIAL || c.esSubtotal,
      };
    })
    .filter((c): c is ConceptePersonal => !!c);
}

function periodWhere(any: number, mes: number | null) {
  return mes != null ? { any, mes } : { any };
}

async function getVendesMap(
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
      period: periodWhere(any, mes),
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

/** Agrega la base (Gestió o Directe) per centre. */
async function carregaPerCentre(
  any: number,
  mes: number | null,
  vista: VistaCompte,
  filtre?: { liniaNegociId?: string; centreId?: string }
): Promise<Map<string, Imports>> {
  const fb = filtreBase(any, mes, filtre);
  const base =
    vista === "gestio"
      ? await carregarBaseGestioPersonal(fb)
      : await carregarBaseDirectePersonal(fb);
  const agregat = agregarBasePerCentre(base);
  const out = new Map<string, Imports>();
  for (const [centreId, imp] of agregat) {
    out.set(centreId, toImports(imp));
  }
  return out;
}

async function buildEvolucioMensual(
  any: number,
  mesFiltre: number | null,
  vista: VistaCompte,
  filtre?: { liniaNegociId?: string; centreId?: string },
  opts?: { lnIds?: string[] }
): Promise<MesCostPersonal[]> {
  if (mesFiltre != null) return [];

  const { MESOS_CURTS } = await import("@/lib/periodes");

  let centreIdsPermesos: Set<string> | undefined;
  if (opts?.lnIds?.length) {
    const centres = await db.centre.findMany({
      where: { isActive: true, liniaNegociId: { in: opts.lnIds } },
      select: { id: true },
    });
    centreIdsPermesos = new Set(centres.map((c) => c.id));
  }

  const fbAmbit = filtreBase(any, null, filtre);
  const fbEmpresa = filtreBase(any, null, undefined);
  const [baseAmbit, baseEmpresa] = await Promise.all([
    vista === "gestio" ? carregarBaseGestioPersonal(fbAmbit) : carregarBaseDirectePersonal(fbAmbit),
    vista === "gestio"
      ? carregarBaseGestioPersonal(fbEmpresa)
      : carregarBaseDirectePersonal(fbEmpresa),
  ]);

  // Signed per mes (després abs per presentació).
  const ambitSigned = new Array(12).fill(0) as number[];
  const empresaSigned = new Array(12).fill(0) as number[];
  for (const [centreId, perMes] of baseAmbit) {
    if (centreIdsPermesos && !centreIdsPermesos.has(centreId)) continue;
    for (const [mes, cel] of perMes) {
      if (mes >= 1 && mes <= 12) ambitSigned[mes - 1] += cel.imports.costPersonal;
    }
  }
  for (const [centreId, perMes] of baseEmpresa) {
    if (centreIdsPermesos && !centreIdsPermesos.has(centreId)) continue;
    for (const [mes, cel] of perMes) {
      if (mes >= 1 && mes <= 12) empresaSigned[mes - 1] += cel.imports.costPersonal;
    }
  }

  // Gestió LN/empresa: el repartiment forma part del cost de la LN (zero-sum a empresa).
  if (vista === "gestio" && !filtre?.centreId) {
    const deltasMes = await deltasRepartimentPersonalLnMes(any);
    if (filtre?.liniaNegociId) {
      const arr = deltasMes.get(filtre.liniaNegociId);
      if (arr) {
        for (let i = 0; i < 12; i++) ambitSigned[i] += arr[i] ?? 0;
      }
    } else {
      for (const arr of deltasMes.values()) {
        for (let i = 0; i < 12; i++) {
          ambitSigned[i] += arr[i] ?? 0;
          empresaSigned[i] += arr[i] ?? 0;
        }
      }
    }
  }

  return MESOS_CURTS.map((label, i) => ({
    mes: i + 1,
    label,
    costPersonal: absCost(ambitSigned[i] ?? 0),
    pctSobreEmpresa: pct(absCost(ambitSigned[i] ?? 0), absCost(empresaSigned[i] ?? 0)),
  })).filter((m) => m.costPersonal > 0 || absCost(empresaSigned[m.mes - 1] ?? 0) > 0);
}

function buildRows(
  conceptes: ConceptePersonal[],
  cols: ColMeta[],
  importsPerCol: Map<string, Imports>
): PivotRow[] {
  return conceptes.map((c) => {
    const valors = cols.map((col) => {
      const imp = importsPerCol.get(col.key) ?? emptyImports();
      if (c.node === NODE_SOUS_SALARIS) return imp.importBrut;
      if (c.node === NODE_SEGURETAT_SOCIAL) return imp.totalSegSocial;
      return imp.costPersonal;
    });
    return {
      node: c.node,
      concepteId: c.id,
      descripcio: c.descripcio,
      esSubtotal: c.esSubtotal,
      valors,
      total: valors.reduce((a, b) => a + b, 0),
    };
  });
}

function buildBarres(
  cols: ColMeta[],
  importsPerCol: Map<string, Imports>,
  vendesPerCol: Map<string, number>,
  totalCostAbs: number,
  hrefFor?: (col: ColMeta) => string | undefined
): BarraCostPersonal[] {
  return cols
    .map((col) => {
      const imp = importsPerCol.get(col.key) ?? emptyImports();
      const cost = absCost(imp.costPersonal);
      const vendes = vendesPerCol.get(col.key) ?? 0;
      return {
        id: col.key,
        name: col.label,
        costPersonal: cost,
        importBrut: absCost(imp.importBrut),
        totalSegSocial: absCost(imp.totalSegSocial),
        pctSobreTotal: pct(cost, totalCostAbs),
        pctSobreVendes: pctSobreVendesSegur(imp.costPersonal, vendes),
        href: hrefFor?.(col),
      };
    })
    .sort((a, b) => b.costPersonal - a.costPersonal);
}

export async function getAnysCostPersonalCentre(): Promise<number[]> {
  return unstable_cache(
    async () => {
      const [payroll, sap] = await Promise.all([
        db.period.findMany({
          where: { costsPersonalsCentre: { some: {} } },
          select: { any: true },
          distinct: ["any"],
        }),
        db.period.findMany({
          where: {
            dadesResultat: {
              some: {
                concepteResultat: {
                  node: {
                    in: [NODE_SOUS_SALARIS, NODE_SEGURETAT_SOCIAL, NODE_TOTAL_COST_SALARIAL],
                  },
                },
              },
            },
          },
          select: { any: true },
          distinct: ["any"],
        }),
      ]);
      const set = new Set([...payroll, ...sap].map((p) => p.any));
      return [...set].sort((a, b) => b - a);
    },
    ["cost-pers-anys-v1"],
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
}

export async function getInformeCostPersonalLinies(
  any: number,
  mes: number | null,
  vista: VistaCompte,
  opts?: { basePath?: string; lnIds?: string[] }
): Promise<InformeCostPersonal> {
  const lnKey = (opts?.lnIds ?? []).slice().sort().join(",");
  return unstable_cache(
    () => computeInformeCostPersonalLinies(any, mes, vista, opts),
    ["cost-pers-linies-v1", String(any), String(mes ?? 0), vista, opts?.basePath ?? "", lnKey],
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
}

async function computeInformeCostPersonalLinies(
  any: number,
  mes: number | null,
  vista: VistaCompte,
  opts?: { basePath?: string; lnIds?: string[] }
): Promise<InformeCostPersonal> {
  const basePath = opts?.basePath ?? "/consultes/cost-personal";
  const [conceptes, liniesRaw, perCentre] = await Promise.all([
    getConceptesPersonal(),
    db.liniaNegoci.findMany({
      where: {
        isActive: true,
        ...(opts?.lnIds?.length ? { id: { in: opts.lnIds } } : {}),
      },
      select: {
        id: true,
        codi: true,
        nom: true,
        centres: { where: { isActive: true }, select: { id: true } },
      },
      orderBy: { ordre: "asc" },
    }),
    carregaPerCentre(any, mes, vista),
  ]);
  const linies = liniesRaw;

  const allCentreIds = [...perCentre.keys()];
  const centresMeta = allCentreIds.length
    ? await db.centre.findMany({
        where: { id: { in: allCentreIds } },
        select: { id: true, liniaNegociId: true },
      })
    : [];
  const centreToLn = new Map(centresMeta.map((c) => [c.id, c.liniaNegociId]));

  const perCentreFiltrat = new Map(
    [...perCentre.entries()].filter(([id]) => {
      if (!opts?.lnIds?.length) return true;
      const lnId = centreToLn.get(id);
      return lnId != null && opts.lnIds.includes(lnId);
    })
  );
  const centreIds = [...perCentreFiltrat.keys()];
  const vendesCentre = await getVendesMap(centreIds, any, mes);

  const importsPerLn = new Map<string, Imports>();
  const vendesPerLn = new Map<string, number>();
  for (const [centreId, imp] of perCentreFiltrat) {
    const lnId = centreToLn.get(centreId);
    if (!lnId) continue;
    let acc = importsPerLn.get(lnId);
    if (!acc) {
      acc = emptyImports();
      importsPerLn.set(lnId, acc);
    }
    acc.importBrut += imp.importBrut;
    acc.totalSegSocial += imp.totalSegSocial;
    acc.costPersonal += imp.costPersonal;
    vendesPerLn.set(lnId, (vendesPerLn.get(lnId) ?? 0) + (vendesCentre.get(centreId) ?? 0));
  }

  // Gestió: el cost LN inclou el delta de repartiment (igual que Resultats · Per línia).
  if (vista === "gestio") {
    const deltas = await deltasRepartimentPersonalPerLn(any, mes);
    for (const [lnId, delta] of deltas) {
      if (!delta) continue;
      let acc = importsPerLn.get(lnId);
      if (!acc) {
        acc = emptyImports();
        importsPerLn.set(lnId, acc);
      }
      acc.importBrut += delta;
      acc.costPersonal += delta;
    }
  }

  const liniesAmbDades = ordenaPerCodi(
    linies.filter((ln) => importsPerLn.has(ln.id) || ln.centres.length > 0)
  ).filter((ln) => {
    const imp = importsPerLn.get(ln.id);
    return imp && (imp.costPersonal || imp.importBrut || imp.totalSegSocial);
  });

  const cols: ColMeta[] = liniesAmbDades.map((ln) => ({
    key: ln.id,
    label: etiquetaGrafic(ln) || ln.nom,
    liniaNegociId: ln.id,
  }));

  const totalCostAbs = cols.reduce(
    (s, c) => s + absCost((importsPerLn.get(c.key) ?? emptyImports()).costPersonal),
    0
  );

  for (const col of cols) {
    const cost = absCost((importsPerLn.get(col.key) ?? emptyImports()).costPersonal);
    const p = pct(cost, totalCostAbs);
    col.sublabel = p != null ? `${p.toFixed(1)}%` : undefined;
  }

  const rows = buildRows(conceptes, cols, importsPerLn);
  const params = new URLSearchParams();
  params.set("any", String(any));
  params.set("vista", vista);
  if (mes != null) params.set("mes", String(mes));

  const barres = buildBarres(cols, importsPerLn, vendesPerLn, totalCostAbs, (col) => {
    const p = new URLSearchParams(params);
    p.set("ln", col.key);
    return `${basePath}?${p}`;
  });

  const totalsImp = emptyImports();
  let totalVendes = 0;
  for (const col of cols) {
    const imp = importsPerLn.get(col.key) ?? emptyImports();
    totalsImp.importBrut += imp.importBrut;
    totalsImp.totalSegSocial += imp.totalSegSocial;
    totalsImp.costPersonal += imp.costPersonal;
    totalVendes += vendesPerLn.get(col.key) ?? 0;
  }

  const evolucioMensual = await buildEvolucioMensual(any, mes, vista, undefined, {
    lnIds: opts?.lnIds,
  });

  return {
    any,
    mes,
    vista,
    nivell: "linies",
    titol: "Cost de personal · per línia de negoci",
    subtitol: subtitolVista(vista),
    columns: cols.map((c) => ({ key: c.key, label: c.label, sublabel: c.sublabel })),
    rows,
    colMap: Object.fromEntries(
      cols.map((c) => [c.key, { liniaNegociId: c.liniaNegociId, ...(mes != null ? { mes } : {}) }])
    ),
    barres,
    evolucioMensual,
    totals: {
      costPersonal: absCost(totalsImp.costPersonal),
      importBrut: absCost(totalsImp.importBrut),
      totalSegSocial: absCost(totalsImp.totalSegSocial),
      vendes: totalVendes,
      pctSobreVendes: pctSobreVendesSegur(totalsImp.costPersonal, totalVendes),
    },
    buit: !cols.length || !conceptes.length,
  };
}

export async function getInformeCostPersonalCentres(
  liniaNegociId: string,
  any: number,
  mes: number | null,
  vista: VistaCompte,
  opts?: { basePath?: string; lnIds?: string[] }
): Promise<InformeCostPersonal> {
  const lnKey = (opts?.lnIds ?? []).slice().sort().join(",");
  return unstable_cache(
    () => computeInformeCostPersonalCentres(liniaNegociId, any, mes, vista, opts),
    [
      "cost-pers-centres-v1",
      liniaNegociId,
      String(any),
      String(mes ?? 0),
      vista,
      opts?.basePath ?? "",
      lnKey,
    ],
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
}

async function computeInformeCostPersonalCentres(
  liniaNegociId: string,
  any: number,
  mes: number | null,
  vista: VistaCompte,
  opts?: { basePath?: string; lnIds?: string[] }
): Promise<InformeCostPersonal> {
  const basePath = opts?.basePath ?? "/consultes/cost-personal";
  const [conceptes, ln, perCentre] = await Promise.all([
    getConceptesPersonal(),
    db.liniaNegoci.findUnique({
      where: { id: liniaNegociId },
      select: {
        id: true,
        codi: true,
        nom: true,
        centres: {
          where: { isActive: true },
          select: { id: true, codi: true, nom: true },
          orderBy: { ordre: "asc" },
        },
      },
    }),
    carregaPerCentre(any, mes, vista, { liniaNegociId }),
  ]);

  const centres = ordenaPerCodi(ln?.centres ?? []).filter((c) => {
    const imp = perCentre.get(c.id);
    return imp && (imp.costPersonal || imp.importBrut || imp.totalSegSocial);
  });

  const cols: ColMeta[] = centres.map((c) => ({
    key: c.id,
    label: etiquetaGrafic(c) || c.nom,
    centreId: c.id,
    liniaNegociId,
  }));

  // Gestió: columna Estructura (mateix criteri que Resultats · Per línia).
  if (vista === "gestio") {
    const deltas = await deltasRepartimentPersonalPerLn(any, mes);
    const delta = deltas.get(liniaNegociId) ?? 0;
    if (delta) {
      const { COL_REPARTIMENT_ID, COL_REPARTIMENT_CODI } = await import(
        "@/lib/repartiment/gestio-consultes"
      );
      cols.push({
        key: COL_REPARTIMENT_ID,
        label: COL_REPARTIMENT_CODI,
        liniaNegociId,
      });
      perCentre.set(COL_REPARTIMENT_ID, {
        importBrut: delta,
        totalSegSocial: 0,
        costPersonal: delta,
      });
    }
  }

  const centreIds = cols.map((c) => c.key).filter((id) => !id.startsWith("__"));
  const vendesCentre = await getVendesMap(centreIds, any, mes);
  const totalCostAbs = cols.reduce(
    (s, c) => s + absCost((perCentre.get(c.key) ?? emptyImports()).costPersonal),
    0
  );

  for (const col of cols) {
    const cost = absCost((perCentre.get(col.key) ?? emptyImports()).costPersonal);
    const p = pct(cost, totalCostAbs);
    col.sublabel = p != null ? `${p.toFixed(1)}%` : undefined;
  }

  const rows = buildRows(conceptes, cols, perCentre);
  const params = new URLSearchParams();
  params.set("any", String(any));
  params.set("vista", vista);
  params.set("ln", liniaNegociId);
  if (mes != null) params.set("mes", String(mes));

  const barres = buildBarres(cols, perCentre, vendesCentre, totalCostAbs, (col) => {
    if (col.key.startsWith("__")) return undefined;
    const p = new URLSearchParams(params);
    p.set("centre", col.key);
    return `${basePath}?${p}`;
  });

  const totalsImp = emptyImports();
  let totalVendes = 0;
  for (const col of cols) {
    const imp = perCentre.get(col.key) ?? emptyImports();
    totalsImp.importBrut += imp.importBrut;
    totalsImp.totalSegSocial += imp.totalSegSocial;
    totalsImp.costPersonal += imp.costPersonal;
    totalVendes += vendesCentre.get(col.key) ?? 0;
  }

  const evolucioMensual = await buildEvolucioMensual(
    any,
    mes,
    vista,
    { liniaNegociId },
    { lnIds: opts?.lnIds }
  );

  return {
    any,
    mes,
    vista,
    nivell: "centres",
    titol: `Cost de personal · ${ln ? etiquetaGrafic(ln) || ln.nom : "línia"}`,
    subtitol: subtitolVista(vista),
    columns: cols.map((c) => ({ key: c.key, label: c.label, sublabel: c.sublabel })),
    rows,
    colMap: Object.fromEntries(
      cols.map((c) => [
        c.key,
        c.key.startsWith("__")
          ? { liniaNegociId, ...(mes != null ? { mes } : {}) }
          : { centreId: c.centreId, liniaNegociId, ...(mes != null ? { mes } : {}) },
      ])
    ),
    barres,
    evolucioMensual,
    totals: {
      costPersonal: absCost(totalsImp.costPersonal),
      importBrut: absCost(totalsImp.importBrut),
      totalSegSocial: absCost(totalsImp.totalSegSocial),
      vendes: totalVendes,
      pctSobreVendes: pctSobreVendesSegur(totalsImp.costPersonal, totalVendes),
    },
    buit: !cols.length || !conceptes.length,
  };
}

export async function getInformeCostPersonalDepartaments(
  centreId: string,
  any: number,
  mes: number | null,
  vista: VistaCompte,
  opts?: { lnIds?: string[] }
): Promise<InformeCostPersonal> {
  const lnKey = (opts?.lnIds ?? []).slice().sort().join(",");
  return unstable_cache(
    () => computeInformeCostPersonalDepartaments(centreId, any, mes, vista, opts),
    ["cost-pers-depts-v1", centreId, String(any), String(mes ?? 0), vista, lnKey],
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
}

async function computeInformeCostPersonalDepartaments(
  centreId: string,
  any: number,
  mes: number | null,
  vista: VistaCompte,
  opts?: { lnIds?: string[] }
): Promise<InformeCostPersonal> {
  const [conceptes, centre] = await Promise.all([
    getConceptesPersonal(),
    db.centre.findUnique({
      where: { id: centreId },
      select: {
        id: true,
        codi: true,
        nom: true,
        liniaNegociId: true,
        liniaNegoci: { select: { id: true, codi: true, nom: true } },
      },
    }),
  ]);

  const centreLabel = centre ? etiquetaGrafic(centre) || centre.nom : "Centre";
  const lnLabel = centre?.liniaNegoci
    ? etiquetaGrafic(centre.liniaNegoci) || centre.liniaNegoci.nom
    : "";

  const evolucioMensual = await buildEvolucioMensual(
    any,
    mes,
    vista,
    { centreId },
    { lnIds: opts?.lnIds }
  );

  if (vista === "directe") {
    const perCentre = await carregaPerCentre(any, mes, "directe", { centreId });
    const imp = perCentre.get(centreId) ?? emptyImports();
    const cols: ColMeta[] = [
      { key: "total", label: "Total centre", centreId, liniaNegociId: centre?.liniaNegociId },
    ];
    const importsPerCol = new Map([["total", imp]]);
    const vendes = await getVendesMap([centreId], any, mes);
    const vendesVal = vendes.get(centreId) ?? 0;
    const rows = buildRows(conceptes, cols, importsPerCol);

    return {
      any,
      mes,
      vista,
      nivell: "departaments",
      titol: `Cost de personal · ${centreLabel}`,
      subtitol: lnLabel ? `${lnLabel} · ${SUBTITOL_DIRECTE}` : SUBTITOL_DIRECTE,
      columns: cols.map((c) => ({ key: c.key, label: c.label })),
      rows,
      colMap: {
        total: {
          centreId,
          liniaNegociId: centre?.liniaNegociId,
          ...(mes != null ? { mes } : {}),
        },
      },
      barres: [
        {
          id: "total",
          name: centreLabel,
          costPersonal: absCost(imp.costPersonal),
          importBrut: absCost(imp.importBrut),
          totalSegSocial: absCost(imp.totalSegSocial),
          pctSobreTotal: 100,
          pctSobreVendes: pctSobreVendesSegur(imp.costPersonal, vendesVal),
        },
      ],
      evolucioMensual,
      totals: {
        costPersonal: absCost(imp.costPersonal),
        importBrut: absCost(imp.importBrut),
        totalSegSocial: absCost(imp.totalSegSocial),
        vendes: vendesVal,
        pctSobreVendes: pctSobreVendesSegur(imp.costPersonal, vendesVal),
      },
      buit: !imp.costPersonal && !imp.importBrut && !imp.totalSegSocial,
    };
  }

  // Gestió: SAP+ajust+traspass a Sense (payroll no alimenta Gestió; desglossament SALA/CUINA és informatiu a nòmina).
  const [base] = await Promise.all([carregarBaseGestioPersonal({ any, mes, centreId })]);

  const depts: Array<"SALA" | "CUINA" | "SENSE"> = ["SALA", "CUINA", "SENSE"];
  const importsPerDept = new Map<string, Imports>();
  for (const d of depts) importsPerDept.set(d, emptyImports());
  const getAcc = (key: "SALA" | "CUINA" | "SENSE"): Imports => {
    let acc = importsPerDept.get(key);
    if (!acc) {
      acc = emptyImports();
      importsPerDept.set(key, acc);
    }
    return acc;
  };

  const mesos = mes != null ? [mes] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const perMes = base.get(centreId);

  for (const m of mesos) {
    const cel = perMes?.get(m);
    if (!cel) continue;
    const acc = getAcc("SENSE");
    acc.importBrut += cel.imports.importBrut;
    acc.totalSegSocial += cel.imports.totalSegSocial;
    acc.costPersonal += cel.imports.costPersonal;
  }

  const labels: Record<string, string> = {
    SALA: "Sala",
    CUINA: "Cuina",
    SENSE: "Sense departament",
  };

  const cols: ColMeta[] = depts
    .filter((d) => {
      const imp = importsPerDept.get(d) ?? emptyImports();
      return imp.costPersonal || imp.importBrut || imp.totalSegSocial;
    })
    .map((d) => ({
      key: d,
      label: labels[d],
      centreId,
      liniaNegociId: centre?.liniaNegociId,
      departament: d,
    }));

  const totalCostAbs = cols.reduce(
    (s, c) => s + absCost((importsPerDept.get(c.key) ?? emptyImports()).costPersonal),
    0
  );
  for (const col of cols) {
    const cost = absCost((importsPerDept.get(col.key) ?? emptyImports()).costPersonal);
    const p = pct(cost, totalCostAbs);
    col.sublabel = p != null ? `${p.toFixed(1)}%` : undefined;
  }

  const rows = buildRows(conceptes, cols, importsPerDept);
  const vendes = await getVendesMap([centreId], any, mes);
  const vendesVal = vendes.get(centreId) ?? 0;
  const vendesPerCol = new Map(cols.map((c) => [c.key, vendesVal]));

  const totalsImp = emptyImports();
  for (const col of cols) {
    const imp = importsPerDept.get(col.key) ?? emptyImports();
    totalsImp.importBrut += imp.importBrut;
    totalsImp.totalSegSocial += imp.totalSegSocial;
    totalsImp.costPersonal += imp.costPersonal;
  }

  return {
    any,
    mes,
    vista,
    nivell: "departaments",
    titol: `Cost de personal · ${centreLabel}`,
    subtitol: lnLabel ? `${lnLabel} · ${SUBTITOL_GESTIO}` : SUBTITOL_GESTIO,
    columns: cols.map((c) => ({ key: c.key, label: c.label, sublabel: c.sublabel })),
    rows,
    colMap: Object.fromEntries(
      cols.map((c) => [
        c.key,
        {
          centreId,
          liniaNegociId: centre?.liniaNegociId,
          ...(mes != null ? { mes } : {}),
          ...(c.departament && c.departament !== "SENSE" ? { departament: c.departament } : {}),
        },
      ])
    ),
    barres: buildBarres(cols, importsPerDept, vendesPerCol, totalCostAbs),
    evolucioMensual,
    totals: {
      costPersonal: absCost(totalsImp.costPersonal),
      importBrut: absCost(totalsImp.importBrut),
      totalSegSocial: absCost(totalsImp.totalSegSocial),
      vendes: vendesVal,
      pctSobreVendes: pctSobreVendesSegur(totalsImp.costPersonal, vendesVal),
    },
    buit: !cols.length || !conceptes.length,
  };
}

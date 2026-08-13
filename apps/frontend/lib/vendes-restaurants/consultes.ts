import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { ordenaPerCodi } from "@/lib/consultes-etiquetes";
import { esCentreAdministracio, etiquetaGrafic } from "@/lib/consultes-grafics";
import { normalitzaNomRestaurant } from "@/lib/cost-salarial/import";
import { db } from "@/lib/db";
import { NODE_VENDES } from "@/lib/kpi-definitions";
import { MESOS_LLARGS } from "@/lib/periodes";
import type { CategoriaVenda } from "@/lib/vendes-restaurants/categories";
import { categoriaDesDeTaxonomia, esSubfamiliaMenus } from "@/lib/vendes-restaurants/categories";
import { teTaxonomiaVendesArticle } from "@/lib/vendes-restaurants/prisma-fields";
import { unstable_cache } from "next/cache";

export type CriteriRanking = "base" | "unitats";
export type OrigenVista = "DETALL" | "PACK";

export interface CentreRestOpt {
  id: string;
  codi: string;
  nom: string;
  etiqueta: string;
}

export interface FilaComparativaVendes {
  centre: CentreRestOpt;
  base: number;
  unitats: number;
  baseAnt: number | null;
  variacioPct: number | null;
  vendesPl: number;
  desviacioPl: number | null;
  teDades: boolean;
}

export interface ComparativaVendes {
  any: number;
  /** 0 = tot l'any */
  mes: number;
  ambit: "mes" | "any";
  periode: string;
  files: FilaComparativaVendes[];
  totals: {
    base: number;
    unitats: number;
    baseAnt: number | null;
    variacioPct: number | null;
    vendesPl: number;
    desviacioPl: number | null;
    mitjanaDiaria: number | null;
    mitjanaMensual: number | null;
  };
  centresAmbDades: number;
  centresTotals: number;
  dies: DiaVenda[];
  evolucioMesos: MesEvolucio[];
  productes: RankingsCategoria;
  families: RankingsCategoria;
  subfamilies: RankingsCategoria;
  teFamilies: boolean;
  teSubfamilies: boolean;
  buit: boolean;
}

export interface MesEvolucio {
  mes: number;
  etiqueta: string;
  base: number;
  unitats: number;
  teDades: boolean;
}

export interface DiaVenda {
  dia: number;
  dataIso: string;
  unitats: number;
  base: number;
}

export interface FormaPagamentVenda {
  forma: string;
  unitats: number;
  base: number;
  pct: number | null;
}

export interface ArticleRank {
  article: string;
  tipusArticle: string | null;
  unitats: number;
  base: number;
  pos: number;
  pctMix: number | null;
  posAnt: number | null;
  deltaPos: number | null;
  variacioPct: number | null;
}

export interface MovimentRank {
  article: string;
  pos: number;
  posAnt: number | null;
  deltaPos: number;
  base: number;
  unitats: number;
  tipus: "entrada" | "pujada" | "baixada" | "sortida";
}

export interface BlocRanking {
  criteri: CriteriRanking;
  top10: ArticleRank[];
  bottom5: ArticleRank[];
  pujades: MovimentRank[];
  baixades: MovimentRank[];
}

export interface MixCategoria {
  menjar: { base: number; unitats: number; pctBase: number | null };
  beguda: { base: number; unitats: number; pctBase: number | null };
  senseCategoria: { base: number; unitats: number };
}

export interface RankingsCategoria {
  mix: MixCategoria;
  tots: { base: BlocRanking; unitats: BlocRanking };
  menjar: { base: BlocRanking; unitats: BlocRanking };
  beguda: { base: BlocRanking; unitats: BlocRanking };
}

export type NivellRankingVendes = "articles" | "families" | "subfamilies";

export interface InformeVendesRestaurant {
  centre: CentreRestOpt;
  any: number;
  /** 0 = tot l'any */
  mes: number;
  ambit: "mes" | "any";
  periode: string;
  base: number;
  unitats: number;
  baseAnt: number | null;
  variacioPct: number | null;
  mitjanaDiaria: number | null;
  mitjanaMensual: number | null;
  vendesPl: number;
  desviacioPl: number | null;
  dies: DiaVenda[];
  evolucioMesos: MesEvolucio[];
  /** Desglossament per forma de pagament (tickets CCR00008). */
  formesPagament: FormaPagamentVenda[];
  productes: RankingsCategoria;
  /** Rànquings agregats per família TPV (camp `article` = nom família) */
  families: RankingsCategoria;
  /** Rànquings agregats per subfamília TPV (camp `article` = nom subfamília) */
  subfamilies: RankingsCategoria;
  teFamilies: boolean;
  teSubfamilies: boolean;
  packs: RankingsCategoria;
  buit: boolean;
}

function pct(part: number, total: number): number | null {
  return total ? (part / total) * 100 : null;
}

function variacio(actual: number, anterior: number | null): number | null {
  if (anterior == null || anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

function mesAnterior(any: number, mes: number): { any: number; mes: number } {
  if (mes <= 1) return { any: any - 1, mes: 12 };
  return { any, mes: mes - 1 };
}

async function getVendesPlPerCentres(
  centreIds: string[],
  any: number,
  mes: number | null,
  mesosYtd?: number[]
): Promise<Map<string, number>> {
  if (!centreIds.length) return new Map();
  const concepte = await db.concepteResultat.findUnique({
    where: { node: NODE_VENDES },
    select: { id: true },
  });
  if (!concepte) return new Map();

  const periodFilter =
    mes != null ? { any, mes } : mesosYtd?.length ? { any, mes: { in: mesosYtd } } : { any };

  const dades = await db.dadaResultat.findMany({
    where: {
      centreId: { in: centreIds },
      concepteResultatId: concepte.id,
      period: periodFilter,
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

function mesosBuits(): MesEvolucio[] {
  return MESOS_LLARGS.map((etiqueta, i) => ({
    mes: i + 1,
    etiqueta: etiqueta.slice(0, 3),
    base: 0,
    unitats: 0,
    teDades: false,
  }));
}

export async function getAnysVendesRestaurants(): Promise<number[]> {
  return unstable_cache(
    async () => {
      const periods = await db.period.findMany({
        where: {
          OR: [{ vendesDiaries: { some: {} } }, { vendesArticles: { some: {} } }],
        },
        select: { any: true },
        distinct: ["any"],
        orderBy: { any: "desc" },
      });
      return periods.map((p) => p.any);
    },
    consultesCacheKey("vendes-anys-v1"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
}

export async function getCentresRestaurantsVendes(
  nomesMirallFdlc = false
): Promise<CentreRestOpt[]> {
  return unstable_cache(
    async () => {
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
          .filter((c) => !esCentreAdministracio(c))
          .filter((c) => !nomesMirallFdlc || c.codi === CENTRE_CODI_MIRALL_SERVEIS_FDLC)
          .map((c) => ({
            ...c,
            etiqueta: etiquetaGrafic(c) || normalitzaNomRestaurant(c.nom),
          }))
      );
    },
    consultesCacheKey("vendes-centres-v1", nomesMirallFdlc ? "1" : "0"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
}

export async function getComparativaVendes(
  any: number,
  mes: number,
  nomesMirallFdlc = false,
  opts?: { totalsOnly?: boolean }
): Promise<ComparativaVendes> {
  return unstable_cache(
    () => computeComparativaVendes(any, mes, nomesMirallFdlc, opts),
    consultesCacheKey(
      "vendes-cmp-v1",
      String(any),
      String(mes),
      nomesMirallFdlc ? "1" : "0",
      opts?.totalsOnly ? "t" : "f"
    ),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
}

async function computeComparativaVendes(
  any: number,
  mes: number,
  nomesMirallFdlc = false,
  opts?: { totalsOnly?: boolean }
): Promise<ComparativaVendes> {
  const anual = mes <= 0;
  const totalsOnly = opts?.totalsOnly === true;
  const centres = await getCentresRestaurantsVendes(nomesMirallFdlc);
  const centreIds = centres.map((c) => c.id);
  const prev = mesAnterior(any, mes);
  const anyAnt = any - 1;

  const diaries = await db.vendaDiariaRestaurant.findMany({
    where: {
      centreId: { in: centreIds },
      period: anual ? { any } : { any, mes },
    },
    select: {
      centreId: true,
      dia: true,
      data: true,
      unitats: true,
      base: true,
      period: { select: { mes: true } },
    },
    orderBy: [{ period: { mes: "asc" } }, { dia: "asc" }],
  });

  const mesosYtd = anual
    ? [...new Set(diaries.map((d) => d.period.mes))].sort((a, b) => a - b)
    : [];

  const diariesAntPromise = db.vendaDiariaRestaurant.findMany({
    where: {
      centreId: { in: centreIds },
      period: anual
        ? mesosYtd.length
          ? { any: anyAnt, mes: { in: mesosYtd } }
          : { any: anyAnt }
        : { any: prev.any, mes: prev.mes },
    },
    select: { centreId: true, base: true },
  });
  const plPromise = getVendesPlPerCentres(
    centreIds,
    any,
    anual ? null : mes,
    anual ? mesosYtd : undefined
  );

  const [diariesAnt, plMap, prod, prodAnt, packs, packsAnt] = totalsOnly
    ? await Promise.all([
        diariesAntPromise,
        plPromise,
        Promise.resolve(
          [] as {
            article: string;
            tipusArticle: string | null;
            categoria: CategoriaVenda | null;
            familia: string | null;
            subfamilia: string | null;
            unitats: number;
            base: number;
          }[]
        ),
        Promise.resolve(
          [] as {
            article: string;
            tipusArticle: string | null;
            categoria: CategoriaVenda | null;
            familia: string | null;
            subfamilia: string | null;
            unitats: number;
            base: number;
          }[]
        ),
        Promise.resolve(
          [] as {
            article: string;
            tipusArticle: string | null;
            categoria: CategoriaVenda | null;
            familia: string | null;
            subfamilia: string | null;
            unitats: number;
            base: number;
          }[]
        ),
        Promise.resolve(
          [] as {
            article: string;
            tipusArticle: string | null;
            categoria: CategoriaVenda | null;
            familia: string | null;
            subfamilia: string | null;
            unitats: number;
            base: number;
          }[]
        ),
      ])
    : await Promise.all([
        diariesAntPromise,
        plPromise,
        carregaArticles(centreIds, any, anual ? null : mes, "DETALL", anual ? mesosYtd : undefined),
        carregaArticles(
          centreIds,
          anual ? anyAnt : prev.any,
          anual ? null : prev.mes,
          "DETALL",
          anual ? mesosYtd : undefined
        ),
        carregaArticles(centreIds, any, anual ? null : mes, "PACK", anual ? mesosYtd : undefined),
        carregaArticles(
          centreIds,
          anual ? anyAnt : prev.any,
          anual ? null : prev.mes,
          "PACK",
          anual ? mesosYtd : undefined
        ),
      ]);

  const agg = new Map<string, { base: number; unitats: number }>();
  const evolucio = mesosBuits();
  const diesMap = new Map<number, { dataIso: string; unitats: number; base: number }>();
  for (const d of diaries) {
    const cur = agg.get(d.centreId) ?? { base: 0, unitats: 0 };
    const base = Number(d.base);
    const unitats = Number(d.unitats);
    cur.base += base;
    cur.unitats += unitats;
    agg.set(d.centreId, cur);
    if (anual) {
      const slot = evolucio[d.period.mes - 1];
      if (slot) {
        slot.base += base;
        slot.unitats += unitats;
        slot.teDades = true;
      }
    } else {
      const diaCur = diesMap.get(d.dia) ?? {
        dataIso: d.data.toISOString().slice(0, 10),
        unitats: 0,
        base: 0,
      };
      diaCur.unitats += unitats;
      diaCur.base += base;
      diesMap.set(d.dia, diaCur);
    }
  }
  const aggAnt = new Map<string, number>();
  for (const d of diariesAnt) {
    aggAnt.set(d.centreId, (aggAnt.get(d.centreId) ?? 0) + Number(d.base));
  }

  const files: FilaComparativaVendes[] = centres.map((centre) => {
    const a = agg.get(centre.id);
    const base = a?.base ?? 0;
    const unitats = a?.unitats ?? 0;
    const baseAnt = aggAnt.has(centre.id) ? (aggAnt.get(centre.id) ?? 0) : null;
    const vendesPl = plMap.get(centre.id) ?? 0;
    return {
      centre,
      base,
      unitats,
      baseAnt,
      variacioPct: variacio(base, baseAnt),
      vendesPl,
      desviacioPl: a ? base - vendesPl : null,
      teDades: Boolean(a),
    };
  });

  const totalsBase = files.reduce((s, f) => s + f.base, 0);
  const totalsUd = files.reduce((s, f) => s + f.unitats, 0);
  const totalsAntRaw = files.reduce((s, f) => s + (f.baseAnt ?? 0), 0);
  const teAnt = files.some((f) => f.baseAnt != null);
  const totalsPl = files.reduce((s, f) => s + f.vendesPl, 0);
  const centresAmbDades = files.filter((f) => f.teDades).length;
  const mesosAmbDades = evolucio.filter((m) => m.teDades).length;
  const dies: DiaVenda[] = anual
    ? []
    : [...diesMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([dia, v]) => ({
          dia,
          dataIso: v.dataIso,
          unitats: v.unitats,
          base: v.base,
        }));

  const emptyRank = emptyRankingsCategoria();
  const packsMenus = totalsOnly ? [] : packs.filter((r) => esSubfamiliaMenus(r.subfamilia));
  const packsMenusAnt = totalsOnly ? [] : packsAnt.filter((r) => esSubfamiliaMenus(r.subfamilia));
  const menusComMenjar = packsMenus.map((r) => ({ ...r, categoria: "MENJAR" as const }));
  const menusComMenjarAnt = packsMenusAnt.map((r) => ({
    ...r,
    categoria: "MENJAR" as const,
  }));
  const productesRows = totalsOnly ? [] : [...prod, ...menusComMenjar];
  const productesRowsAnt = totalsOnly ? [] : [...prodAnt, ...menusComMenjarAnt];
  const familiesRows = agregaPerClau(productesRows, (r) => r.familia);
  const familiesRowsAnt = agregaPerClau(productesRowsAnt, (r) => r.familia);
  const subfamiliesRows = agregaPerClau(productesRows, (r) => r.subfamilia);
  const subfamiliesRowsAnt = agregaPerClau(productesRowsAnt, (r) => r.subfamilia);

  return {
    any,
    mes: anual ? 0 : mes,
    ambit: anual ? "any" : "mes",
    periode: anual ? `Any ${any}` : `${MESOS_LLARGS[mes - 1]} ${any}`,
    files,
    totals: {
      base: totalsBase,
      unitats: totalsUd,
      baseAnt: teAnt ? totalsAntRaw : null,
      variacioPct: variacio(totalsBase, teAnt ? totalsAntRaw : null),
      vendesPl: totalsPl,
      desviacioPl: centresAmbDades ? totalsBase - totalsPl : null,
      mitjanaDiaria: !anual && dies.length ? totalsBase / dies.length : null,
      mitjanaMensual: anual && mesosAmbDades ? totalsBase / mesosAmbDades : null,
    },
    centresAmbDades,
    centresTotals: centres.length,
    dies,
    evolucioMesos: anual ? evolucio : [],
    productes: totalsOnly ? emptyRank : rankingsCategoria(productesRows, productesRowsAnt),
    families: totalsOnly ? emptyRank : rankingsCategoria(familiesRows, familiesRowsAnt),
    subfamilies: totalsOnly ? emptyRank : rankingsCategoria(subfamiliesRows, subfamiliesRowsAnt),
    teFamilies: !totalsOnly && familiesRows.length > 0,
    teSubfamilies: !totalsOnly && subfamiliesRows.length > 0,
    buit: !files.some((f) => f.teDades),
  };
}

type ArtRow = {
  article: string;
  tipusArticle: string | null;
  categoria: CategoriaVenda | null;
  familia: string | null;
  subfamilia: string | null;
  unitats: number;
  base: number;
};

function agregaArticles(rows: ArtRow[]): ArtRow[] {
  const map = new Map<string, ArtRow>();
  for (const r of rows) {
    const key = r.article.toLowerCase();
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { ...r });
      continue;
    }
    cur.unitats += r.unitats;
    cur.base += r.base;
    if (!cur.categoria && r.categoria) cur.categoria = r.categoria;
    if (!cur.familia && r.familia) cur.familia = r.familia;
    if (!cur.subfamilia && r.subfamilia) cur.subfamilia = r.subfamilia;
    if (!cur.tipusArticle && r.tipusArticle) cur.tipusArticle = r.tipusArticle;
  }
  return [...map.values()];
}

/** Agrega files per família o subfamília; el camp `article` passa a ser l'etiqueta del grup. */
function agregaPerClau(rows: ArtRow[], clau: (r: ArtRow) => string | null | undefined): ArtRow[] {
  const map = new Map<string, ArtRow>();
  for (const r of rows) {
    const label = clau(r)?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        article: label,
        tipusArticle: null,
        categoria: r.categoria,
        familia: r.familia,
        subfamilia: r.subfamilia,
        unitats: r.unitats,
        base: r.base,
      });
      continue;
    }
    cur.unitats += r.unitats;
    cur.base += r.base;
    if (cur.categoria && r.categoria && cur.categoria !== r.categoria) {
      cur.categoria = null;
    } else if (!cur.categoria && r.categoria) {
      cur.categoria = r.categoria;
    }
  }
  return [...map.values()];
}

function aRanking(rows: ArtRow[], criteri: CriteriRanking): ArticleRank[] {
  const total = rows.reduce((s, r) => s + r[criteri], 0);
  return [...rows]
    .sort(
      (a, b) => b[criteri] - a[criteri] || b.base - a.base || a.article.localeCompare(b.article)
    )
    .map((r, i) => ({
      article: r.article,
      tipusArticle: r.tipusArticle,
      unitats: r.unitats,
      base: r.base,
      pos: i + 1,
      pctMix: pct(r[criteri], total),
      posAnt: null,
      deltaPos: null,
      variacioPct: null,
    }));
}

function enriquirAmbAnterior(
  actual: ArticleRank[],
  anterior: ArticleRank[],
  criteri: CriteriRanking,
  antByArticle: Map<string, ArtRow>
): ArticleRank[] {
  const posAntMap = new Map(anterior.map((a) => [a.article.toLowerCase(), a.pos]));
  return actual.map((a) => {
    const posAnt = posAntMap.get(a.article.toLowerCase()) ?? null;
    const ant = antByArticle.get(a.article.toLowerCase());
    const valorAnt = ant ? ant[criteri] : null;
    return {
      ...a,
      posAnt,
      deltaPos: posAnt != null ? posAnt - a.pos : null, // positiu = ha pujat
      variacioPct: variacio(a[criteri], valorAnt),
    };
  });
}

function bottom5(ranked: ArticleRank[], criteri: CriteriRanking): ArticleRank[] {
  const ambVendes = ranked.filter((r) => r[criteri] > 0);
  return [...ambVendes].sort((a, b) => a[criteri] - b[criteri]).slice(0, 5);
}

function moviments(
  actual: ArticleRank[],
  anterior: ArticleRank[],
  topN = 10
): { pujades: MovimentRank[]; baixades: MovimentRank[] } {
  const topActual = new Set(actual.slice(0, topN).map((a) => a.article.toLowerCase()));
  const topAnt = new Set(anterior.slice(0, topN).map((a) => a.article.toLowerCase()));
  const posAnt = new Map(anterior.map((a) => [a.article.toLowerCase(), a.pos]));

  const pujades: MovimentRank[] = [];
  const baixades: MovimentRank[] = [];

  for (const a of actual.slice(0, topN)) {
    const key = a.article.toLowerCase();
    const pa = posAnt.get(key) ?? null;
    if (pa == null) {
      pujades.push({
        article: a.article,
        pos: a.pos,
        posAnt: null,
        deltaPos: 0,
        base: a.base,
        unitats: a.unitats,
        tipus: "entrada",
      });
    } else if (pa - a.pos >= 3) {
      pujades.push({
        article: a.article,
        pos: a.pos,
        posAnt: pa,
        deltaPos: pa - a.pos,
        base: a.base,
        unitats: a.unitats,
        tipus: "pujada",
      });
    }
  }

  for (const a of anterior.slice(0, topN)) {
    const key = a.article.toLowerCase();
    if (!topActual.has(key)) {
      const ara = actual.find((x) => x.article.toLowerCase() === key);
      baixades.push({
        article: a.article,
        pos: ara?.pos ?? 999,
        posAnt: a.pos,
        deltaPos: ara ? a.pos - ara.pos : a.pos,
        base: ara?.base ?? a.base,
        unitats: ara?.unitats ?? a.unitats,
        tipus: "sortida",
      });
    }
  }

  for (const a of actual) {
    const key = a.article.toLowerCase();
    const pa = posAnt.get(key);
    if (pa != null && a.pos - pa >= 3 && topAnt.has(key)) {
      baixades.push({
        article: a.article,
        pos: a.pos,
        posAnt: pa,
        deltaPos: pa - a.pos,
        base: a.base,
        unitats: a.unitats,
        tipus: "baixada",
      });
    }
  }

  pujades.sort((a, b) => b.deltaPos - a.deltaPos || a.pos - b.pos);
  baixades.sort((a, b) => a.deltaPos - b.deltaPos || a.pos - b.pos);

  return {
    pujades: pujades.slice(0, 8),
    baixades: baixades.slice(0, 8),
  };
}

function blocRanking(rows: ArtRow[], rowsAnt: ArtRow[], criteri: CriteriRanking): BlocRanking {
  const ranked = aRanking(rows, criteri);
  const rankedAnt = aRanking(rowsAnt, criteri);
  const antMap = new Map(rowsAnt.map((r) => [r.article.toLowerCase(), r]));
  const enriched = enriquirAmbAnterior(ranked, rankedAnt, criteri, antMap);
  const mov = moviments(enriched, rankedAnt);
  return {
    criteri,
    top10: enriched.slice(0, 10),
    bottom5: bottom5(enriched, criteri),
    pujades: mov.pujades,
    baixades: mov.baixades,
  };
}

function emptyBloc(criteri: CriteriRanking): BlocRanking {
  return { criteri, top10: [], bottom5: [], pujades: [], baixades: [] };
}

function emptyRankingsCategoria(): RankingsCategoria {
  return {
    mix: {
      menjar: { base: 0, unitats: 0, pctBase: null },
      beguda: { base: 0, unitats: 0, pctBase: null },
      senseCategoria: { base: 0, unitats: 0 },
    },
    tots: { base: emptyBloc("base"), unitats: emptyBloc("unitats") },
    menjar: { base: emptyBloc("base"), unitats: emptyBloc("unitats") },
    beguda: { base: emptyBloc("base"), unitats: emptyBloc("unitats") },
  };
}

function mixDe(rows: ArtRow[]): MixCategoria {
  let menjarB = 0;
  let menjarU = 0;
  let begudaB = 0;
  let begudaU = 0;
  let altreB = 0;
  let altreU = 0;
  for (const r of rows) {
    if (r.categoria === "MENJAR") {
      menjarB += r.base;
      menjarU += r.unitats;
    } else if (r.categoria === "BEGUDA") {
      begudaB += r.base;
      begudaU += r.unitats;
    } else {
      altreB += r.base;
      altreU += r.unitats;
    }
  }
  const totalCat = menjarB + begudaB;
  return {
    menjar: { base: menjarB, unitats: menjarU, pctBase: pct(menjarB, totalCat) },
    beguda: { base: begudaB, unitats: begudaU, pctBase: pct(begudaB, totalCat) },
    senseCategoria: { base: altreB, unitats: altreU },
  };
}

function rankingsCategoria(rows: ArtRow[], rowsAnt: ArtRow[]): RankingsCategoria {
  const menjar = rows.filter((r) => r.categoria === "MENJAR");
  const beguda = rows.filter((r) => r.categoria === "BEGUDA");
  const menjarAnt = rowsAnt.filter((r) => r.categoria === "MENJAR");
  const begudaAnt = rowsAnt.filter((r) => r.categoria === "BEGUDA");

  const pair = (actual: ArtRow[], anterior: ArtRow[]) => ({
    base: actual.length ? blocRanking(actual, anterior, "base") : emptyBloc("base"),
    unitats: actual.length ? blocRanking(actual, anterior, "unitats") : emptyBloc("unitats"),
  });

  return {
    mix: mixDe(rows),
    tots: pair(rows, rowsAnt),
    menjar: pair(menjar, menjarAnt),
    beguda: pair(beguda, begudaAnt),
  };
}

async function carregaArticles(
  centreId: string | string[],
  any: number,
  mes: number | null,
  origen: OrigenVista,
  mesosYtd?: number[]
): Promise<ArtRow[]> {
  const ambTaxonomia = teTaxonomiaVendesArticle();
  const periodFilter =
    mes != null ? { any, mes } : mesosYtd?.length ? { any, mes: { in: mesosYtd } } : { any };
  const centreFilter = Array.isArray(centreId) ? { centreId: { in: centreId } } : { centreId };
  const rows = await db.vendaArticleRestaurant.findMany({
    where: {
      ...centreFilter,
      origen,
      period: periodFilter,
    },
    select: {
      article: true,
      tipusArticle: true,
      unitats: true,
      base: true,
      ...(ambTaxonomia
        ? {
            grup: true as const,
            familia: true as const,
            subfamilia: true as const,
            categoria: true as const,
          }
        : {}),
    },
  });
  const mapped = rows.map((r) => {
    const row = r as {
      article: string;
      tipusArticle: string | null;
      unitats: unknown;
      base: unknown;
      grup?: string | null;
      familia?: string | null;
      subfamilia?: string | null;
      categoria?: CategoriaVenda | null;
    };
    return {
      article: row.article,
      tipusArticle: row.tipusArticle,
      categoria:
        row.categoria ??
        (ambTaxonomia ? categoriaDesDeTaxonomia(row.grup, row.familia, row.subfamilia) : null),
      familia: row.familia ?? null,
      subfamilia: row.subfamilia ?? null,
      unitats: Number(row.unitats),
      base: Number(row.base),
    };
  });
  // Multi-centre o YTD: sempre agreguem per article
  return Array.isArray(centreId) || mes == null ? agregaArticles(mapped) : mapped;
}

export async function getInformeVendesRestaurant(
  centreId: string,
  any: number,
  mes: number,
  opts?: { totalsOnly?: boolean }
): Promise<InformeVendesRestaurant> {
  return unstable_cache(
    () => computeInformeVendesRestaurant(centreId, any, mes, opts),
    consultesCacheKey(
      "vendes-inf-v1",
      centreId,
      String(any),
      String(mes),
      opts?.totalsOnly ? "t" : "f"
    ),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
}

async function computeInformeVendesRestaurant(
  centreId: string,
  any: number,
  mes: number,
  opts?: { totalsOnly?: boolean }
): Promise<InformeVendesRestaurant> {
  const anual = mes <= 0;
  const totalsOnly = opts?.totalsOnly === true;
  const prev = mesAnterior(any, mes);
  const anyAnt = any - 1;

  const [centre, diaries] = await Promise.all([
    db.centre.findUnique({
      where: { id: centreId },
      select: { id: true, codi: true, nom: true },
    }),
    db.vendaDiariaRestaurant.findMany({
      where: {
        centreId,
        period: anual ? { any } : { any, mes },
      },
      orderBy: [{ period: { mes: "asc" } }, { dia: "asc" }],
      select: {
        dia: true,
        data: true,
        unitats: true,
        base: true,
        formaPagament: true,
        period: { select: { mes: true } },
      },
    }),
  ]);

  const mesosYtd = anual
    ? [...new Set(diaries.map((d) => d.period.mes))].sort((a, b) => a - b)
    : [];

  const emptyArts: Awaited<ReturnType<typeof carregaArticles>> = [];
  const [diariesAnt, plMap, prod, prodAnt, packs, packsAnt] = totalsOnly
    ? await Promise.all([
        db.vendaDiariaRestaurant.findMany({
          where: {
            centreId,
            period: anual
              ? mesosYtd.length
                ? { any: anyAnt, mes: { in: mesosYtd } }
                : { any: anyAnt }
              : { any: prev.any, mes: prev.mes },
          },
          select: { base: true },
        }),
        getVendesPlPerCentres([centreId], any, anual ? null : mes, anual ? mesosYtd : undefined),
        Promise.resolve(emptyArts),
        Promise.resolve(emptyArts),
        Promise.resolve(emptyArts),
        Promise.resolve(emptyArts),
      ])
    : await Promise.all([
        db.vendaDiariaRestaurant.findMany({
          where: {
            centreId,
            period: anual
              ? mesosYtd.length
                ? { any: anyAnt, mes: { in: mesosYtd } }
                : { any: anyAnt }
              : { any: prev.any, mes: prev.mes },
          },
          select: { base: true },
        }),
        getVendesPlPerCentres([centreId], any, anual ? null : mes, anual ? mesosYtd : undefined),
        carregaArticles(centreId, any, anual ? null : mes, "DETALL"),
        carregaArticles(
          centreId,
          anual ? anyAnt : prev.any,
          anual ? null : prev.mes,
          "DETALL",
          anual ? mesosYtd : undefined
        ),
        carregaArticles(centreId, any, anual ? null : mes, "PACK"),
        carregaArticles(
          centreId,
          anual ? anyAnt : prev.any,
          anual ? null : prev.mes,
          "PACK",
          anual ? mesosYtd : undefined
        ),
      ]);

  const centreInfo: CentreRestOpt = centre
    ? {
        id: centre.id,
        codi: centre.codi,
        nom: centre.nom,
        etiqueta: etiquetaGrafic(centre) || normalitzaNomRestaurant(centre.nom),
      }
    : { id: centreId, codi: "", nom: "", etiqueta: "" };

  const evolucioMesos = mesosBuits();
  for (const d of diaries) {
    if (!anual) break;
    const slot = evolucioMesos[d.period.mes - 1];
    if (slot) {
      slot.base += Number(d.base);
      slot.unitats += Number(d.unitats);
      slot.teDades = true;
    }
  }

  const diesMap = new Map<number, DiaVenda>();
  for (const d of diaries) {
    if (anual) break;
    const cur = diesMap.get(d.dia) ?? {
      dia: d.dia,
      dataIso: d.data.toISOString().slice(0, 10),
      unitats: 0,
      base: 0,
    };
    cur.unitats += Number(d.unitats);
    cur.base += Number(d.base);
    diesMap.set(d.dia, cur);
  }
  const dies: DiaVenda[] = [...diesMap.values()].sort((a, b) => a.dia - b.dia);

  const formesMap = new Map<string, { unitats: number; base: number }>();
  for (const d of diaries) {
    const forma = d.formaPagament?.trim();
    if (!forma) continue;
    const cur = formesMap.get(forma) ?? { unitats: 0, base: 0 };
    cur.unitats += Number(d.unitats);
    cur.base += Number(d.base);
    formesMap.set(forma, cur);
  }
  const baseFormes = [...formesMap.values()].reduce((s, f) => s + f.base, 0);
  const formesPagament: FormaPagamentVenda[] = [...formesMap.entries()]
    .map(([forma, v]) => ({
      forma,
      unitats: v.unitats,
      base: v.base,
      pct: pct(v.base, baseFormes),
    }))
    .sort((a, b) => b.base - a.base);

  const base = diaries.reduce((s, d) => s + Number(d.base), 0);
  const unitats = diaries.reduce((s, d) => s + Number(d.unitats), 0);
  const baseAnt = diariesAnt.length ? diariesAnt.reduce((s, d) => s + Number(d.base), 0) : null;
  const vendesPl = plMap.get(centreId) ?? 0;
  const emptyRank = emptyRankingsCategoria();
  const packsMenus = totalsOnly ? [] : packs.filter((r) => esSubfamiliaMenus(r.subfamilia));
  const packsMenusAnt = totalsOnly ? [] : packsAnt.filter((r) => esSubfamiliaMenus(r.subfamilia));
  // Menús (Pack) entren al rànquing de menjar — mateix gra comercial per al comitè
  const menusComMenjar = packsMenus.map((r) => ({ ...r, categoria: "MENJAR" as const }));
  const menusComMenjarAnt = packsMenusAnt.map((r) => ({
    ...r,
    categoria: "MENJAR" as const,
  }));
  const productesRows = totalsOnly ? [] : [...prod, ...menusComMenjar];
  const productesRowsAnt = totalsOnly ? [] : [...prodAnt, ...menusComMenjarAnt];
  const familiesRows = agregaPerClau(productesRows, (r) => r.familia);
  const familiesRowsAnt = agregaPerClau(productesRowsAnt, (r) => r.familia);
  const subfamiliesRows = agregaPerClau(productesRows, (r) => r.subfamilia);
  const subfamiliesRowsAnt = agregaPerClau(productesRowsAnt, (r) => r.subfamilia);
  const mesosAmbDades = evolucioMesos.filter((m) => m.teDades).length;
  const buit = !diaries.length && !prod.length && !packs.length;

  return {
    centre: centreInfo,
    any,
    mes: anual ? 0 : mes,
    ambit: anual ? "any" : "mes",
    periode: anual ? `Any ${any}` : `${MESOS_LLARGS[mes - 1]} ${any}`,
    base,
    unitats,
    baseAnt,
    variacioPct: variacio(base, baseAnt),
    mitjanaDiaria: !anual && dies.length ? base / dies.length : null,
    mitjanaMensual: anual && mesosAmbDades ? base / mesosAmbDades : null,
    vendesPl,
    desviacioPl: diaries.length ? base - vendesPl : null,
    dies,
    evolucioMesos: anual ? evolucioMesos : [],
    formesPagament,
    productes: totalsOnly ? emptyRank : rankingsCategoria(productesRows, productesRowsAnt),
    families: totalsOnly ? emptyRank : rankingsCategoria(familiesRows, familiesRowsAnt),
    subfamilies: totalsOnly ? emptyRank : rankingsCategoria(subfamiliesRows, subfamiliesRowsAnt),
    teFamilies: !totalsOnly && familiesRows.length > 0,
    teSubfamilies: !totalsOnly && subfamiliesRows.length > 0,
    packs: totalsOnly ? emptyRank : rankingsCategoria(packsMenus, packsMenusAnt),
    buit,
  };
}

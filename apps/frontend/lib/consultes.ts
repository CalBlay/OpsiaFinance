import { esSubtotalPresentacio, recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import { aplicarConsolidacio } from "@/lib/consolidacio/service";
import { db } from "@/lib/db";
import {
  GRUP_EMPRESA_DEFAULT,
  type GrupEmpresa,
  etiquetaGrupEmpresa,
  filtraLiniesPerGrup,
} from "@/lib/grups-empresa";
import { esColumnaTotalLnRedundant, lnInformePerAgregacio } from "@/lib/linia-informe";
import { MESOS_CURTS, MESOS_LLARGS, type RangMesos, prismaPeriodFilter } from "@/lib/periodes";
import type { Prisma } from "@prisma/client";

export { MESOS_CURTS, MESOS_LLARGS } from "@/lib/periodes";
export type { RangMesos } from "@/lib/periodes";
export {
  etiquetaRangMesos,
  etiquetaRangMesosLlarga,
  esAnyComplet,
  esUnMes,
  parseRangMesosFromSearchParams,
  rangToQuery,
} from "@/lib/periodes";

async function consolidarSiEmpresaAsync(
  scope: "empresa" | "linia" | "centre",
  concepts: ConceptePivot[],
  mode: "columnes-ln" | "temporal",
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<ConceptePivot[]> {
  // La consolidació intra-empresa només aplica a Cal Blay, no a FDLC.
  if (scope !== "empresa" || grup !== "calblay") return concepts;
  return aplicarConsolidacio(concepts, "CALBLAY_INTRA", mode);
}

const DADA_INFORME_SELECT = {
  import_: true,
  liniaNegociId: true,
  centreId: true,
  senseCentre: true,
  concepteResultatId: true,
  importacio: { select: { liniaNegociId: true } },
} as const;

/* ─── Tipus compartits ───────────────────────────────────────────────────────── */

export interface ConceptePivot {
  node: number;
  /** Id de ConcepteResultat; necessari per editar des de consultes. */
  concepteId?: string;
  descripcio: string;
  esSubtotal: boolean;
  valors: number[]; // longitud variable segons la vista (12 mesos, o N centres)
  total: number;
}

export interface CompteExplotacioCentre {
  centre: {
    id: string;
    codi: string;
    nom: string;
    liniaNegoci: { codi: string; nom: string };
  } | null;
  any: number;
  concepts: ConceptePivot[];
  buit: boolean;
}

export interface ComparativaLn {
  liniaNegoci: { id: string; codi: string; nom: string } | null;
  any: number;
  rang: RangMesos;
  centres: { id: string; codi: string; nom: string }[];
  concepts: ConceptePivot[];
  buit: boolean;
}

/* ─── Helpers de selecció ────────────────────────────────────────────────────── */

/** Anys que tenen dades carregades. */
export async function getAnysAmbDades(): Promise<number[]> {
  const periods = await db.period.findMany({
    where: { dadesResultat: { some: {} } },
    select: { any: true },
    distinct: ["any"],
    orderBy: { any: "desc" },
  });
  return periods.map((p) => p.any);
}

/** Línies de negoci amb els seus centres (per als selectors), ordre alfabètic. */
export async function getArbreSeleccio() {
  const rows = await db.liniaNegoci.findMany({
    where: { isActive: true },
    select: {
      id: true,
      codi: true,
      nom: true,
      centres: {
        where: { isActive: true },
        select: { id: true, codi: true, nom: true },
      },
    },
  });
  const alpha = (a: string, b: string) =>
    a.localeCompare(b, "ca", { sensitivity: "base", numeric: true });
  return rows
    .map((ln) => ({
      ...ln,
      centres: [...ln.centres].sort((a, b) => alpha(a.nom, b.nom) || alpha(a.codi, b.codi)),
    }))
    .sort((a, b) => alpha(a.nom, b.nom) || alpha(a.codi, b.codi));
}

/* ─── Consulta: C.Explotació d'un centre, anual per mesos ─────────────────────── */

export async function getCompteExplotacioCentre(
  centreId: string,
  any: number,
  vista: VistaCompte = "directe"
): Promise<CompteExplotacioCentre> {
  const [centre, concepts, dades] = await Promise.all([
    db.centre.findUnique({
      where: { id: centreId },
      select: {
        id: true,
        codi: true,
        nom: true,
        liniaNegoci: { select: { codi: true, nom: true } },
      },
    }),
    db.concepteResultat.findMany({
      where: { isActive: true },
      orderBy: { ordre: "asc" },
      select: { id: true, node: true, descripcio: true, esSubtotal: true },
    }),
    db.dadaResultat.findMany({
      where: { centreId, period: { any } },
      select: {
        import_: true,
        period: { select: { mes: true } },
        concepteResultatId: true,
      },
    }),
  ]);

  // Ajustos manuals del mateix centre i any (se sumen a la dada SAP)
  const ajustos = await db.ajust.findMany({
    where: { centreId, period: { any } },
    select: { import_: true, period: { select: { mes: true } }, concepteResultatId: true },
  });

  // Acumula per concepte × mes
  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) perConcepte.set(c.id, new Array(12).fill(0));

  for (const d of [...dades, ...ajustos]) {
    const arr = perConcepte.get(d.concepteResultatId);
    if (!arr) continue;
    const mesIdx = d.period.mes - 1;
    if (mesIdx >= 0 && mesIdx < 12) arr[mesIdx] += Number(d.import_);
  }

  const rows: ConceptePivot[] = concepts.map((c) => {
    const valors = perConcepte.get(c.id) ?? new Array(12).fill(0);
    return {
      node: c.node,
      concepteId: c.id,
      descripcio: c.descripcio,
      esSubtotal: esSubtotalPresentacio(c.node, c.esSubtotal),
      valors,
      total: valors.reduce((a, b) => a + b, 0),
    };
  });

  // Subtotals a partir del detall (p.ex. TOTAL COST SALARIAL ← SOUS I SALARIS…),
  // perquè KPIs i files de total reflecteixin ajustos manuals.
  let conceptsOut = recalcularSubtotalsCompte(concepts, rows);
  if (vista === "gestio") {
    const { aplicarTraspassPersonalEvolucioCentre } = await import(
      "@/lib/traspass-personal/gestio-consultes"
    );
    conceptsOut = await aplicarTraspassPersonalEvolucioCentre(centreId, any, conceptsOut);
  }

  return {
    centre,
    any,
    concepts: conceptsOut,
    buit: dades.length === 0 && ajustos.length === 0,
  };
}

/* ─── Consulta: comparativa d'una LN per centres ──────────────────────────────── */

const CENTRE_ALTRES_ID = "__altres__";

export type VistaCompte = "directe" | "gestio";

export async function getComparativaLn(
  liniaNegociId: string,
  any: number,
  rang: RangMesos,
  vista: VistaCompte = "directe"
): Promise<ComparativaLn> {
  const periodFilter = prismaPeriodFilter(any, rang);
  const [ln, concepts, dadesAll] = await Promise.all([
    db.liniaNegoci.findUnique({
      where: { id: liniaNegociId },
      select: {
        id: true,
        codi: true,
        nom: true,
        centres: {
          where: { isActive: true },
          orderBy: { codi: "asc" },
          select: { id: true, codi: true, nom: true },
        },
      },
    }),
    db.concepteResultat.findMany({
      where: { isActive: true },
      orderBy: { ordre: "asc" },
      select: { id: true, node: true, descripcio: true, esSubtotal: true },
    }),
    db.dadaResultat.findMany({
      where: { period: periodFilter },
      select: DADA_INFORME_SELECT,
    }),
  ]);

  const dades = dadesAll.filter(
    (d) => !esColumnaTotalLnRedundant(d) && lnInformePerAgregacio(d) === liniaNegociId
  );

  const ajustos = await db.ajust.findMany({
    where: {
      period: periodFilter,
      OR: [{ liniaNegociId }, { centre: { liniaNegociId } }],
    },
    select: { import_: true, centreId: true, concepteResultatId: true },
  });

  const centresTree = ln?.centres ?? [];
  const treeIds = new Set(centresTree.map((c) => c.id));
  const teAltres = dades.some((d) => !d.centreId && !d.senseCentre);
  const extraCentreIds = [
    ...new Set(dades.map((d) => d.centreId).filter((id): id is string => !!id && !treeIds.has(id))),
  ];
  const extraCentres = extraCentreIds.length
    ? await db.centre.findMany({
        where: { id: { in: extraCentreIds } },
        orderBy: { codi: "asc" },
        select: { id: true, codi: true, nom: true },
      })
    : [];
  const centres = [
    ...centresTree,
    ...extraCentres,
    ...(teAltres ? [{ id: CENTRE_ALTRES_ID, codi: "—", nom: "Altres / codi desconegut" }] : []),
  ];
  const centreIdx = new Map<string, number>();
  centres.forEach((c, i) => centreIdx.set(c.id, i));

  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) perConcepte.set(c.id, new Array(centres.length).fill(0));

  for (const d of dades) {
    const colKey = d.centreId ?? (d.senseCentre ? null : CENTRE_ALTRES_ID);
    if (!colKey) continue;
    const col = centreIdx.get(colKey);
    if (col === undefined) continue;
    const arr = perConcepte.get(d.concepteResultatId);
    if (!arr) continue;
    arr[col] += Number(d.import_);
  }

  for (const a of ajustos) {
    if (!a.centreId) continue;
    const col = centreIdx.get(a.centreId);
    if (col === undefined) continue;
    const arr = perConcepte.get(a.concepteResultatId);
    if (!arr) continue;
    arr[col] += Number(a.import_);
  }

  let centresOut = centres;
  let rows = buildRows(concepts, perConcepte);

  if (vista === "gestio") {
    const { aplicarDeltasTraspassPersonalCentres, carregarDeltasTraspassPersonalPerCentre } =
      await import("@/lib/traspass-personal/gestio-consultes");
    const { aplicarGestioRepartimentLn, carregarDeltasGestioAgregats, COL_REPARTIMENT_ID } =
      await import("@/lib/repartiment/gestio-consultes");

    const deltaByCentreNode = await carregarDeltasTraspassPersonalPerCentre(any, rang);
    const centreIds = centres.map((c) => c.id);
    rows = aplicarDeltasTraspassPersonalCentres(rows, centreIds, deltaByCentreNode);

    const deltaByLnNode = await carregarDeltasGestioAgregats(any, rang);
    const deltaByNode = deltaByLnNode.get(liniaNegociId) ?? new Map<number, number>();
    centresOut = [
      ...centres,
      { id: COL_REPARTIMENT_ID, codi: "Repart.", nom: "Imputació repartiment" },
    ];
    rows = aplicarGestioRepartimentLn(concepts, rows, deltaByNode);
  }

  return {
    liniaNegoci: ln ? { id: ln.id, codi: ln.codi, nom: ln.nom } : null,
    any,
    rang,
    centres: centresOut,
    concepts: rows,
    buit: dades.length === 0 && ajustos.length === 0,
  };
}

/* ─── Helpers interns ─────────────────────────────────────────────────────────── */

async function getConceptsActius() {
  return db.concepteResultat.findMany({
    where: { isActive: true },
    orderBy: { ordre: "asc" },
    select: { id: true, node: true, descripcio: true, esSubtotal: true },
  });
}

type ConcepteBase = { id: string; node: number; descripcio: string; esSubtotal: boolean };

function buildRows(concepts: ConcepteBase[], perConcepte: Map<string, number[]>): ConceptePivot[] {
  const columnCount = perConcepte.values().next().value?.length ?? 0;
  const rows = concepts.map((c) => {
    const valors = perConcepte.get(c.id) ?? new Array(columnCount).fill(0);
    return {
      node: c.node,
      concepteId: c.id,
      descripcio: c.descripcio,
      esSubtotal: esSubtotalPresentacio(c.node, c.esSubtotal),
      valors,
      total: valors.reduce((a, b) => a + b, 0),
    };
  });
  return recalcularSubtotalsCompte(concepts, rows);
}

function lnIdAjust(a: {
  liniaNegociId: string | null;
  centre: { liniaNegociId: string } | null;
}): string | null {
  return a.liniaNegociId ?? a.centre?.liniaNegociId ?? null;
}

async function resolveLiniesGrup(grup: GrupEmpresa) {
  const liniesRawAll = await db.liniaNegoci.findMany({
    where: { isActive: true },
    orderBy: { ordre: "asc" },
    select: { id: true, codi: true, nom: true },
  });
  const linies = filtraLiniesPerGrup(liniesRawAll, grup);
  return { linies, lnIdsGrup: new Set(linies.map((l) => l.id)) };
}

/**
 * Dades + ajustos d'empresa amb la mateixa atribució LN que getComparativaEmpresa
 * (`lnInformePerAgregacio` + filtre de grup Cal Blay / FDLC).
 */
async function carregarDadesEmpresa(
  periodFilter: Prisma.PeriodWhereInput,
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
) {
  const [{ linies, lnIdsGrup }, concepts, dadesAll, ajustosAll] = await Promise.all([
    resolveLiniesGrup(grup),
    getConceptsActius(),
    db.dadaResultat.findMany({
      where: { period: periodFilter },
      select: {
        ...DADA_INFORME_SELECT,
        period: { select: { any: true, mes: true } },
      },
    }),
    db.ajust.findMany({
      where: { period: periodFilter },
      select: {
        import_: true,
        liniaNegociId: true,
        concepteResultatId: true,
        centre: { select: { liniaNegociId: true } },
        period: { select: { any: true, mes: true } },
      },
    }),
  ]);

  const dades = dadesAll.filter((d) => {
    if (esColumnaTotalLnRedundant(d)) return false;
    const lnId = lnInformePerAgregacio(d);
    return !!lnId && lnIdsGrup.has(lnId);
  });
  const ajustos = ajustosAll.filter((a) => {
    const lnId = lnIdAjust(a);
    return !!lnId && lnIdsGrup.has(lnId);
  });

  return {
    concepts,
    linies,
    lnIdsGrup,
    dades,
    ajustos,
    titol: etiquetaGrupEmpresa(grup),
  };
}

/** Pivot 12 mesos a partir de dades ja filtrades (empresa o LN). */
function pivotMensualDesDeMoviments(
  concepts: ConcepteBase[],
  moviments: { import_: unknown; concepteResultatId: string; period: { mes: number } }[]
): ConceptePivot[] {
  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) perConcepte.set(c.id, new Array(12).fill(0));

  for (const d of moviments) {
    const arr = perConcepte.get(d.concepteResultatId);
    if (!arr) continue;
    const idx = d.period.mes - 1;
    if (idx >= 0 && idx < 12) arr[idx] += Number(d.import_);
  }
  return buildRows(concepts, perConcepte);
}

/* ─── Consulta: C.Explotació d'empresa (columnes = línies de negoci) ───────────── */

export interface ComparativaEmpresa {
  any: number;
  rang: RangMesos;
  linies: { id: string; codi: string; nom: string }[];
  concepts: ConceptePivot[];
  buit: boolean;
}

export async function getComparativaEmpresa(
  any: number,
  rang: RangMesos,
  vista: VistaCompte = "directe",
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<ComparativaEmpresa> {
  const periodFilter = prismaPeriodFilter(any, rang);
  const [liniesRawAll, concepts, dades, ajustos] = await Promise.all([
    db.liniaNegoci.findMany({
      where: { isActive: true },
      orderBy: { ordre: "asc" },
      select: { id: true, codi: true, nom: true },
    }),
    getConceptsActius(),
    db.dadaResultat.findMany({
      where: { period: periodFilter },
      select: DADA_INFORME_SELECT,
    }),
    db.ajust.findMany({
      where: { period: periodFilter },
      select: {
        import_: true,
        liniaNegociId: true,
        concepteResultatId: true,
        centre: { select: { liniaNegociId: true } },
      },
    }),
  ]);

  const liniesRaw = filtraLiniesPerGrup(liniesRawAll, grup);
  const lnIdsGrup = new Set(liniesRaw.map((l) => l.id));

  const lnIdx = new Map<string, number>();
  liniesRaw.forEach((l, i) => lnIdx.set(l.id, i));

  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) {
    perConcepte.set(c.id, new Array(liniesRaw.length).fill(0));
  }

  // Mateix criteri que getEvolucioMensual(scope=linia): cada dada va a la LN
  // de lnInformePerAgregacio, excloent columnes total-LN redundants.
  for (const d of dades) {
    if (esColumnaTotalLnRedundant(d)) continue;
    const lnId = lnInformePerAgregacio(d);
    if (!lnId || !lnIdsGrup.has(lnId)) continue;
    const col = lnIdx.get(lnId);
    if (col === undefined) continue;
    const arr = perConcepte.get(d.concepteResultatId);
    if (arr) arr[col] += Number(d.import_);
  }

  for (const a of ajustos) {
    const lnId = a.liniaNegociId ?? a.centre?.liniaNegociId ?? null;
    if (!lnId || !lnIdsGrup.has(lnId)) continue;
    const col = lnIdx.get(lnId);
    if (col === undefined) continue;
    const arr = perConcepte.get(a.concepteResultatId);
    if (arr) arr[col] += Number(a.import_);
  }

  const linies = liniesRaw;

  let conceptRows = buildRows(concepts, perConcepte);

  if (vista === "gestio" && grup === "calblay") {
    const { aplicarGestioRepartiment, carregarDeltasGestioAgregats } = await import(
      "@/lib/repartiment/gestio-consultes"
    );
    const {
      agregarDeltasTraspassPerLn,
      carregarDeltasTraspassPersonalPerCentre,
      combinarDeltasLn,
    } = await import("@/lib/traspass-personal/gestio-consultes");

    const centresActius = await db.centre.findMany({
      where: { isActive: true },
      select: { id: true, liniaNegociId: true },
    });
    const centreToLn = new Map(centresActius.map((c) => [c.id, c.liniaNegociId]));

    const [deltaRepartiment, deltaTraspassCentre] = await Promise.all([
      carregarDeltasGestioAgregats(any, rang),
      carregarDeltasTraspassPersonalPerCentre(any, rang),
    ]);
    const deltaTraspassLn = agregarDeltasTraspassPerLn(deltaTraspassCentre, centreToLn);
    const deltaByLnNode = combinarDeltasLn(deltaRepartiment, deltaTraspassLn);

    const lnIds = liniesRaw.map((l) => l.id);
    conceptRows = aplicarGestioRepartiment(concepts, conceptRows, lnIds, deltaByLnNode);
  }

  const dadesGrup = dades.filter((d) => {
    if (esColumnaTotalLnRedundant(d)) return false;
    const lnId = lnInformePerAgregacio(d);
    return lnId !== null && lnIdsGrup.has(lnId);
  });
  const ajustosGrup = ajustos.filter((a) => {
    const lnId = a.liniaNegociId ?? a.centre?.liniaNegociId ?? null;
    return lnId !== null && lnIdsGrup.has(lnId);
  });

  // Columnes LN = mateix criteri que Evolució/Per línia (sense consolidar).
  // La consolidació només afecta el total d'empresa (evita doble còmput inter-LN).
  if (grup === "calblay") {
    const consolidat = await aplicarConsolidacio(conceptRows, "CALBLAY_INTRA", "columnes-ln");
    const totalPerNode = new Map(consolidat.map((r) => [r.node, r.total]));
    conceptRows = conceptRows.map((r) => ({
      ...r,
      total: totalPerNode.get(r.node) ?? r.valors.reduce((a, b) => a + b, 0),
    }));
  }

  return {
    any,
    rang,
    linies,
    concepts: conceptRows,
    buit: liniesRaw.length === 0 || (dadesGrup.length === 0 && ajustosGrup.length === 0),
  };
}

/* ─── Consulta: evolució mensual (columnes = 12 mesos) per àmbit ───────────────── */

export type AmbitEvolucio = "empresa" | "linia";

export interface EvolucioMensual {
  scope: AmbitEvolucio;
  titol: string;
  any: number;
  concepts: ConceptePivot[];
  buit: boolean;
}

export async function getEvolucioMensual(
  scope: AmbitEvolucio,
  liniaNegociId: string | null,
  any: number,
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<EvolucioMensual> {
  if (scope === "linia" && liniaNegociId) {
    const [ln, concepts, dadesAll, ajustosAll] = await Promise.all([
      db.liniaNegoci.findUnique({
        where: { id: liniaNegociId },
        select: { codi: true, nom: true },
      }),
      getConceptsActius(),
      db.dadaResultat.findMany({
        where: { period: { any } },
        select: {
          ...DADA_INFORME_SELECT,
          period: { select: { mes: true } },
        },
      }),
      db.ajust.findMany({
        where: {
          period: { any },
          OR: [{ liniaNegociId }, { centre: { liniaNegociId } }],
        },
        select: {
          import_: true,
          concepteResultatId: true,
          period: { select: { mes: true } },
        },
      }),
    ]);

    const dades = dadesAll.filter(
      (d) => !esColumnaTotalLnRedundant(d) && lnInformePerAgregacio(d) === liniaNegociId
    );
    const rows = pivotMensualDesDeMoviments(concepts, [...dades, ...ajustosAll]);
    return {
      scope,
      titol: ln ? `${ln.codi} · ${ln.nom}` : "Línia de negoci",
      any,
      concepts: rows,
      buit: dades.length === 0 && ajustosAll.length === 0,
    };
  }

  // Empresa: mateixa base que getComparativaEmpresa (grup + lnInformePerAgregacio)
  const { concepts, dades, ajustos, titol } = await carregarDadesEmpresa({ any }, grup);
  const rows = pivotMensualDesDeMoviments(concepts, [...dades, ...ajustos]);
  return {
    scope: "empresa",
    titol,
    any,
    concepts: await consolidarSiEmpresaAsync("empresa", rows, "temporal", grup),
    buit: dades.length === 0 && ajustos.length === 0,
  };
}

/* ─── Consulta: comparativa temporal per àmbit ─────────────────────────────────── */

export type AmbitTemporal = "empresa" | "linia" | "centre";
export type GranularitatTemporal = "anual" | "mensual" | "mes";

export interface ComparativaTemporal {
  scope: AmbitTemporal;
  titol: string;
  granularitat: GranularitatTemporal;
  columnes: { key: string; label: string; sublabel?: string }[];
  concepts: ConceptePivot[];
  buit: boolean;
  periodeDesc: string;
}

async function resolveAmbitTemporal(
  scope: AmbitTemporal,
  id: string | null,
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<
  | { mode: "empresa"; titol: string; grup: GrupEmpresa }
  | { mode: "linia"; titol: string; liniaNegociId: string }
  | { mode: "centre"; titol: string; centreId: string }
> {
  if (scope === "linia" && id) {
    const ln = await db.liniaNegoci.findUnique({
      where: { id },
      select: { codi: true, nom: true },
    });
    return {
      mode: "linia",
      titol: ln ? `${ln.codi} · ${ln.nom}` : "Línia de negoci",
      liniaNegociId: id,
    };
  }
  if (scope === "centre" && id) {
    const c = await db.centre.findUnique({ where: { id }, select: { codi: true, nom: true } });
    return {
      mode: "centre",
      titol: c ? `${c.codi} · ${c.nom}` : "Centre",
      centreId: id,
    };
  }
  return { mode: "empresa", titol: etiquetaGrupEmpresa(grup), grup };
}

/** Carrega moviments amb la mateixa regla d'atribució a totes les consultes. */
async function carregarMovimentsAmbit(
  ambit: Awaited<ReturnType<typeof resolveAmbitTemporal>>,
  periodFilter: Prisma.PeriodWhereInput
): Promise<{
  concepts: ConcepteBase[];
  moviments: {
    import_: unknown;
    concepteResultatId: string;
    period: { any: number; mes: number };
  }[];
  titol: string;
  buit: boolean;
}> {
  if (ambit.mode === "empresa") {
    const { concepts, dades, ajustos, titol } = await carregarDadesEmpresa(
      periodFilter,
      ambit.grup
    );
    return {
      concepts,
      moviments: [...dades, ...ajustos],
      titol,
      buit: dades.length === 0 && ajustos.length === 0,
    };
  }

  if (ambit.mode === "linia") {
    const { liniaNegociId, titol } = ambit;
    const [concepts, dadesAll, ajustos] = await Promise.all([
      getConceptsActius(),
      db.dadaResultat.findMany({
        where: { period: periodFilter },
        select: {
          ...DADA_INFORME_SELECT,
          period: { select: { any: true, mes: true } },
        },
      }),
      db.ajust.findMany({
        where: {
          period: periodFilter,
          OR: [{ liniaNegociId }, { centre: { liniaNegociId } }],
        },
        select: {
          import_: true,
          concepteResultatId: true,
          period: { select: { any: true, mes: true } },
        },
      }),
    ]);
    const dades = dadesAll.filter(
      (d) => !esColumnaTotalLnRedundant(d) && lnInformePerAgregacio(d) === liniaNegociId
    );
    return {
      concepts,
      moviments: [...dades, ...ajustos],
      titol,
      buit: dades.length === 0 && ajustos.length === 0,
    };
  }

  const { centreId, titol } = ambit;
  const [concepts, dades, ajustos] = await Promise.all([
    getConceptsActius(),
    db.dadaResultat.findMany({
      where: { centreId, period: periodFilter },
      select: {
        import_: true,
        concepteResultatId: true,
        period: { select: { any: true, mes: true } },
      },
    }),
    db.ajust.findMany({
      where: { centreId, period: periodFilter },
      select: {
        import_: true,
        concepteResultatId: true,
        period: { select: { any: true, mes: true } },
      },
    }),
  ]);
  return {
    concepts,
    moviments: [...dades, ...ajustos],
    titol,
    buit: dades.length === 0 && ajustos.length === 0,
  };
}

export interface ComparativaMensualAnys {
  scope: AmbitTemporal;
  titol: string;
  anys: number[];
  perAny: Record<number, ConceptePivot[]>;
  buit: boolean;
  periodeDesc: string;
}

/** Dades mensuals per a múltiples anys (per comparar al gràfic). */
export async function getComparativaMensualEntreAnys(
  scope: AmbitTemporal,
  id: string | null,
  anys: number[]
): Promise<ComparativaMensualAnys> {
  const ambit = await resolveAmbitTemporal(scope, id);
  const anysOrdenats = [...anys].sort((a, b) => a - b);
  const { concepts, moviments, titol, buit } = await carregarMovimentsAmbit(ambit, {
    any: { in: anysOrdenats },
  });

  const perAnyConcepte = new Map<number, Map<string, number[]>>();
  for (const year of anysOrdenats) {
    const m = new Map<string, number[]>();
    for (const c of concepts) m.set(c.id, new Array(12).fill(0));
    perAnyConcepte.set(year, m);
  }

  for (const d of moviments) {
    const yearMap = perAnyConcepte.get(d.period.any);
    if (!yearMap) continue;
    const arr = yearMap.get(d.concepteResultatId);
    if (!arr) continue;
    const idx = d.period.mes - 1;
    if (idx >= 0 && idx < 12) arr[idx] += Number(d.import_);
  }

  const perAny: Record<number, ConceptePivot[]> = {};
  const anysAmbDades: number[] = [];
  for (const year of anysOrdenats) {
    const rows = buildRows(concepts, perAnyConcepte.get(year) ?? new Map<string, number[]>());
    perAny[year] = await consolidarSiEmpresaAsync(scope, rows, "temporal");
    if (perAny[year].some((r) => r.total !== 0)) anysAmbDades.push(year);
  }

  const anysFinals = anysAmbDades.length ? anysAmbDades : anysOrdenats;

  return {
    scope,
    titol,
    anys: anysFinals,
    perAny,
    buit,
    periodeDesc: `Comparació mensual · ${anysFinals.join(" vs ")}`,
  };
}

export async function getComparativaTemporal(
  scope: AmbitTemporal,
  id: string | null,
  opts: {
    granularitat: GranularitatTemporal;
    anys: number[];
    any?: number;
    mes?: number;
  }
): Promise<ComparativaTemporal> {
  const ambit = await resolveAmbitTemporal(scope, id);
  const { granularitat, anys, any, mes } = opts;

  // ─── Mensual: 12 columnes = mesos d'un any concret ───────────────────────────
  if (granularitat === "mensual" && any) {
    const { concepts, moviments, titol, buit } = await carregarMovimentsAmbit(ambit, { any });
    const rows = pivotMensualDesDeMoviments(concepts, moviments);
    const columnes = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
    return {
      scope,
      titol,
      granularitat,
      columnes,
      concepts: await consolidarSiEmpresaAsync(scope, rows, "temporal"),
      buit,
      periodeDesc: `Mes a mes · ${any}`,
    };
  }

  // ─── Mes concret: columnes = anys, només dades d'un mes ──────────────────────
  if (granularitat === "mes" && mes) {
    const anysOrdenats = [...anys].sort((a, b) => a - b);
    const anyIdx = new Map<number, number>();
    anysOrdenats.forEach((y, i) => anyIdx.set(y, i));

    const { concepts, moviments, titol, buit } = await carregarMovimentsAmbit(ambit, {
      any: { in: anysOrdenats },
      mes,
    });

    const perConcepte = new Map<string, number[]>();
    for (const c of concepts) perConcepte.set(c.id, new Array(anysOrdenats.length).fill(0));

    for (const d of moviments) {
      const arr = perConcepte.get(d.concepteResultatId);
      if (!arr) continue;
      const col = anyIdx.get(d.period.any);
      if (col === undefined) continue;
      arr[col] += Number(d.import_);
    }

    const columnes = anysOrdenats.map((y) => ({ key: String(y), label: String(y) }));
    const rows = buildRows(concepts, perConcepte);
    return {
      scope,
      titol,
      granularitat,
      columnes,
      concepts: await consolidarSiEmpresaAsync(scope, rows, "temporal"),
      buit,
      periodeDesc: `${MESOS_LLARGS[mes - 1]} · comparació entre anys`,
    };
  }

  // ─── Anual (per defecte): columnes = anys acumulats ────────────────────────
  const anysOrdenats = [...anys].sort((a, b) => a - b);
  const anyIdx = new Map<number, number>();
  anysOrdenats.forEach((y, i) => anyIdx.set(y, i));

  const { concepts, moviments, titol, buit } = await carregarMovimentsAmbit(ambit, {
    any: { in: anysOrdenats },
  });

  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) perConcepte.set(c.id, new Array(anysOrdenats.length).fill(0));

  for (const d of moviments) {
    const arr = perConcepte.get(d.concepteResultatId);
    if (!arr) continue;
    const col = anyIdx.get(d.period.any);
    if (col === undefined) continue;
    arr[col] += Number(d.import_);
  }

  const columnes = anysOrdenats.map((y) => ({ key: String(y), label: String(y) }));
  const rows = buildRows(concepts, perConcepte);
  return {
    scope,
    titol,
    granularitat: "anual",
    columnes,
    concepts: await consolidarSiEmpresaAsync(scope, rows, "temporal"),
    buit,
    periodeDesc: "Acumulat anual per exercici",
  };
}

/* ─── Drill-down: detall d'una cel·la del compte ─────────────────────────────── */

export interface DetallCellaItem {
  origen: "dada" | "ajust";
  import_: number;
  centreCodi: string | null;
  centreNom: string | null;
  liniaCodi: string | null;
  liniaNom: string | null;
  mes: number;
  any: number;
  motiu: string | null;
}

export interface DetallCellaResult {
  concepteNode: number;
  concepteDescripcio: string;
  items: DetallCellaItem[];
  totalDades: number;
  totalAjustos: number;
  total: number;
}

export interface DetallCellaParams {
  concepteResultatId: string;
  any: number;
  mes?: number;
  rang?: RangMesos;
  centreId?: string;
  liniaNegociId?: string;
  /** IDs de LN permesos al grup (Cal Blay o FDLC). Si s'ometen no es filtra per grup. */
  lnIdsGrup?: string[];
}

export async function getDetallCella(params: DetallCellaParams): Promise<DetallCellaResult> {
  const concepte = await db.concepteResultat.findUnique({
    where: { id: params.concepteResultatId },
    select: { node: true, descripcio: true },
  });
  if (!concepte) {
    return {
      concepteNode: 0,
      concepteDescripcio: "?",
      items: [],
      totalDades: 0,
      totalAjustos: 0,
      total: 0,
    };
  }

  const periodWhere: Prisma.PeriodWhereInput = params.mes
    ? { any: params.any, mes: params.mes }
    : params.rang
      ? prismaPeriodFilter(params.any, params.rang)
      : { any: params.any };

  // Quan filtrem per LN, NO filtrem per liniaNegociId a Prisma directament
  // perquè lnInformePerAgregacio pot apuntar a importacio.liniaNegociId.
  // Carreguem totes les dades del període i filtrem en memòria igual que la taula.
  const prismaWhere = params.centreId ? { centreId: params.centreId } : {};

  const ajustWhere = params.centreId
    ? { centreId: params.centreId }
    : params.liniaNegociId
      ? {
          OR: [
            { liniaNegociId: params.liniaNegociId },
            { centre: { liniaNegociId: params.liniaNegociId } },
          ],
        }
      : {};

  const [dadesRaw, ajustos] = await Promise.all([
    db.dadaResultat.findMany({
      where: {
        concepteResultatId: params.concepteResultatId,
        period: periodWhere,
        ...prismaWhere,
      },
      select: {
        import_: true,
        period: { select: { any: true, mes: true } },
        centreId: true,
        centre: { select: { codi: true, nom: true } },
        liniaNegociId: true,
        liniaNegoci: { select: { codi: true, nom: true } },
        senseCentre: true,
        importacio: { select: { liniaNegociId: true } },
      },
      orderBy: { period: { mes: "asc" } },
    }),
    db.ajust.findMany({
      where: {
        concepteResultatId: params.concepteResultatId,
        period: periodWhere,
        ...ajustWhere,
      },
      select: {
        import_: true,
        motiu: true,
        period: { select: { any: true, mes: true } },
        centreId: true,
        centre: { select: { codi: true, nom: true } },
        liniaNegociId: true,
        liniaNegoci: { select: { codi: true, nom: true } },
      },
      orderBy: { period: { mes: "asc" } },
    }),
  ]);

  // Aplicar exactament els mateixos filtres que les consultes principals:
  // 1. Eliminar columnes de total-LN redundants (eviten doble còmput).
  // 2. Si hi ha liniaNegociId, filtrar per lnInformePerAgregacio (igual que la taula).
  // 3. Si hi ha lnIdsGrup, excloure LN fora del grup (p.ex. FDLC quan estem a Cal Blay).
  const lnIdsGrupSet = params.lnIdsGrup ? new Set(params.lnIdsGrup) : null;
  const dades = dadesRaw.filter((d) => {
    if (esColumnaTotalLnRedundant(d)) return false;
    const lnId = lnInformePerAgregacio(d);
    if (lnIdsGrupSet && (!lnId || !lnIdsGrupSet.has(lnId))) return false;
    if (params.liniaNegociId) return lnId === params.liniaNegociId;
    return true;
  });

  const items: DetallCellaItem[] = [
    ...dades.map((d) => ({
      origen: "dada" as const,
      import_: Number(d.import_),
      centreCodi: d.centre?.codi ?? null,
      centreNom: d.centre?.nom ?? null,
      liniaCodi: d.liniaNegoci?.codi ?? null,
      liniaNom: d.liniaNegoci?.nom ?? null,
      mes: d.period.mes,
      any: d.period.any,
      motiu: null,
    })),
    ...ajustos.map((a) => ({
      origen: "ajust" as const,
      import_: Number(a.import_),
      centreCodi: a.centre?.codi ?? null,
      centreNom: a.centre?.nom ?? null,
      liniaCodi: a.liniaNegoci?.codi ?? null,
      liniaNom: a.liniaNegoci?.nom ?? null,
      mes: a.period.mes,
      any: a.period.any,
      motiu: a.motiu,
    })),
  ];

  const totalDades = dades.reduce((s, d) => s + Number(d.import_), 0);
  const totalAjustos = ajustos.reduce((s, a) => s + Number(a.import_), 0);

  return {
    concepteNode: concepte.node,
    concepteDescripcio: concepte.descripcio,
    items,
    totalDades: Math.round(totalDades * 100) / 100,
    totalAjustos: Math.round(totalAjustos * 100) / 100,
    total: Math.round((totalDades + totalAjustos) * 100) / 100,
  };
}

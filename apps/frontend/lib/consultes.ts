import { esSubtotalPresentacio, recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import { construirParellsInterEmpresaLn } from "@/lib/consolidacio/parells";
import { aplicarConsolidacio } from "@/lib/consolidacio/service";
import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { etiquetaCentre, etiquetaLiniaNegoci, ordenaPerCodi } from "@/lib/consultes-etiquetes";
import { db } from "@/lib/db";
import { FDLC_LN_CODI } from "@/lib/fdlc/constants";
import {
  CENTRE_CODI_MIRALL_SERVEIS_FDLC,
  CODI_LN_MIRALL_SERVEIS_FDLC,
  FDLC_NODE_SERVEIS_RESTAURANT,
  aplicarReclassificacioMirallConsolidat,
  esCentreMirallServeisFdlc,
  getImportMirallServeisFdlcRang,
  getImportsMirallServeisFdlcPerMes,
} from "@/lib/fdlc/mirall-vendes-centre";
import {
  GRUP_EMPRESA_DEFAULT,
  type GrupEmpresa,
  etiquetaGrupEmpresa,
  filtraLiniesPerGrup,
  grupAplicaConsolidacioInter,
  grupAplicaConsolidacioIntra,
  grupPermetVistaGestio,
} from "@/lib/grups-empresa";
import { NODE_VENDES } from "@/lib/kpi-definitions";
import {
  esColumnaTotalLnRedundant,
  lnInformePerAgregacio,
  prismaWhereDadaPerLnInforme,
  prismaWhereDadaPerLnInformeIds,
} from "@/lib/linia-informe";
import {
  MESOS_CURTS,
  MESOS_LLARGS,
  type RangMesos,
  esAnyComplet,
  prismaPeriodFilter,
} from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import {
  vistaInclouAjustos,
  vistaInclouRepartiment,
  vistaInclouTraspassos,
  vistaNomesAjustos,
} from "@/lib/vista-compte";
import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cache } from "react";

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
export type { VistaCompte } from "@/lib/vista-compte";
export {
  parseVistaCompte,
  etiquetaVistaCompte,
  vistaInclouAjustos,
  vistaInclouRepartiment,
  vistaInclouTraspassos,
  vistaNomesAjustos,
} from "@/lib/vista-compte";

async function consolidarSiEmpresaAsync(
  scope: "empresa" | "linia" | "centre",
  concepts: ConceptePivot[],
  mode: "columnes-ln" | "temporal",
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT,
  parellsInterEmpresa?: Map<string, ConceptePivot[]>,
  periode?: { any: number; desMes: number; finsMes: number },
  /** Normes GRUP_EMPRESARIAL (lloguer, factures IC). Només Consolidat · Gestió. */
  inclouInterEmpresa = false
): Promise<ConceptePivot[]> {
  if (scope !== "empresa") return concepts;
  let rows = concepts;
  if (grupAplicaConsolidacioIntra(grup)) {
    rows = await aplicarConsolidacio(rows, "CALBLAY_INTRA", mode, undefined, periode);
  }
  if (inclouInterEmpresa && grupAplicaConsolidacioInter(grup) && parellsInterEmpresa) {
    rows = await aplicarConsolidacio(rows, "GRUP_EMPRESARIAL", mode, parellsInterEmpresa, periode);
  }
  return rows;
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
export const getAnysAmbDades = cache(async (): Promise<number[]> => {
  return unstable_cache(
    async () => {
      const periods = await db.period.findMany({
        where: { dadesResultat: { some: {} } },
        select: { any: true },
        distinct: ["any"],
        orderBy: { any: "desc" },
      });
      return periods.map((p) => p.any);
    },
    consultesCacheKey("consultes-anys-amb-dades"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
});

/** Darrer mes (any+mes) amb dades de resultat del grup seleccionat.
 *  Cal Blay / FDLC: últim mes d'aquell àmbit; Consolidat: el més recent de tots. */
export const getDarrerPeriodAmbDades = cache(
  async (
    grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
  ): Promise<{
    any: number;
    mes: number;
  } | null> =>
    unstable_cache(
      async () => {
        const filtreDades: Prisma.DadaResultatWhereInput =
          grup === "fdlc"
            ? {
                OR: [
                  { liniaNegoci: { codi: FDLC_LN_CODI } },
                  { importacio: { formatInforme: { tipusInforme: "PYG_FDLC" } } },
                ],
              }
            : grup === "calblay"
              ? {
                  AND: [
                    {
                      OR: [
                        { liniaNegociId: null },
                        { liniaNegoci: { codi: { not: FDLC_LN_CODI } } },
                      ],
                    },
                    {
                      NOT: {
                        importacio: { formatInforme: { tipusInforme: "PYG_FDLC" } },
                      },
                    },
                  ],
                }
              : {};

        const dada = await db.dadaResultat.findFirst({
          where: filtreDades,
          select: { period: { select: { any: true, mes: true } } },
          orderBy: [{ period: { any: "desc" } }, { period: { mes: "desc" } }],
        });
        return dada?.period ?? null;
      },
      consultesCacheKey("consultes-darrer-period", grup),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 900 }
    )()
);

/** Línies de negoci amb els seus centres (per als selectors), ordre per codi. */
export const getArbreSeleccio = cache(async () => {
  return unstable_cache(
    async () => {
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
      return ordenaPerCodi(
        rows.map((ln) => ({
          ...ln,
          centres: ordenaPerCodi(ln.centres),
        }))
      );
    },
    consultesCacheKey("consultes-arbre-seleccio"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
});

/** Només id/codi/nom — per al formulari de nova importació (sense centres). */
export const getLiniesImportOptions = cache(async () => {
  return unstable_cache(
    async () =>
      ordenaPerCodi(
        await db.liniaNegoci.findMany({
          where: { isActive: true },
          select: { id: true, codi: true, nom: true },
        })
      ),
    consultesCacheKey("consultes-linies-import"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
});

/* ─── Consulta: C.Explotació d'un centre, anual per mesos ─────────────────────── */

async function computeCompteExplotacioCentreBase(
  centreId: string,
  any: number,
  inclouAjustos: boolean
): Promise<CompteExplotacioCentre> {
  const [centre, concepts, dades, ajustos] = await Promise.all([
    db.centre.findUnique({
      where: { id: centreId },
      select: {
        id: true,
        codi: true,
        nom: true,
        liniaNegoci: { select: { codi: true, nom: true } },
      },
    }),
    getConceptsActius(),
    db.dadaResultat.findMany({
      where: { centreId, period: { any } },
      select: {
        import_: true,
        period: { select: { mes: true } },
        concepteResultatId: true,
      },
    }),
    inclouAjustos
      ? db.ajust.findMany({
          where: { centreId, period: { any } },
          select: { import_: true, period: { select: { mes: true } }, concepteResultatId: true },
        })
      : Promise.resolve(
          [] as { import_: unknown; period: { mes: number }; concepteResultatId: string }[]
        ),
  ]);

  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) perConcepte.set(c.id, new Array(12).fill(0));

  for (const d of [...dades, ...ajustos]) {
    const arr = perConcepte.get(d.concepteResultatId);
    if (!arr) continue;
    const mesIdx = d.period.mes - 1;
    if (mesIdx >= 0 && mesIdx < 12) arr[mesIdx] += Number(d.import_);
  }

  let mirallTeDades = false;
  if (centre && esCentreMirallServeisFdlc(centre.codi)) {
    const mirall = await getImportsMirallServeisFdlcPerMes(any);
    const vendesId = concepts.find((c) => c.node === NODE_VENDES)?.id;
    if (vendesId) {
      const arr = perConcepte.get(vendesId);
      if (arr) {
        for (let i = 0; i < 12; i++) {
          if (mirall[i] !== 0) mirallTeDades = true;
          arr[i] += mirall[i];
        }
      }
    }
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

  return {
    centre,
    any,
    concepts: recalcularSubtotalsCompte(concepts, rows),
    buit: dades.length === 0 && ajustos.length === 0 && !mirallTeDades,
  };
}

const getCompteExplotacioCentreBase = cache(
  async (centreId: string, any: number, inclouAjustos: boolean): Promise<CompteExplotacioCentre> =>
    unstable_cache(
      () => computeCompteExplotacioCentreBase(centreId, any, inclouAjustos),
      consultesCacheKey("consultes-centre-base", centreId, String(any), inclouAjustos ? "1" : "0"),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 900 }
    )()
);

async function aplicarTraspassosCentre(
  centreId: string,
  any: number,
  base: CompteExplotacioCentre
): Promise<CompteExplotacioCentre> {
  const { aplicarCostPersonalEvolucioCentre } = await import(
    "@/lib/cost-personal-centre/gestio-consultes"
  );
  const conceptsOut = await aplicarCostPersonalEvolucioCentre(
    centreId,
    any,
    base.concepts.map((r) => ({ ...r, valors: [...r.valors] }))
  );
  return { ...base, concepts: conceptsOut };
}

export async function getCompteExplotacioCentre(
  centreId: string,
  any: number,
  vista: VistaCompte = "directe"
): Promise<CompteExplotacioCentre> {
  if (vistaNomesAjustos(vista)) {
    const [sap, directe] = await Promise.all([
      getCompteExplotacioCentreBase(centreId, any, false),
      getCompteExplotacioCentreBase(centreId, any, true),
    ]);
    return { ...directe, concepts: restarConceptesPivot(directe.concepts, sap.concepts) };
  }
  const base = await getCompteExplotacioCentreBase(centreId, any, vistaInclouAjustos(vista));
  // Al centre, Gestió = Directe + traspassos (sense repartiment a columnes mes).
  if (!vistaInclouTraspassos(vista)) return base;
  return aplicarTraspassosCentre(centreId, any, base);
}

/** Capes centre amb una sola lectura SAP+ajustos (canvi de vista al client). */
export async function getCompteExplotacioCentreParell(
  centreId: string,
  any: number
): Promise<{
  sap: CompteExplotacioCentre;
  ajustos: CompteExplotacioCentre;
  directe: CompteExplotacioCentre;
  traspassos: CompteExplotacioCentre;
  gestio: CompteExplotacioCentre;
}> {
  const [sap, directe] = await Promise.all([
    getCompteExplotacioCentreBase(centreId, any, false),
    getCompteExplotacioCentreBase(centreId, any, true),
  ]);
  const ambTraspass = await aplicarTraspassosCentre(centreId, any, directe);
  return {
    sap,
    ajustos: { ...directe, concepts: restarConceptesPivot(directe.concepts, sap.concepts) },
    directe,
    traspassos: ambTraspass,
    gestio: ambTraspass,
  };
}

/* ─── Consulta: comparativa d'una LN per centres ──────────────────────────────── */

const CENTRE_ALTRES_ID = "__altres__";

export async function getComparativaLn(
  liniaNegociId: string,
  any: number,
  rang: RangMesos,
  vista: VistaCompte = "directe"
): Promise<ComparativaLn> {
  if (vistaNomesAjustos(vista)) {
    const [sap, directe] = await Promise.all([
      getComparativaLn(liniaNegociId, any, rang, "sap"),
      getComparativaLn(liniaNegociId, any, rang, "directe"),
    ]);
    return { ...directe, concepts: restarConceptesPivot(directe.concepts, sap.concepts) };
  }
  return unstable_cache(
    () => computeComparativaLn(liniaNegociId, any, rang, vista),
    consultesCacheKey(
      "consultes-cmp-ln-v1",
      liniaNegociId,
      String(any),
      String(rang.des),
      String(rang.fins),
      vista
    ),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 900 }
  )();
}

async function computeComparativaLn(
  liniaNegociId: string,
  any: number,
  rang: RangMesos,
  vista: VistaCompte = "directe"
): Promise<ComparativaLn> {
  const periodFilter = prismaPeriodFilter(any, rang);
  const [ln, concepts, dades, ajustos] = await Promise.all([
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
    getConceptsActius(),
    db.dadaResultat.findMany({
      where: {
        period: periodFilter,
        ...prismaWhereDadaPerLnInforme(liniaNegociId),
      },
      select: DADA_INFORME_SELECT,
    }),
    db.ajust.findMany({
      where: {
        period: periodFilter,
        OR: [{ liniaNegociId }, { centre: { liniaNegociId } }],
      },
      select: { import_: true, centreId: true, concepteResultatId: true },
    }),
  ]);

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

  // Vista SAP: treure ajustos ja aplicats (recalculem sense ells).
  if (!vistaInclouAjustos(vista)) {
    const perConcepteSap = new Map<string, number[]>();
    for (const c of concepts) perConcepteSap.set(c.id, new Array(centres.length).fill(0));
    for (const d of dades) {
      const centreKey = d.centreId ?? (d.senseCentre ? CENTRE_ALTRES_ID : null);
      if (!centreKey) continue;
      const col = centreIdx.get(centreKey);
      if (col === undefined) continue;
      const arr = perConcepteSap.get(d.concepteResultatId);
      if (arr) arr[col] += Number(d.import_);
    }
    rows = buildRows(concepts, perConcepteSap);
  }

  if (vistaInclouTraspassos(vista)) {
    const { aplicarBaseGestioPersonalCentres } = await import(
      "@/lib/cost-personal-centre/gestio-consultes"
    );
    rows = await aplicarBaseGestioPersonalCentres(
      any,
      rang,
      centres.map((c) => c.id),
      rows
    );
  }

  if (vistaInclouRepartiment(vista)) {
    const {
      aplicarGestioRepartimentLn,
      carregarDeltasGestioAgregats,
      COL_REPARTIMENT_ID,
      COL_REPARTIMENT_CODI,
      COL_REPARTIMENT_NOM,
    } = await import("@/lib/repartiment/gestio-consultes");
    const { REPARTIMENT_APLICAT_A_GESTIO } = await import("@/lib/repartiment/constants");

    if (REPARTIMENT_APLICAT_A_GESTIO) {
      const deltaByLnNode = await carregarDeltasGestioAgregats(any, rang);
      const deltaByNode = deltaByLnNode.get(liniaNegociId) ?? new Map<number, number>();
      const { CODI_LN_CENTRAL } = await import("@/lib/repartiment/nodes");
      const lnCodi = await db.liniaNegoci.findUnique({
        where: { id: liniaNegociId },
        select: { codi: true },
      });
      centresOut = [
        ...centres,
        { id: COL_REPARTIMENT_ID, codi: COL_REPARTIMENT_CODI, nom: COL_REPARTIMENT_NOM },
      ];
      rows = aplicarGestioRepartimentLn(concepts, rows, deltaByNode, {
        substituirDirecteCentral: lnCodi?.codi === CODI_LN_CENTRAL,
      });
    }
  }

  return {
    liniaNegoci: ln ? { id: ln.id, codi: ln.codi, nom: ln.nom } : null,
    any,
    rang,
    centres: centresOut,
    concepts: rows,
    buit: dades.length === 0 && (vistaInclouAjustos(vista) ? ajustos.length === 0 : true),
  };
}

/* ─── Helpers interns ─────────────────────────────────────────────────────────── */

const getConceptsActius = cache(async () => {
  return unstable_cache(
    async () =>
      db.concepteResultat.findMany({
        where: { isActive: true },
        orderBy: { ordre: "asc" },
        select: { id: true, node: true, descripcio: true, esSubtotal: true },
      }),
    consultesCacheKey("consultes-concepts-actius"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
});

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
async function carregarDadesEmpresaUncached(
  periodFilter: Prisma.PeriodWhereInput,
  grup: GrupEmpresa
) {
  const { linies, lnIdsGrup } = await resolveLiniesGrup(grup);
  const lnIds = [...lnIdsGrup];

  const [concepts, dadesAll, ajustosAll] = await Promise.all([
    getConceptsActius(),
    db.dadaResultat.findMany({
      where: {
        period: periodFilter,
        ...prismaWhereDadaPerLnInformeIds(lnIds),
      },
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

  // Amb N>1 LN el where SQL és candidat: encara cal excloure totals redundants.
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

/**
 * Lectura d'any complet compartida (cache per petició): Empresa + Evolució
 * reutilitzen la mateixa scan de DadaResultat/Ajust.
 */
const carregarDadesEmpresaPerAny = cache(async (any: number, grup: GrupEmpresa) =>
  carregarDadesEmpresaUncached({ any }, grup)
);

async function carregarDadesEmpresa(
  periodFilter: Prisma.PeriodWhereInput,
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
) {
  if (typeof periodFilter.any === "number" && Object.keys(periodFilter).length === 1) {
    return carregarDadesEmpresaPerAny(periodFilter.any, grup);
  }
  return carregarDadesEmpresaUncached(periodFilter, grup);
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

function cloneConceptePivot(rows: ConceptePivot[]): ConceptePivot[] {
  return rows.map((r) => ({ ...r, valors: [...r.valors] }));
}

/** Directe − SAP: mateixa estructura del compte, només la capa d’ajustos. */
export function restarConceptesPivot(
  directe: ConceptePivot[],
  sap: ConceptePivot[]
): ConceptePivot[] {
  const byNode = new Map(sap.map((r) => [r.node, r]));
  return directe.map((r) => {
    const altre = byNode.get(r.node);
    const valors = r.valors.map((v, i) => v - (altre?.valors[i] ?? 0));
    return { ...r, valors, total: valors.reduce((s, x) => s + x, 0) };
  });
}

async function aplicarConsolidacioTotalsLn(
  conceptRows: ConceptePivot[],
  grup: GrupEmpresa,
  linies: { codi: string }[] = [],
  periode?: { any: number; desMes: number; finsMes: number },
  /** Normes GRUP_EMPRESARIAL. Només Consolidat · Gestió. */
  inclouInterEmpresa = false
): Promise<ConceptePivot[]> {
  if (
    !grupAplicaConsolidacioIntra(grup) &&
    !(inclouInterEmpresa && grupAplicaConsolidacioInter(grup))
  ) {
    return conceptRows;
  }

  let working = cloneConceptePivot(conceptRows);

  if (grupAplicaConsolidacioIntra(grup)) {
    working = await aplicarConsolidacio(
      working,
      "CALBLAY_INTRA",
      "columnes-ln",
      undefined,
      periode
    );
  }

  if (inclouInterEmpresa && grupAplicaConsolidacioInter(grup) && linies.length > 0) {
    const parells = construirParellsInterEmpresaLn(working, linies);
    working = await aplicarConsolidacio(
      working,
      "GRUP_EMPRESARIAL",
      "columnes-ln",
      parells,
      periode
    );
  }

  const totalPerNode = new Map(working.map((r) => [r.node, r.total]));
  return conceptRows.map((r) => ({
    ...r,
    total: totalPerNode.get(r.node) ?? r.valors.reduce((a, b) => a + b, 0),
  }));
}

/**
 * Base SAP[+ajustos] (sense capa Gestió).
 * - Cache per petició (React cache): les capes reutilitzen l'agregació.
 * - Cache cross-request (`unstable_cache`): canviar de pestanya no torna a escanejar la BD.
 *   Es buida de cop en mutar dades (`revalidateConsultesDades` canvia l'epoch de la clau).
 * - Any complet: comparteix `carregarDadesEmpresaPerAny` amb Evolució.
 * - Rang parcial (p.ex. Inici = 1 mes): només carrega aquell període.
 */
async function computeComparativaEmpresaBase(
  any: number,
  des: number,
  fins: number,
  grup: GrupEmpresa,
  inclouAjustos = true
): Promise<ComparativaEmpresa & { conceptDefs: ConcepteBase[] }> {
  const rang: RangMesos = { des, fins };
  const packed = esAnyComplet(rang)
    ? await carregarDadesEmpresaPerAny(any, grup)
    : await carregarDadesEmpresa(prismaPeriodFilter(any, rang), grup);

  const { concepts, linies, lnIdsGrup, dades, ajustos } = packed;

  const dadesRang = esAnyComplet(rang)
    ? dades
    : dades.filter((d) => d.period.mes >= des && d.period.mes <= fins);
  const ajustosRang = !inclouAjustos
    ? []
    : esAnyComplet(rang)
      ? ajustos
      : ajustos.filter((a) => a.period.mes >= des && a.period.mes <= fins);

  const lnIdx = new Map<string, number>();
  linies.forEach((l, i) => lnIdx.set(l.id, i));

  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) {
    perConcepte.set(c.id, new Array(linies.length).fill(0));
  }

  let nDades = 0;
  for (const d of dadesRang) {
    const lnId = lnInformePerAgregacio(d);
    if (!lnId || !lnIdsGrup.has(lnId)) continue;
    nDades++;
    const col = lnIdx.get(lnId);
    if (col === undefined) continue;
    const arr = perConcepte.get(d.concepteResultatId);
    if (arr) arr[col] += Number(d.import_);
  }

  let nAjustos = 0;
  for (const a of ajustosRang) {
    const lnId = lnIdAjust(a);
    if (!lnId || !lnIdsGrup.has(lnId)) continue;
    nAjustos++;
    const col = lnIdx.get(lnId);
    if (col === undefined) continue;
    const arr = perConcepte.get(a.concepteResultatId);
    if (arr) arr[col] += Number(a.import_);
  }

  const conceptRows = buildRows(concepts, perConcepte);

  return {
    any,
    rang,
    linies,
    concepts: conceptRows,
    conceptDefs: concepts,
    buit: linies.length === 0 || (nDades === 0 && nAjustos === 0),
  };
}

const getComparativaEmpresaBase = cache(
  async (
    any: number,
    des: number,
    fins: number,
    grup: GrupEmpresa,
    inclouAjustos = true
  ): Promise<ComparativaEmpresa & { conceptDefs: ConcepteBase[] }> =>
    unstable_cache(
      () => computeComparativaEmpresaBase(any, des, fins, grup, inclouAjustos),
      consultesCacheKey(
        "consultes-cmp-empresa-base-v4",
        String(any),
        String(des),
        String(fins),
        grup,
        inclouAjustos ? "1" : "0"
      ),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 900 }
    )()
);

/** Aplica traspassos de personal (substitueix bloc personal per LN). */
async function aplicarTraspassosComparativaEmpresa(
  base: ComparativaEmpresa & { conceptDefs: ConcepteBase[] }
): Promise<ConceptePivot[]> {
  const { aplicarBaseGestioPersonalLinies } = await import(
    "@/lib/cost-personal-centre/gestio-consultes"
  );
  return aplicarBaseGestioPersonalLinies(
    base.any,
    base.rang,
    base.linies.map((l) => l.id),
    cloneConceptePivot(base.concepts)
  );
}

async function aplicarGestioComparativaEmpresa(
  base: ComparativaEmpresa & { conceptDefs: ConcepteBase[] },
  grup: GrupEmpresa,
  opts?: { inclouTraspassos?: boolean }
): Promise<ComparativaEmpresa> {
  const { aplicarGestioRepartiment, carregarDeltasGestioAgregats } = await import(
    "@/lib/repartiment/gestio-consultes"
  );
  const { REPARTIMENT_APLICAT_A_GESTIO } = await import("@/lib/repartiment/constants");

  const lnIds = base.linies.map((l) => l.id);
  let conceptRows =
    opts?.inclouTraspassos === false
      ? cloneConceptePivot(base.concepts)
      : await aplicarTraspassosComparativaEmpresa(base);

  const mirall =
    grup === "consolidat" ? await getImportMirallServeisFdlcRang(base.any, base.rang) : null;

  if (REPARTIMENT_APLICAT_A_GESTIO) {
    const deltaRepartiment = await carregarDeltasGestioAgregats(base.any, base.rang);
    const { CODI_LN_CENTRAL } = await import("@/lib/repartiment/nodes");
    const central = await db.liniaNegoci.findUnique({
      where: { codi: CODI_LN_CENTRAL },
      select: { id: true },
    });
    conceptRows = aplicarGestioRepartiment(base.conceptDefs, conceptRows, lnIds, deltaRepartiment, {
      substituirLnIds: central ? new Set([central.id]) : undefined,
      invariantOriginal: base.concepts,
    });
  }

  if (grup === "consolidat" && mirall) {
    conceptRows = aplicarReclassificacioMirallConsolidat(conceptRows, base.linies, mirall);
  }

  conceptRows = await aplicarConsolidacioTotalsLn(
    conceptRows,
    grup,
    base.linies,
    {
      any: base.any,
      desMes: base.rang.des,
      finsMes: base.rang.fins,
    },
    true /* inter-empresa: Consolidat · Gestió */
  );

  return {
    any: base.any,
    rang: base.rang,
    linies: base.linies,
    concepts: conceptRows,
    buit: base.buit,
  };
}

export async function getComparativaEmpresa(
  any: number,
  rang: RangMesos,
  vista: VistaCompte = "directe",
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<ComparativaEmpresa> {
  const potGestio = grupPermetVistaGestio(grup);
  const vistaEfectiva =
    potGestio || !vistaRequereixGestioSafe(vista) ? vista : ("directe" as VistaCompte);

  if (vistaNomesAjustos(vistaEfectiva)) {
    const [sap, directe] = await Promise.all([
      getComparativaEmpresa(any, rang, "sap", grup),
      getComparativaEmpresa(any, rang, "directe", grup),
    ]);
    return { ...directe, concepts: restarConceptesPivot(directe.concepts, sap.concepts) };
  }

  const base = await getComparativaEmpresaBase(
    any,
    rang.des,
    rang.fins,
    grup,
    vistaInclouAjustos(vistaEfectiva)
  );

  if (vistaInclouRepartiment(vistaEfectiva) && potGestio) {
    return aplicarGestioComparativaEmpresa(base, grup);
  }

  if (vistaInclouTraspassos(vistaEfectiva) && potGestio) {
    const conceptRows = await aplicarConsolidacioTotalsLn(
      await aplicarTraspassosComparativaEmpresa(base),
      grup,
      base.linies,
      { any: base.any, desMes: base.rang.des, finsMes: base.rang.fins },
      false
    );
    return {
      any: base.any,
      rang: base.rang,
      linies: base.linies,
      concepts: conceptRows,
      buit: base.buit,
    };
  }

  const concepts = await aplicarConsolidacioTotalsLn(
    cloneConceptePivot(base.concepts),
    grup,
    base.linies,
    { any: base.any, desMes: base.rang.des, finsMes: base.rang.fins },
    false /* Directe/SAP: només intra */
  );
  return {
    any: base.any,
    rang: base.rang,
    linies: base.linies,
    concepts,
    buit: base.buit,
  };
}

function vistaRequereixGestioSafe(vista: VistaCompte): boolean {
  return vista === "traspassos" || vista === "gestio";
}

/**
 * Capes empresa amb una sola lectura SAP+ajustos.
 * Ideal per canviar de vista al client sense un segon round-trip al servidor.
 */
export async function getComparativaEmpresaParell(
  any: number,
  rang: RangMesos,
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<{
  sap: ComparativaEmpresa;
  directe: ComparativaEmpresa;
  traspassos: ComparativaEmpresa | null;
  gestio: ComparativaEmpresa | null;
}> {
  const [baseSap, baseDirecte] = await Promise.all([
    getComparativaEmpresaBase(any, rang.des, rang.fins, grup, false),
    getComparativaEmpresaBase(any, rang.des, rang.fins, grup, true),
  ]);

  const periode = {
    any: baseDirecte.any,
    desMes: baseDirecte.rang.des,
    finsMes: baseDirecte.rang.fins,
  };

  const [sapConcepts, directeConcepts] = await Promise.all([
    aplicarConsolidacioTotalsLn(
      cloneConceptePivot(baseSap.concepts),
      grup,
      baseSap.linies,
      periode,
      false
    ),
    aplicarConsolidacioTotalsLn(
      cloneConceptePivot(baseDirecte.concepts),
      grup,
      baseDirecte.linies,
      periode,
      false
    ),
  ]);

  const sap: ComparativaEmpresa = {
    any: baseSap.any,
    rang: baseSap.rang,
    linies: baseSap.linies,
    concepts: sapConcepts,
    buit: baseSap.buit,
  };
  const directe: ComparativaEmpresa = {
    any: baseDirecte.any,
    rang: baseDirecte.rang,
    linies: baseDirecte.linies,
    concepts: directeConcepts,
    buit: baseDirecte.buit,
  };

  if (!grupPermetVistaGestio(grup)) {
    return { sap, directe, traspassos: null, gestio: null };
  }

  const [traspassConcepts, gestio] = await Promise.all([
    aplicarConsolidacioTotalsLn(
      await aplicarTraspassosComparativaEmpresa(baseDirecte),
      grup,
      baseDirecte.linies,
      periode,
      false
    ),
    aplicarGestioComparativaEmpresa(baseDirecte, grup),
  ]);

  return {
    sap,
    directe,
    traspassos: {
      any: baseDirecte.any,
      rang: baseDirecte.rang,
      linies: baseDirecte.linies,
      concepts: traspassConcepts,
      buit: baseDirecte.buit,
    },
    gestio,
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
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT,
  opts?: { inclouAjustos?: boolean }
): Promise<EvolucioMensual> {
  const inclouAjustos = opts?.inclouAjustos !== false;
  if (scope === "linia" && liniaNegociId) {
    return getEvolucioMensualLn(liniaNegociId, any, inclouAjustos);
  }

  return getEvolucioMensualEmpresa(any, grup, inclouAjustos);
}

/** Evolució mensual segons la vista del C.Explotació (inclou capa només-ajustos). */
export async function getEvolucioMensualPerVista(
  scope: AmbitEvolucio,
  liniaNegociId: string | null,
  any: number,
  grup: GrupEmpresa,
  vista: VistaCompte
): Promise<EvolucioMensual> {
  if (vistaNomesAjustos(vista)) {
    const [directe, sap] = await Promise.all([
      getEvolucioMensual(scope, liniaNegociId, any, grup, { inclouAjustos: true }),
      getEvolucioMensual(scope, liniaNegociId, any, grup, { inclouAjustos: false }),
    ]);
    return { ...directe, concepts: restarConceptesPivot(directe.concepts, sap.concepts) };
  }
  return getEvolucioMensual(scope, liniaNegociId, any, grup, {
    inclouAjustos: vistaInclouAjustos(vista),
  });
}

/**
 * Aplica normes inter-empresa (lloguer, factures IC) sobre una evolució ja amb capa Gestió.
 * Respecta imports mensuals (1–12). Només té efecte amb grup Consolidat.
 */
export async function aplicarConsolidacioInterEvolucioEmpresa(
  any: number,
  grup: GrupEmpresa,
  concepts: ConceptePivot[],
  rangMesos: { desMes: number; finsMes: number } = { desMes: 1, finsMes: 12 }
): Promise<ConceptePivot[]> {
  if (!grupAplicaConsolidacioInter(grup)) return concepts;

  const {
    concepts: conceptDefs,
    dades,
    ajustos,
    linies,
  } = await carregarDadesEmpresaPerAny(any, grup);

  const fdlcIds = new Set(linies.filter((l) => l.codi === FDLC_LN_CODI).map((l) => l.id));
  const dadesCb = dades.filter((d) => {
    const lnId = lnInformePerAgregacio(d);
    return !!lnId && !fdlcIds.has(lnId);
  });
  const dadesFdlc = dades.filter((d) => {
    const lnId = lnInformePerAgregacio(d);
    return !!lnId && fdlcIds.has(lnId);
  });
  const ajustosCb = ajustos.filter((a) => {
    const lnId = lnIdAjust(a);
    return !!lnId && !fdlcIds.has(lnId);
  });
  const ajustosFdlc = ajustos.filter((a) => {
    const lnId = lnIdAjust(a);
    return !!lnId && fdlcIds.has(lnId);
  });

  const parells = new Map([
    ["calblay", pivotMensualDesDeMoviments(conceptDefs, [...dadesCb, ...ajustosCb])],
    ["fdlc", pivotMensualDesDeMoviments(conceptDefs, [...dadesFdlc, ...ajustosFdlc])],
  ]);

  return aplicarConsolidacio(concepts, "GRUP_EMPRESARIAL", "temporal", parells, {
    any,
    desMes: rangMesos.desMes,
    finsMes: rangMesos.finsMes,
  });
}

const getEvolucioMensualEmpresa = cache(
  async (any: number, grup: GrupEmpresa, inclouAjustos = true): Promise<EvolucioMensual> =>
    unstable_cache(
      async () => {
        const { concepts, dades, ajustos, linies, titol } = await carregarDadesEmpresaPerAny(
          any,
          grup
        );
        const ajustosUse = inclouAjustos ? ajustos : [];
        const rows = pivotMensualDesDeMoviments(concepts, [...dades, ...ajustosUse]);

        let parells: Map<string, ConceptePivot[]> | undefined;
        if (grupAplicaConsolidacioInter(grup)) {
          const fdlcIds = new Set(linies.filter((l) => l.codi === FDLC_LN_CODI).map((l) => l.id));
          const dadesCb = dades.filter((d) => {
            const lnId = lnInformePerAgregacio(d);
            return !!lnId && !fdlcIds.has(lnId);
          });
          const dadesFdlc = dades.filter((d) => {
            const lnId = lnInformePerAgregacio(d);
            return !!lnId && fdlcIds.has(lnId);
          });
          const ajustosCb = ajustosUse.filter((a) => {
            const lnId = lnIdAjust(a);
            return !!lnId && !fdlcIds.has(lnId);
          });
          const ajustosFdlc = ajustosUse.filter((a) => {
            const lnId = lnIdAjust(a);
            return !!lnId && fdlcIds.has(lnId);
          });

          parells = new Map([
            ["calblay", pivotMensualDesDeMoviments(concepts, [...dadesCb, ...ajustosCb])],
            ["fdlc", pivotMensualDesDeMoviments(concepts, [...dadesFdlc, ...ajustosFdlc])],
          ]);
        }

        return {
          scope: "empresa" as const,
          titol,
          any,
          concepts: await consolidarSiEmpresaAsync(
            "empresa",
            rows,
            "temporal",
            grup,
            parells,
            { any, desMes: 1, finsMes: 12 },
            false /* Directe / base: només intra; inter a Gestió */
          ),
          buit: dades.length === 0 && ajustosUse.length === 0,
        };
      },
      consultesCacheKey(
        "consultes-evolucio-empresa-v4",
        String(any),
        grup,
        inclouAjustos ? "1" : "0"
      ),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 900 }
    )()
);

const getEvolucioMensualLn = cache(
  async (liniaNegociId: string, any: number, inclouAjustos = true): Promise<EvolucioMensual> =>
    unstable_cache(
      async () => {
        const [ln, concepts, dades, ajustosAll] = await Promise.all([
          db.liniaNegoci.findUnique({
            where: { id: liniaNegociId },
            select: { codi: true, nom: true },
          }),
          getConceptsActius(),
          db.dadaResultat.findMany({
            where: {
              period: { any },
              ...prismaWhereDadaPerLnInforme(liniaNegociId),
            },
            select: {
              ...DADA_INFORME_SELECT,
              period: { select: { mes: true } },
            },
          }),
          inclouAjustos
            ? db.ajust.findMany({
                where: {
                  period: { any },
                  OR: [{ liniaNegociId }, { centre: { liniaNegociId } }],
                },
                select: {
                  import_: true,
                  concepteResultatId: true,
                  period: { select: { mes: true } },
                },
              })
            : Promise.resolve(
                [] as { import_: unknown; concepteResultatId: string; period: { mes: number } }[]
              ),
        ]);

        const rows = pivotMensualDesDeMoviments(concepts, [...dades, ...ajustosAll]);
        return {
          scope: "linia" as const,
          titol: ln ? etiquetaLiniaNegoci(ln) : "Línia de negoci",
          any,
          concepts: rows,
          buit: dades.length === 0 && ajustosAll.length === 0,
        };
      },
      consultesCacheKey(
        "consultes-evolucio-ln-v2",
        liniaNegociId,
        String(any),
        inclouAjustos ? "1" : "0"
      ),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 900 }
    )()
);

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
      titol: ln ? etiquetaLiniaNegoci(ln) : "Línia de negoci",
      liniaNegociId: id,
    };
  }
  if (scope === "centre" && id) {
    const c = await db.centre.findUnique({ where: { id }, select: { codi: true, nom: true } });
    return {
      mode: "centre",
      titol: c ? etiquetaCentre(c) : "Centre",
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
    const [concepts, dades, ajustos] = await Promise.all([
      getConceptsActius(),
      db.dadaResultat.findMany({
        where: {
          period: periodFilter,
          ...prismaWhereDadaPerLnInforme(liniaNegociId),
        },
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

/** Màxim d'exercicis a la comparativa temporal (els més recents). */
export const MAX_ANYS_COMPARATIVA = 4;

/** Aplica capes de vista (traspassos / repartiment) a un exercici de 12 mesos. */
export async function aplicarCapaVistaEvolucio(
  scope: AmbitTemporal,
  id: string | null,
  any: number,
  rows: ConceptePivot[],
  grup: GrupEmpresa,
  vista: VistaCompte
): Promise<ConceptePivot[]> {
  return aplicarVistaCompteComparativaAny(scope, id, any, rows, grup, vista);
}

/** Aplica capes de vista (traspassos / repartiment) a un exercici de 12 mesos. */
async function aplicarVistaCompteComparativaAny(
  scope: AmbitTemporal,
  id: string | null,
  any: number,
  rows: ConceptePivot[],
  grup: GrupEmpresa,
  vista: VistaCompte
): Promise<ConceptePivot[]> {
  if (rows.length === 0) return rows;
  if (!vistaInclouTraspassos(vista) && !vistaInclouRepartiment(vista)) return rows;
  if (vistaRequereixGestioSafe(vista) && !grupPermetVistaGestio(grup) && scope !== "centre") {
    return rows;
  }

  let out = rows;

  if (scope === "centre" && id && vistaInclouTraspassos(vista)) {
    const { aplicarCostPersonalEvolucioCentre } = await import(
      "@/lib/cost-personal-centre/gestio-consultes"
    );
    return aplicarCostPersonalEvolucioCentre(id, any, out);
  }

  if (scope === "linia" && id) {
    if (vistaInclouTraspassos(vista)) {
      const { aplicarBaseGestioPersonalEvolucioLn } = await import(
        "@/lib/cost-personal-centre/gestio-consultes"
      );
      out = await aplicarBaseGestioPersonalEvolucioLn(id, any, out);
    }
    if (vistaInclouRepartiment(vista)) {
      const { aplicarVistaGestioEvolucioLn } = await import("@/lib/repartiment/gestio-consultes");
      out = await aplicarVistaGestioEvolucioLn(id, any, out);
    }
    return out;
  }

  if (scope === "empresa") {
    if (vistaInclouTraspassos(vista)) {
      const { aplicarBaseGestioPersonalEvolucioEmpresa } = await import(
        "@/lib/cost-personal-centre/gestio-consultes"
      );
      out = await aplicarBaseGestioPersonalEvolucioEmpresa(any, out);
    }
    if (vistaInclouRepartiment(vista)) {
      const { aplicarVistaGestioEvolucioEmpresa } = await import(
        "@/lib/repartiment/gestio-consultes"
      );
      out = await aplicarVistaGestioEvolucioEmpresa(any, out);
      if (grupAplicaConsolidacioInter(grup)) {
        out = await aplicarConsolidacioInterEvolucioEmpresa(any, grup, out);
      }
    }
    return out;
  }

  return out;
}

async function aplicarVistaCompteComparativaPerAny(
  scope: AmbitTemporal,
  id: string | null,
  perAny: Record<number, ConceptePivot[]>,
  anys: number[],
  grup: GrupEmpresa,
  vista: VistaCompte
): Promise<Record<number, ConceptePivot[]>> {
  if (!vistaInclouTraspassos(vista) && !vistaInclouRepartiment(vista)) return perAny;
  if (vistaRequereixGestioSafe(vista) && !grupPermetVistaGestio(grup) && scope !== "centre") {
    return perAny;
  }
  const out: Record<number, ConceptePivot[]> = { ...perAny };
  await Promise.all(
    anys.map(async (year) => {
      out[year] = await aplicarVistaCompteComparativaAny(
        scope,
        id,
        year,
        perAny[year] ?? [],
        grup,
        vista
      );
    })
  );
  return out;
}

/** Resumeix 12 mesos → 1 valor per any (columnes = exercicis). */
function colapseMensualAColumnesAnys(
  perAny: Record<number, ConceptePivot[]>,
  anys: number[],
  mes?: number
): ConceptePivot[] {
  const ref =
    anys.map((y) => perAny[y]).find((rows) => rows && rows.length > 0) ?? ([] as ConceptePivot[]);
  return ref.map((c) => {
    const valors = anys.map((year) => {
      const row = perAny[year]?.find((r) => r.node === c.node);
      if (!row) return 0;
      if (mes != null) return row.valors[mes - 1] ?? 0;
      return row.valors.reduce((a, b) => a + b, 0);
    });
    return {
      ...c,
      valors,
      total: valors.reduce((a, b) => a + b, 0),
    };
  });
}

/** Dades mensuals per a múltiples anys (per comparar al gràfic). */
export async function getComparativaMensualEntreAnys(
  scope: AmbitTemporal,
  id: string | null,
  anys: number[],
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT,
  vista: VistaCompte = "directe"
): Promise<ComparativaMensualAnys> {
  const anysOrdenats = [...anys].sort((a, b) => a - b);
  const anysKey = anysOrdenats.join(",");
  const vistaEfectiva =
    !vistaRequereixGestioSafe(vista) || grupPermetVistaGestio(grup) ? vista : "directe";
  return unstable_cache(
    async () => {
      const ambit = await resolveAmbitTemporal(scope, id, grup);
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
        perAny[year] = await consolidarSiEmpresaAsync(scope, rows, "temporal", grup, undefined, {
          any: year,
          desMes: 1,
          finsMes: 12,
        });
        if (perAny[year].some((r) => r.total !== 0)) anysAmbDades.push(year);
      }

      const anysFinals = anysAmbDades.length ? anysAmbDades : anysOrdenats;
      const perAnyFinal =
        vistaInclouTraspassos(vistaEfectiva) || vistaInclouRepartiment(vistaEfectiva)
          ? await aplicarVistaCompteComparativaPerAny(
              scope,
              id,
              perAny,
              anysFinals,
              grup,
              vistaEfectiva
            )
          : perAny;

      return {
        scope,
        titol,
        anys: anysFinals,
        perAny: perAnyFinal,
        buit,
        periodeDesc: `Comparació mensual · ${anysFinals.join(" vs ")}`,
      };
    },
    consultesCacheKey("consultes-cmp-mensual-anys", scope, id ?? "", anysKey, grup, vistaEfectiva),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 900 }
  )();
}

export async function getComparativaTemporal(
  scope: AmbitTemporal,
  id: string | null,
  opts: {
    granularitat: GranularitatTemporal;
    anys: number[];
    any?: number;
    mes?: number;
  },
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT,
  vista: VistaCompte = "directe"
): Promise<ComparativaTemporal> {
  const { granularitat, anys, any, mes } = opts;
  const anysOrdenats = [...anys].sort((a, b) => a - b);
  const vistaEfectiva =
    !vistaRequereixGestioSafe(vista) || grupPermetVistaGestio(grup) ? vista : "directe";

  // Capes amb traspassos/repartiment anual / un mes: parteix de mensuals.
  if (
    (vistaInclouTraspassos(vistaEfectiva) || vistaInclouRepartiment(vistaEfectiva)) &&
    granularitat !== "mensual"
  ) {
    const mensual = await getComparativaMensualEntreAnys(
      scope,
      id,
      anysOrdenats,
      grup,
      vistaEfectiva
    );
    const columnes = mensual.anys.map((y) => ({ key: String(y), label: String(y) }));
    if (granularitat === "mes" && mes) {
      return {
        scope,
        titol: mensual.titol,
        granularitat,
        columnes,
        concepts: colapseMensualAColumnesAnys(mensual.perAny, mensual.anys, mes),
        buit: mensual.buit,
        periodeDesc: `${MESOS_LLARGS[mes - 1]} · comparació entre anys`,
      };
    }
    return {
      scope,
      titol: mensual.titol,
      granularitat: "anual",
      columnes,
      concepts: colapseMensualAColumnesAnys(mensual.perAny, mensual.anys),
      buit: mensual.buit,
      periodeDesc: "Acumulat anual per exercici",
    };
  }

  const cacheKey = [
    "consultes-cmp-temporal",
    scope,
    id ?? "",
    granularitat,
    anysOrdenats.join(","),
    String(any ?? ""),
    String(mes ?? ""),
    grup,
    vistaEfectiva,
  ];

  return unstable_cache(
    async () => {
      const ambit = await resolveAmbitTemporal(scope, id, grup);

      if (granularitat === "mensual" && any) {
        const { concepts, moviments, titol, buit } = await carregarMovimentsAmbit(ambit, { any });
        const rows = pivotMensualDesDeMoviments(concepts, moviments);
        const columnes = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
        let conceptsOut = await consolidarSiEmpresaAsync(scope, rows, "temporal", grup, undefined, {
          any,
          desMes: 1,
          finsMes: 12,
        });
        if (vistaInclouTraspassos(vistaEfectiva) || vistaInclouRepartiment(vistaEfectiva)) {
          conceptsOut = await aplicarVistaCompteComparativaAny(
            scope,
            id,
            any,
            conceptsOut,
            grup,
            vistaEfectiva
          );
        }
        return {
          scope,
          titol,
          granularitat,
          columnes,
          concepts: conceptsOut,
          buit,
          periodeDesc: `Mes a mes · ${any}`,
        };
      }

      if (granularitat === "mes" && mes) {
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
          concepts: await consolidarSiEmpresaAsync(scope, rows, "temporal", grup),
          buit,
          periodeDesc: `${MESOS_LLARGS[mes - 1]} · comparació entre anys`,
        };
      }

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
        granularitat: "anual" as const,
        columnes,
        concepts: await consolidarSiEmpresaAsync(scope, rows, "temporal", grup),
        buit,
        periodeDesc: "Acumulat anual per exercici",
      };
    },
    consultesCacheKey(...cacheKey),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 900 }
  )();
}

/* ─── Drill-down: detall d'una cel·la del compte ─────────────────────────────── */

export interface DetallCellaItem {
  origen: "dada" | "ajust" | "repartiment" | "mirall" | "traspass" | "payroll";
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
  totalRepartiment: number;
  totalMirall: number;
  totalTraspass: number;
  /** @deprecated Payroll ja no alimenta Gestió; sempre 0. */
  totalPayroll: number;
  /** @deprecated Sempre false (payroll informatiu). */
  payrollSubstitueix: boolean;
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
  /** Capes del compte: a SAP no s'inclouen ajustos; a Gestió, repartiment/traspass. */
  vista?: VistaCompte;
  /** Àmbit d'empresa (calblay / fdlc / consolidat). */
  grup?: GrupEmpresa;
}

export async function getDetallCella(params: DetallCellaParams): Promise<DetallCellaResult> {
  return getDetallCellaCached(
    params.concepteResultatId,
    params.any,
    params.mes,
    params.rang?.des,
    params.rang?.fins,
    params.centreId,
    params.liniaNegociId,
    (params.lnIdsGrup ?? []).slice().sort().join(","),
    params.vista ?? "directe",
    params.grup ?? ""
  );
}

const getDetallCellaCached = cache(
  async (
    concepteResultatId: string,
    any: number,
    mes: number | undefined,
    des: number | undefined,
    fins: number | undefined,
    centreId: string | undefined,
    liniaNegociId: string | undefined,
    lnIdsGrupKey: string,
    vista: VistaCompte,
    grup: string
  ): Promise<DetallCellaResult> => {
    const params: DetallCellaParams = {
      concepteResultatId,
      any,
      mes,
      rang: des != null && fins != null ? { des, fins } : undefined,
      centreId,
      liniaNegociId,
      lnIdsGrup: lnIdsGrupKey ? lnIdsGrupKey.split(",") : undefined,
      vista,
      grup: grup ? (grup as GrupEmpresa) : undefined,
    };
    return unstable_cache(
      () => computeDetallCella(params),
      consultesCacheKey(
        "consultes-detall-cella-v1",
        concepteResultatId,
        String(any),
        mes != null ? String(mes) : "",
        des != null && fins != null ? `${des}-${fins}` : "",
        centreId ?? "",
        liniaNegociId ?? "",
        lnIdsGrupKey,
        vista,
        grup
      ),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 600 }
    )();
  }
);

async function computeDetallCella(params: DetallCellaParams): Promise<DetallCellaResult> {
  const vistaEfectiva = params.vista ?? "directe";
  const periodWhere: Prisma.PeriodWhereInput = params.mes
    ? { any: params.any, mes: params.mes }
    : params.rang
      ? prismaPeriodFilter(params.any, params.rang)
      : { any: params.any };

  const emptyDetall = (node = 0, descripcio = "?"): DetallCellaResult => ({
    concepteNode: node,
    concepteDescripcio: descripcio,
    items: [],
    totalDades: 0,
    totalAjustos: 0,
    totalRepartiment: 0,
    totalMirall: 0,
    totalTraspass: 0,
    totalPayroll: 0,
    payrollSubstitueix: false,
    total: 0,
  });

  const [concepte, periods] = await Promise.all([
    db.concepteResultat.findUnique({
      where: { id: params.concepteResultatId },
      select: { node: true, descripcio: true },
    }),
    db.period.findMany({
      where: periodWhere,
      select: { id: true, any: true, mes: true },
      orderBy: { mes: "asc" },
    }),
  ]);

  if (!concepte) return emptyDetall();

  const periodIds = periods.map((p) => p.id);
  const periodById = new Map(periods.map((p) => [p.id, p]));
  const dadaPeriodWhere: Prisma.DadaResultatWhereInput =
    periodIds.length > 0 ? { periodId: { in: periodIds } } : { period: periodWhere };
  const ajustPeriodWhere: Prisma.AjustWhereInput =
    periodIds.length > 0 ? { periodId: { in: periodIds } } : { period: periodWhere };

  if ((params.mes || params.rang) && periodIds.length === 0) {
    return emptyDetall(concepte.node, concepte.descripcio);
  }

  // Filtre LN via prismaWhereDadaPerLnInforme (mateixa semàntica que lnInformePerAgregacio).
  // No usar mai centre.liniaNegociId ni només dada.liniaNegociId.
  const prismaWhere: Prisma.DadaResultatWhereInput = params.centreId
    ? { centreId: params.centreId }
    : params.liniaNegociId
      ? prismaWhereDadaPerLnInforme(params.liniaNegociId)
      : params.lnIdsGrup?.length
        ? prismaWhereDadaPerLnInformeIds(params.lnIdsGrup)
        : {};

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

  const [dadesRaw, ajustosRaw] = await Promise.all([
    db.dadaResultat.findMany({
      where: {
        concepteResultatId: params.concepteResultatId,
        ...dadaPeriodWhere,
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
    vistaInclouAjustos(vistaEfectiva)
      ? db.ajust.findMany({
          where: {
            concepteResultatId: params.concepteResultatId,
            ...ajustPeriodWhere,
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
        })
      : Promise.resolve([]),
  ]);
  const ajustos = ajustosRaw;

  // Amb filtre exacte d'1 LN el SQL ja és definitiu; amb set de LN cal
  // excloure totals redundants i revalidar pertenència (igual que la taula).
  const lnIdsGrupSet = params.lnIdsGrup ? new Set(params.lnIdsGrup) : null;
  const dades = params.liniaNegociId
    ? dadesRaw
    : dadesRaw.filter((d) => {
        if (esColumnaTotalLnRedundant(d)) return false;
        const lnId = lnInformePerAgregacio(d);
        if (lnIdsGrupSet && (!lnId || !lnIdsGrupSet.has(lnId))) return false;
        return true;
      });

  const items: DetallCellaItem[] = [
    ...(vistaNomesAjustos(vistaEfectiva)
      ? []
      : dades.map((d) => ({
          origen: "dada" as const,
          import_: Number(d.import_),
          centreCodi: d.centre?.codi ?? null,
          centreNom: d.centre?.nom ?? null,
          liniaCodi: d.liniaNegoci?.codi ?? null,
          liniaNom: d.liniaNegoci?.nom ?? null,
          mes: d.period.mes,
          any: d.period.any,
          motiu: null,
        }))),
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

  let totalRepartiment = 0;
  let totalMirall = 0;

  // Capes amb repartiment: afegir imputacions (totals → línia de detall).
  // No s'apliquen a nivell centre (van a la columna Estructura / total LN).
  if (vistaInclouRepartiment(vistaEfectiva) && !params.centreId) {
    const { NODE_COST_SALARIAL, nodeTotalDesDeDetall } = await import("@/lib/repartiment/nodes");
    const { getMovimentsGestioDetall } = await import("@/lib/repartiment/service");

    // Sous (13) i SS (15) hereten el delta del total 17 (prorratejat); igual 7/8 ← 11.
    const nodeDelta =
      nodeTotalDesDeDetall(concepte.node) ??
      (concepte.node === NODE_COST_SALARIAL ? NODE_COST_SALARIAL : null);

    if (nodeDelta != null && periodIds.length) {
      const lnFilter = params.liniaNegociId
        ? [params.liniaNegociId]
        : lnIdsGrupSet
          ? [...lnIdsGrupSet]
          : undefined;

      const moviments = await getMovimentsGestioDetall(
        periodIds,
        nodeDelta,
        lnFilter,
        concepte.node
      );

      const lnIdsNeeded = [...new Set(moviments.map((m) => m.liniaNegociDestiId))];
      const linies =
        lnIdsNeeded.length > 0
          ? await db.liniaNegoci.findMany({
              where: { id: { in: lnIdsNeeded } },
              select: { id: true, codi: true, nom: true },
            })
          : [];
      const lnById = new Map(linies.map((l) => [l.id, l]));

      for (const m of moviments) {
        const period = periodById.get(m.periodId);
        const ln = lnById.get(m.liniaNegociDestiId);
        if (!period || !ln) continue;
        totalRepartiment += m.import_;
        items.push({
          origen: "repartiment",
          import_: m.import_,
          centreCodi: null,
          centreNom: null,
          liniaCodi: ln.codi,
          liniaNom: ln.nom,
          mes: period.mes,
          any: period.any,
          motiu: m.detallCalcul ? `${m.normaNom} — ${m.detallCalcul}` : m.normaNom,
        });
      }
    }
  }

  // Consolidat · Gestió: Prestació FDLC → Vendes LN00001 (CCR00008) al detall.
  if (params.grup === "consolidat" && vistaInclouRepartiment(vistaEfectiva) && !params.centreId) {
    const ln = params.liniaNegociId
      ? await db.liniaNegoci.findUnique({
          where: { id: params.liniaNegociId },
          select: { codi: true, nom: true },
        })
      : null;
    const lnCodi = ln?.codi ?? null;

    const esVendesRestaurants =
      concepte.node === NODE_VENDES && (lnCodi === null || lnCodi === CODI_LN_MIRALL_SERVEIS_FDLC);
    const esPrestacioFdlc =
      concepte.node === FDLC_NODE_SERVEIS_RESTAURANT &&
      (lnCodi === null || lnCodi === FDLC_LN_CODI);

    if (esVendesRestaurants || esPrestacioFdlc) {
      const mirallMesos = await getImportsMirallServeisFdlcPerMes(params.any);
      const mesosFiltres = params.mes
        ? [params.mes]
        : (() => {
            const rang = params.rang;
            return rang
              ? Array.from({ length: rang.fins - rang.des + 1 }, (_, i) => rang.des + i)
              : Array.from({ length: 12 }, (_, i) => i + 1);
          })();

      const centreMirall = await db.centre.findFirst({
        where: { codi: CENTRE_CODI_MIRALL_SERVEIS_FDLC, isActive: true },
        select: {
          codi: true,
          nom: true,
          liniaNegoci: { select: { codi: true, nom: true } },
        },
      });
      const lnDesti = esVendesRestaurants
        ? lnCodi
          ? ln
          : await db.liniaNegoci.findFirst({
              where: { codi: CODI_LN_MIRALL_SERVEIS_FDLC },
              select: { codi: true, nom: true },
            })
        : lnCodi
          ? ln
          : await db.liniaNegoci.findFirst({
              where: { codi: FDLC_LN_CODI },
              select: { codi: true, nom: true },
            });

      const signe = esVendesRestaurants ? 1 : -1;
      const motiu = esVendesRestaurants
        ? "Gestió consolidat · serveis restaurant FDLC → LN00001"
        : "Reclassificat a Vendes LN00001 (gestió consolidat)";

      for (const mes of mesosFiltres) {
        const imp = mirallMesos[mes - 1] ?? 0;
        if (imp === 0) continue;
        const valor = Math.round(imp * signe * 100) / 100;
        totalMirall += valor;
        items.push({
          origen: "mirall",
          import_: valor,
          centreCodi: centreMirall?.codi ?? CENTRE_CODI_MIRALL_SERVEIS_FDLC,
          centreNom: centreMirall?.nom ?? "RESTAURANT FONT DE LA CANYA",
          liniaCodi:
            lnDesti?.codi ?? (esVendesRestaurants ? CODI_LN_MIRALL_SERVEIS_FDLC : FDLC_LN_CODI),
          liniaNom: lnDesti?.nom ?? null,
          mes,
          any: params.any,
          motiu,
        });
      }
    }
  }

  // Centre CCR00008: mirall operatiu a VENDES (C.Explotació del centre).
  if (params.centreId && concepte.node === NODE_VENDES) {
    const centre = await db.centre.findUnique({
      where: { id: params.centreId },
      select: {
        codi: true,
        nom: true,
        liniaNegoci: { select: { codi: true, nom: true } },
      },
    });
    if (centre && esCentreMirallServeisFdlc(centre.codi)) {
      const mirallMesos = await getImportsMirallServeisFdlcPerMes(params.any);
      const mesosFiltres = params.mes
        ? [params.mes]
        : (() => {
            const rang = params.rang;
            return rang
              ? Array.from({ length: rang.fins - rang.des + 1 }, (_, i) => rang.des + i)
              : Array.from({ length: 12 }, (_, i) => i + 1);
          })();

      for (const mes of mesosFiltres) {
        const imp = mirallMesos[mes - 1] ?? 0;
        if (imp === 0) continue;
        const valor = Math.round(imp * 100) / 100;
        totalMirall += valor;
        items.push({
          origen: "mirall",
          import_: valor,
          centreCodi: centre.codi,
          centreNom: centre.nom,
          liniaCodi: centre.liniaNegoci.codi,
          liniaNom: centre.liniaNegoci.nom,
          mes,
          any: params.any,
          motiu: "Mirall · serveis restaurant FDLC",
        });
      }
    }
  }

  const totalDades = vistaNomesAjustos(vistaEfectiva)
    ? 0
    : dades.reduce((s, d) => s + Number(d.import_), 0);
  const totalAjustos = ajustos.reduce((s, a) => s + Number(a.import_), 0);

  let totalTraspass = 0;

  // Capes amb traspassos: traspassos de personal (node 17 → presentació a sous 13 + SS 15).
  if (vistaInclouTraspassos(vistaEfectiva)) {
    const {
      NODE_COST_SALARIAL,
      NODE_SOUS_SALARIS,
      NODE_SEGURETAT_SOCIAL,
      fraccioDetallDinsTotal,
      nodeTotalDesDeDetall,
      nodesPresentacioGestio,
    } = await import("@/lib/repartiment/nodes");
    const nodeDelta =
      concepte.node === NODE_COST_SALARIAL || concepte.node === NODE_SOUS_SALARIS
        ? NODE_COST_SALARIAL
        : nodeTotalDesDeDetall(concepte.node);

    if (nodeDelta === NODE_COST_SALARIAL) {
      if (periodIds.length) {
        const periodByIdTr = periodById;

        let centreFilter: string[] | null = null;
        if (params.centreId) {
          centreFilter = [params.centreId];
        } else if (params.liniaNegociId) {
          const centresLn = await db.centre.findMany({
            where: { liniaNegociId: params.liniaNegociId, isActive: true },
            select: { id: true },
          });
          centreFilter = centresLn.map((c) => c.id);
        } else if (params.lnIdsGrup?.length) {
          const centresGrup = await db.centre.findMany({
            where: { liniaNegociId: { in: params.lnIdsGrup }, isActive: true },
            select: { id: true },
          });
          centreFilter = centresGrup.map((c) => c.id);
        }

        const moviments = await db.movimentTraspassPersonal.findMany({
          where: {
            execucio: { estat: "CONFIRMAT", periodId: { in: periodIds } },
            ...(centreFilter
              ? {
                  OR: [
                    { centreOrigenId: { in: centreFilter } },
                    { centreDestiId: { in: centreFilter } },
                  ],
                }
              : {}),
          },
          select: {
            import_: true,
            departament: true,
            centreOrigenId: true,
            centreDestiId: true,
            centreOrigen: {
              select: {
                id: true,
                codi: true,
                nom: true,
                liniaNegoci: { select: { codi: true, nom: true } },
              },
            },
            centreDesti: {
              select: {
                id: true,
                codi: true,
                nom: true,
                liniaNegoci: { select: { codi: true, nom: true } },
              },
            },
            execucio: { select: { periodId: true } },
          },
        });

        const centreSet = centreFilter ? new Set(centreFilter) : null;
        const detallsPers = nodesPresentacioGestio(NODE_COST_SALARIAL);
        const calProrratejar =
          concepte.node !== NODE_COST_SALARIAL && detallsPers.includes(concepte.node);

        // Bases Directe sous/SS per centre×període (prorrateig drill-down).
        const basesByKey = new Map<string, Map<number, number>>();
        if (calProrratejar && moviments.length) {
          const centreIds = [
            ...new Set(moviments.flatMap((m) => [m.centreOrigenId, m.centreDestiId])),
          ];
          const dades = await db.dadaResultat.findMany({
            where: {
              periodId: { in: periodIds },
              centreId: { in: centreIds },
              concepteResultat: {
                node: { in: [NODE_SOUS_SALARIS, NODE_SEGURETAT_SOCIAL] },
              },
            },
            select: {
              periodId: true,
              centreId: true,
              import_: true,
              concepteResultat: { select: { node: true } },
            },
          });
          for (const d of dades) {
            const key = `${d.periodId}:${d.centreId}`;
            let m = basesByKey.get(key);
            if (!m) {
              m = new Map();
              basesByKey.set(key, m);
            }
            m.set(
              d.concepteResultat.node,
              (m.get(d.concepteResultat.node) ?? 0) + Number(d.import_)
            );
          }
        }

        const fraccioCentre = (periodId: string, centreId: string) => {
          if (!calProrratejar) return 1;
          const bases = basesByKey.get(`${periodId}:${centreId}`) ?? new Map();
          return fraccioDetallDinsTotal(concepte.node, NODE_COST_SALARIAL, bases);
        };

        for (const m of moviments) {
          const period = periodByIdTr.get(m.execucio.periodId);
          if (!period) continue;
          const imp = Number(m.import_);
          const dept = m.departament === "CUINA" ? "Cuina" : "Sala";

          // Origen: surt cost → delta +. Destí: entra cost → delta −.
          if (!centreSet || centreSet.has(m.centreOrigenId)) {
            const f = fraccioCentre(m.execucio.periodId, m.centreOrigenId);
            const importProrrat = imp * f;
            totalTraspass += importProrrat;
            items.push({
              origen: "traspass",
              import_: importProrrat,
              centreCodi: m.centreOrigen.codi,
              centreNom: m.centreOrigen.nom,
              liniaCodi: m.centreOrigen.liniaNegoci?.codi ?? null,
              liniaNom: m.centreOrigen.liniaNegoci?.nom ?? null,
              mes: period.mes,
              any: period.any,
              motiu: `Surt cap a ${m.centreDesti.codi} · ${m.centreDesti.nom} (${dept})`,
            });
          }
          if (!centreSet || centreSet.has(m.centreDestiId)) {
            const f = fraccioCentre(m.execucio.periodId, m.centreDestiId);
            const importProrrat = imp * f;
            totalTraspass -= importProrrat;
            items.push({
              origen: "traspass",
              import_: -importProrrat,
              centreCodi: m.centreDesti.codi,
              centreNom: m.centreDesti.nom,
              liniaCodi: m.centreDesti.liniaNegoci?.codi ?? null,
              liniaNom: m.centreDesti.liniaNegoci?.nom ?? null,
              mes: period.mes,
              any: period.any,
              motiu: `Entra des de ${m.centreOrigen.codi} · ${m.centreOrigen.nom} (${dept})`,
            });
          }
        }
      }
    }
  }

  // Vista Gestió · personal: el total = base Gestió (SAP+ajust+traspass per centre×mes)
  // + repartiment LN. El traspass ja va dins la base → no el sumem una altra vegada.
  let totalCalc: number;
  const {
    esNodePersonalCompte,
    NODE_SOUS_SALARIS,
    NODE_INDEMNITZACIONS,
    NODE_SEGURETAT_SOCIAL,
    NODE_ALTRES_DESPESES_SOCIALS,
    NODE_CONTRACTES_ETT,
    NODE_TOTAL_COST_SALARIAL,
  } = await import("@/lib/cost-personal-centre/nodes");
  if (
    vistaInclouTraspassos(vistaEfectiva) &&
    esNodePersonalCompte(concepte.node) &&
    (params.centreId || params.liniaNegociId)
  ) {
    const mesFiltre =
      params.mes ?? (params.rang && params.rang.des === params.rang.fins ? params.rang.des : null);
    const { carregarBaseGestioPersonal } = await import("@/lib/cost-personal-centre/base-gestio");
    const base = await carregarBaseGestioPersonal({
      any: params.any,
      mes: mesFiltre,
      centreId: params.centreId,
      liniaNegociId: params.centreId ? undefined : params.liniaNegociId,
    });
    let sumBase = 0;
    const mesosOk =
      mesFiltre != null
        ? new Set([mesFiltre])
        : (() => {
            const rang = params.rang;
            return rang
              ? new Set(Array.from({ length: rang.fins - rang.des + 1 }, (_, i) => rang.des + i))
              : null;
          })();
    for (const perMes of base.values()) {
      for (const [m, cel] of perMes) {
        if (mesosOk && !mesosOk.has(m)) continue;
        if (concepte.node === NODE_SOUS_SALARIS) sumBase += cel.imports.importBrut;
        else if (concepte.node === NODE_INDEMNITZACIONS) sumBase += cel.imports.indemnitzacions;
        else if (concepte.node === NODE_SEGURETAT_SOCIAL) sumBase += cel.imports.totalSegSocial;
        else if (concepte.node === NODE_ALTRES_DESPESES_SOCIALS)
          sumBase += cel.imports.altresDespesesSocials;
        else if (concepte.node === NODE_CONTRACTES_ETT) sumBase += cel.imports.contractesEtt;
        else if (concepte.node === NODE_TOTAL_COST_SALARIAL) sumBase += cel.imports.costPersonal;
      }
    }
    totalCalc = sumBase + (params.centreId ? 0 : totalRepartiment);
  } else {
    totalCalc = totalDades + totalAjustos + totalRepartiment + totalMirall + totalTraspass;
  }

  return {
    concepteNode: concepte.node,
    concepteDescripcio: concepte.descripcio,
    items,
    totalDades: Math.round(totalDades * 100) / 100,
    totalAjustos: Math.round(totalAjustos * 100) / 100,
    totalRepartiment: Math.round(totalRepartiment * 100) / 100,
    totalMirall: Math.round(totalMirall * 100) / 100,
    totalTraspass: Math.round(totalTraspass * 100) / 100,
    totalPayroll: 0,
    payrollSubstitueix: false,
    total: Math.round(totalCalc * 100) / 100,
  };
}

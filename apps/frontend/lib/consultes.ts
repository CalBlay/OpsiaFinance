import { esSubtotalPresentacio, recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import { aplicarConsolidacio } from "@/lib/consolidacio/service";
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
import { MESOS_CURTS, MESOS_LLARGS, type RangMesos, prismaPeriodFilter } from "@/lib/periodes";
import type { Prisma } from "@prisma/client";
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

async function consolidarSiEmpresaAsync(
  scope: "empresa" | "linia" | "centre",
  concepts: ConceptePivot[],
  mode: "columnes-ln" | "temporal",
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<ConceptePivot[]> {
  if (scope !== "empresa") return concepts;
  const { grupAplicaConsolidacioIntra } = await import("@/lib/grups-empresa");
  if (!grupAplicaConsolidacioIntra(grup)) return concepts;
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
export const getAnysAmbDades = cache(async (): Promise<number[]> => {
  const periods = await db.period.findMany({
    where: { dadesResultat: { some: {} } },
    select: { any: true },
    distinct: ["any"],
    orderBy: { any: "desc" },
  });
  return periods.map((p) => p.any);
});

/** Darrer mes (any+mes) amb dades de resultat del grup seleccionat.
 *  Cal Blay / FDLC: últim mes d'aquell àmbit; Consolidat: el més recent de tots. */
export const getDarrerPeriodAmbDades = cache(
  async (
    grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
  ): Promise<{
    any: number;
    mes: number;
  } | null> => {
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
                  OR: [{ liniaNegociId: null }, { liniaNegoci: { codi: { not: FDLC_LN_CODI } } }],
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
  }
);

/** Línies de negoci amb els seus centres (per als selectors), ordre per codi. */
export const getArbreSeleccio = cache(async () => {
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
});

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
    getConceptsActius(),
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

  // FDLC 70500002 → VENDES a CCR00008 (només aquesta vista; no toca agregacions Cal Blay)
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

  // Subtotals a partir del detall (p.ex. TOTAL COST SALARIAL ← SOUS I SALARIS…),
  // perquè KPIs i files de total reflecteixin ajustos manuals.
  let conceptsOut = recalcularSubtotalsCompte(concepts, rows);
  if (vista === "gestio") {
    // Base única Gestió personal: SAP+ajust → traspass (centre×mes). Sense payroll.
    const { aplicarCostPersonalEvolucioCentre } = await import(
      "@/lib/cost-personal-centre/gestio-consultes"
    );
    conceptsOut = await aplicarCostPersonalEvolucioCentre(centreId, any, conceptsOut);
  }

  return {
    centre,
    any,
    concepts: conceptsOut,
    buit: dades.length === 0 && ajustos.length === 0 && !mirallTeDades,
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
  const [ln, concepts, dades] = await Promise.all([
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
      where: {
        period: periodFilter,
        ...prismaWhereDadaPerLnInforme(liniaNegociId),
      },
      select: DADA_INFORME_SELECT,
    }),
  ]);

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
    const { aplicarBaseGestioPersonalCentres } = await import(
      "@/lib/cost-personal-centre/gestio-consultes"
    );
    const {
      aplicarGestioRepartimentLn,
      carregarDeltasGestioAgregats,
      COL_REPARTIMENT_ID,
      COL_REPARTIMENT_CODI,
      COL_REPARTIMENT_NOM,
    } = await import("@/lib/repartiment/gestio-consultes");

    // Personal = base Gestió (SAP+ajust + traspass); estructura (repartiment) a columna a part.
    const centreIds = centres.map((c) => c.id);
    rows = await aplicarBaseGestioPersonalCentres(any, rang, centreIds, rows);

    const deltaByLnNode = await carregarDeltasGestioAgregats(any, rang);
    const deltaByNode = deltaByLnNode.get(liniaNegociId) ?? new Map<number, number>();
    centresOut = [
      ...centres,
      { id: COL_REPARTIMENT_ID, codi: COL_REPARTIMENT_CODI, nom: COL_REPARTIMENT_NOM },
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

const getConceptsActius = cache(async () => {
  return db.concepteResultat.findMany({
    where: { isActive: true },
    orderBy: { ordre: "asc" },
    select: { id: true, node: true, descripcio: true, esSubtotal: true },
  });
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
async function carregarDadesEmpresa(
  periodFilter: Prisma.PeriodWhereInput,
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
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
  const liniesRawAll = await db.liniaNegoci.findMany({
    where: { isActive: true },
    orderBy: { ordre: "asc" },
    select: { id: true, codi: true, nom: true },
  });
  const liniesRaw = filtraLiniesPerGrup(liniesRawAll, grup);
  const lnIdsGrup = new Set(liniesRaw.map((l) => l.id));
  const lnIds = [...lnIdsGrup];

  const [concepts, dadesRaw, ajustos] = await Promise.all([
    getConceptsActius(),
    db.dadaResultat.findMany({
      where: {
        period: periodFilter,
        ...prismaWhereDadaPerLnInformeIds(lnIds),
      },
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

  const lnIdx = new Map<string, number>();
  liniesRaw.forEach((l, i) => lnIdx.set(l.id, i));

  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) {
    perConcepte.set(c.id, new Array(liniesRaw.length).fill(0));
  }

  // Mateix criteri que getEvolucioMensual(scope=linia): cada dada va a la LN
  // de lnInformePerAgregacio, excloent columnes total-LN redundants.
  const dades: typeof dadesRaw = [];
  for (const d of dadesRaw) {
    if (esColumnaTotalLnRedundant(d)) continue;
    const lnId = lnInformePerAgregacio(d);
    if (!lnId || !lnIdsGrup.has(lnId)) continue;
    dades.push(d);
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

  if (vista === "gestio" && grupPermetVistaGestio(grup)) {
    const { aplicarBaseGestioPersonalLinies } = await import(
      "@/lib/cost-personal-centre/gestio-consultes"
    );
    const { aplicarGestioRepartiment, carregarDeltasGestioAgregats } = await import(
      "@/lib/repartiment/gestio-consultes"
    );

    const lnIds = liniesRaw.map((l) => l.id);
    // Personal = base Gestió (SAP+ajust + traspass). Repartiment només (sense doble traspass).
    conceptRows = await aplicarBaseGestioPersonalLinies(any, rang, lnIds, conceptRows);
    const deltaRepartiment = await carregarDeltasGestioAgregats(any, rang);
    conceptRows = aplicarGestioRepartiment(concepts, conceptRows, lnIds, deltaRepartiment);
  }

  // Consolidat · Gestió: Prestació serveis FDLC → Vendes LN00001 (mirall CCR00008).
  // En Directe es deixa tal com ve de SAP (Prestació a FDLC, sense sumar a Restaurants).
  if (grup === "consolidat" && vista === "gestio") {
    const mirall = await getImportMirallServeisFdlcRang(any, rang);
    conceptRows = aplicarReclassificacioMirallConsolidat(conceptRows, linies, mirall);
  }

  const dadesGrup = dades;
  const ajustosGrup = ajustos.filter((a) => {
    const lnId = a.liniaNegociId ?? a.centre?.liniaNegociId ?? null;
    return lnId !== null && lnIdsGrup.has(lnId);
  });

  // Columnes LN = mateix criteri que Evolució/Per línia (sense consolidar).
  // La consolidació només afecta el total d'empresa (evita doble còmput inter-LN).
  if (grupAplicaConsolidacioIntra(grup)) {
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

    const rows = pivotMensualDesDeMoviments(concepts, [...dades, ...ajustosAll]);
    return {
      scope,
      titol: ln ? etiquetaLiniaNegoci(ln) : "Línia de negoci",
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

/** Dades mensuals per a múltiples anys (per comparar al gràfic). */
export async function getComparativaMensualEntreAnys(
  scope: AmbitTemporal,
  id: string | null,
  anys: number[],
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<ComparativaMensualAnys> {
  const ambit = await resolveAmbitTemporal(scope, id, grup);
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
    perAny[year] = await consolidarSiEmpresaAsync(scope, rows, "temporal", grup);
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
  },
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<ComparativaTemporal> {
  const ambit = await resolveAmbitTemporal(scope, id, grup);
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
      concepts: await consolidarSiEmpresaAsync(scope, rows, "temporal", grup),
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
      concepts: await consolidarSiEmpresaAsync(scope, rows, "temporal", grup),
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
    concepts: await consolidarSiEmpresaAsync(scope, rows, "temporal", grup),
    buit,
    periodeDesc: "Acumulat anual per exercici",
  };
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
  /** Si és gestió, inclou imputacions de repartiment confirmat. */
  vista?: "directe" | "gestio";
  /** Àmbit d'empresa (calblay / fdlc / consolidat). */
  grup?: GrupEmpresa;
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
      totalRepartiment: 0,
      totalMirall: 0,
      totalTraspass: 0,
      totalPayroll: 0,
      payrollSubstitueix: false,
      total: 0,
    };
  }

  const periodWhere: Prisma.PeriodWhereInput = params.mes
    ? { any: params.any, mes: params.mes }
    : params.rang
      ? prismaPeriodFilter(params.any, params.rang)
      : { any: params.any };

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

  let totalRepartiment = 0;
  let totalMirall = 0;

  // Vista Gestió: afegir imputacions de repartiment (totals → línia de detall).
  // No s'apliquen a nivell centre (van a la columna Estructura / total LN).
  if (params.vista === "gestio" && !params.centreId) {
    const { NODE_COST_SALARIAL, nodeTotalDesDeDetall } = await import("@/lib/repartiment/nodes");
    const { getDeltasGestioPerLn } = await import("@/lib/repartiment/service");

    // SOUS (13) hereta el delta del total 17; el propi total 17 també el mostra al detall.
    const nodeDelta =
      nodeTotalDesDeDetall(concepte.node) ??
      (concepte.node === NODE_COST_SALARIAL ? NODE_COST_SALARIAL : null);

    if (nodeDelta != null) {
      const periods = await db.period.findMany({
        where: periodWhere,
        select: { id: true, any: true, mes: true },
        orderBy: { mes: "asc" },
      });
      const deltasPerPeriode = await getDeltasGestioPerLn(periods.map((p) => p.id));

      const lnFilter = params.liniaNegociId ? new Set([params.liniaNegociId]) : lnIdsGrupSet;

      const lnIdsNeeded = new Set<string>();
      for (const perLn of deltasPerPeriode.values()) {
        for (const lnId of perLn.keys()) {
          if (!lnFilter || lnFilter.has(lnId)) lnIdsNeeded.add(lnId);
        }
      }

      const linies =
        lnIdsNeeded.size > 0
          ? await db.liniaNegoci.findMany({
              where: { id: { in: [...lnIdsNeeded] } },
              select: { id: true, codi: true, nom: true },
            })
          : [];
      const lnById = new Map(linies.map((l) => [l.id, l]));

      const normesByKey = new Map<string, string>();
      if (periods.length && lnIdsNeeded.size) {
        const moviments = await db.movimentRepartiment.findMany({
          where: {
            concepteNode: nodeDelta,
            liniaNegociDestiId: { in: [...lnIdsNeeded] },
            execucio: {
              estat: "CONFIRMAT",
              periodId: { in: periods.map((p) => p.id) },
            },
          },
          select: {
            importCalculat: true,
            liniaNegociDestiId: true,
            execucio: { select: { periodId: true } },
            norma: { select: { nom: true } },
          },
        });
        for (const m of moviments) {
          normesByKey.set(
            `${m.execucio.periodId}:${m.liniaNegociDestiId}`,
            m.norma?.nom ?? "ESTRUCTURA"
          );
        }
      }

      for (const period of periods) {
        const perLn = deltasPerPeriode.get(period.id);
        if (!perLn) continue;
        for (const [lnId, nodes] of perLn) {
          if (lnFilter && !lnFilter.has(lnId)) continue;
          const delta = nodes.get(nodeDelta) ?? 0;
          if (delta === 0) continue;
          const ln = lnById.get(lnId);
          totalRepartiment += delta;
          items.push({
            origen: "repartiment",
            import_: delta,
            centreCodi: null,
            centreNom: null,
            liniaCodi: ln?.codi ?? null,
            liniaNom: ln?.nom ?? null,
            mes: period.mes,
            any: period.any,
            motiu: normesByKey.get(`${period.id}:${lnId}`) ?? "ESTRUCTURA",
          });
        }
      }
    }
  }

  // Consolidat · Gestió: Prestació FDLC → Vendes LN00001 (CCR00008) al detall.
  if (params.grup === "consolidat" && params.vista === "gestio" && !params.centreId) {
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

  const totalDades = dades.reduce((s, d) => s + Number(d.import_), 0);
  const totalAjustos = ajustos.reduce((s, a) => s + Number(a.import_), 0);

  let totalTraspass = 0;

  // Vista Gestió: traspassos de personal (node 17 → presentació a Sous i salaris 13).
  if (params.vista === "gestio") {
    const { NODE_COST_SALARIAL, NODE_SOUS_SALARIS, nodeTotalDesDeDetall } = await import(
      "@/lib/repartiment/nodes"
    );
    const nodeDelta =
      concepte.node === NODE_COST_SALARIAL || concepte.node === NODE_SOUS_SALARIS
        ? NODE_COST_SALARIAL
        : nodeTotalDesDeDetall(concepte.node);

    if (nodeDelta === NODE_COST_SALARIAL) {
      const periods = await db.period.findMany({
        where: periodWhere,
        select: { id: true, any: true, mes: true },
        orderBy: { mes: "asc" },
      });
      if (periods.length) {
        const periodIds = periods.map((p) => p.id);
        const periodById = new Map(periods.map((p) => [p.id, p]));

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
                codi: true,
                nom: true,
                liniaNegoci: { select: { codi: true, nom: true } },
              },
            },
            centreDesti: {
              select: {
                codi: true,
                nom: true,
                liniaNegoci: { select: { codi: true, nom: true } },
              },
            },
            execucio: { select: { periodId: true } },
          },
        });

        const centreSet = centreFilter ? new Set(centreFilter) : null;

        for (const m of moviments) {
          const period = periodById.get(m.execucio.periodId);
          if (!period) continue;
          const imp = Number(m.import_);
          const dept = m.departament === "CUINA" ? "Cuina" : "Sala";

          // Origen: surt cost → delta +. Destí: entra cost → delta −.
          if (!centreSet || centreSet.has(m.centreOrigenId)) {
            totalTraspass += imp;
            items.push({
              origen: "traspass",
              import_: imp,
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
            totalTraspass -= imp;
            items.push({
              origen: "traspass",
              import_: -imp,
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
    NODE_TOTAL_COST_SALARIAL,
  } = await import("@/lib/cost-personal-centre/nodes");
  if (
    params.vista === "gestio" &&
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

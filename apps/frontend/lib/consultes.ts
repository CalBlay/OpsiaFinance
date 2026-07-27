import { esSubtotalPresentacio, recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import { aplicarConsolidacio } from "@/lib/consolidacio/service";
import { db } from "@/lib/db";
import { GRUP_EMPRESA_DEFAULT, type GrupEmpresa, filtraLiniesPerGrup } from "@/lib/grups-empresa";
import { lnInformePerAgregacio } from "@/lib/linia-informe";
import { MESOS_CURTS, MESOS_LLARGS } from "@/lib/periodes";
import type { Prisma } from "@prisma/client";

export { MESOS_CURTS, MESOS_LLARGS } from "@/lib/periodes";

async function consolidarSiEmpresaAsync(
  scope: "empresa" | "linia" | "centre",
  concepts: ConceptePivot[],
  mode: "columnes-ln" | "temporal"
): Promise<ConceptePivot[]> {
  if (scope !== "empresa") return concepts;
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
  mes: number | null; // null = acumulat anual
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

/** Línies de negoci amb els seus centres (per als selectors). */
export async function getArbreSeleccio() {
  return db.liniaNegoci.findMany({
    where: { isActive: true },
    orderBy: { ordre: "asc" },
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
  });
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
    const valors = perConcepte.get(c.id)!;
    return {
      node: c.node,
      descripcio: c.descripcio,
      esSubtotal: esSubtotalPresentacio(c.node, c.esSubtotal),
      valors,
      total: valors.reduce((a, b) => a + b, 0),
    };
  });

  let conceptsOut = rows;
  if (vista === "gestio") {
    const { aplicarTraspassPersonalEvolucioCentre } = await import(
      "@/lib/traspass-personal/gestio-consultes"
    );
    conceptsOut = await aplicarTraspassPersonalEvolucioCentre(centreId, any, rows);
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
  mes: number | null,
  vista: VistaCompte = "directe"
): Promise<ComparativaLn> {
  const periodFilter = mes ? { any, mes } : { any };
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

  const dades = dadesAll.filter((d) => lnInformePerAgregacio(d) === liniaNegociId);

  const ajustos = await db.ajust.findMany({
    where: {
      centre: { liniaNegociId },
      period: periodFilter,
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

    const deltaByCentreNode = await carregarDeltasTraspassPersonalPerCentre(any, mes);
    const centreIds = centres.map((c) => c.id);
    rows = aplicarDeltasTraspassPersonalCentres(rows, centreIds, deltaByCentreNode);

    const deltaByLnNode = await carregarDeltasGestioAgregats(any, mes);
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
    mes,
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
  const rows = concepts.map((c) => {
    const valors = perConcepte.get(c.id)!;
    return {
      node: c.node,
      descripcio: c.descripcio,
      esSubtotal: esSubtotalPresentacio(c.node, c.esSubtotal),
      valors,
      total: valors.reduce((a, b) => a + b, 0),
    };
  });
  return recalcularSubtotalsCompte(concepts, rows);
}

/* ─── Consulta: C.Explotació d'empresa (columnes = línies de negoci) ───────────── */

export interface ComparativaEmpresa {
  any: number;
  mes: number | null;
  linies: { id: string; codi: string; nom: string }[];
  concepts: ConceptePivot[];
  buit: boolean;
}

export async function getComparativaEmpresa(
  any: number,
  mes: number | null,
  vista: VistaCompte = "directe",
  grup: GrupEmpresa = GRUP_EMPRESA_DEFAULT
): Promise<ComparativaEmpresa> {
  const periodFilter = mes ? { any, mes } : { any };
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
  const senseCentrePerConcept = new Map<string, number>();
  for (const c of concepts) {
    perConcepte.set(c.id, new Array(liniesRaw.length).fill(0));
    senseCentrePerConcept.set(c.id, 0);
  }

  for (const d of dades) {
    const val = Number(d.import_);
    const lnId = lnInformePerAgregacio(d);
    if (!lnId || !lnIdsGrup.has(lnId)) continue;
    if (d.senseCentre) {
      if (lnId) {
        const col = lnIdx.get(lnId);
        if (col !== undefined) perConcepte.get(d.concepteResultatId)![col] += val;
      } else {
        senseCentrePerConcept.set(
          d.concepteResultatId,
          (senseCentrePerConcept.get(d.concepteResultatId) ?? 0) + val
        );
      }
      continue;
    }
    if (!lnId || !d.centreId) continue;
    const col = lnIdx.get(lnId);
    if (col === undefined) continue;
    perConcepte.get(d.concepteResultatId)![col] += val;
  }

  /** Columnes sense centre (codi desconegut o LN agregat) s'acumulen sempre; no es descarten. */
  for (const d of dades) {
    if (d.senseCentre || d.centreId) continue;
    const lnId = lnInformePerAgregacio(d);
    if (!lnId || !lnIdsGrup.has(lnId)) continue;
    const col = lnIdx.get(lnId);
    if (col === undefined) continue;
    perConcepte.get(d.concepteResultatId)![col] += Number(d.import_);
  }

  for (const a of ajustos) {
    const lnId = a.liniaNegociId ?? a.centre?.liniaNegociId ?? null;
    if (!lnId || !lnIdsGrup.has(lnId)) continue;
    const col = lnIdx.get(lnId);
    if (col === undefined) continue;
    const arr = perConcepte.get(a.concepteResultatId);
    if (arr) arr[col] += Number(a.import_);
  }

  const hasSenseCentre = [...senseCentrePerConcept.values()].some((v) => v !== 0);
  if (hasSenseCentre) {
    for (const c of concepts) {
      perConcepte.get(c.id)!.push(senseCentrePerConcept.get(c.id) ?? 0);
    }
  }

  const linies = hasSenseCentre
    ? [...liniesRaw, { id: "__sense_centre__", codi: "—", nom: "Sin centre" }]
    : liniesRaw;

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
      carregarDeltasGestioAgregats(any, mes),
      carregarDeltasTraspassPersonalPerCentre(any, mes),
    ]);
    const deltaTraspassLn = agregarDeltasTraspassPerLn(deltaTraspassCentre, centreToLn);
    const deltaByLnNode = combinarDeltasLn(deltaRepartiment, deltaTraspassLn);

    const lnIds = liniesRaw.map((l) => l.id);
    conceptRows = aplicarGestioRepartiment(concepts, conceptRows, lnIds, deltaByLnNode);
  }

  const dadesGrup = dades.filter((d) => {
    const lnId = lnInformePerAgregacio(d);
    return lnId !== null && lnIdsGrup.has(lnId);
  });
  const ajustosGrup = ajustos.filter((a) => {
    const lnId = a.liniaNegociId ?? a.centre?.liniaNegociId ?? null;
    return lnId !== null && lnIdsGrup.has(lnId);
  });

  return {
    any,
    mes,
    linies,
    concepts:
      grup === "calblay"
        ? await aplicarConsolidacio(conceptRows, "CALBLAY_INTRA", "columnes-ln")
        : conceptRows,
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
  any: number
): Promise<EvolucioMensual> {
  const concepts = await getConceptsActius();

  let titol = "Empresa (totes les línies)";
  if (scope === "linia" && liniaNegociId) {
    const ln = await db.liniaNegoci.findUnique({
      where: { id: liniaNegociId },
      select: { codi: true, nom: true },
    });
    titol = ln ? `${ln.codi} · ${ln.nom}` : "Línia de negoci";
  }

  const dadesWhere: Prisma.DadaResultatWhereInput =
    scope === "linia" && liniaNegociId
      ? {
          period: { any },
          OR: [
            { importacio: { liniaNegociId } },
            { liniaNegociId, importacio: { liniaNegociId: null } },
          ],
        }
      : { period: { any }, liniaNegociId: { not: null } };

  const ajustWhere =
    scope === "linia" && liniaNegociId
      ? { period: { any }, OR: [{ liniaNegociId }, { centre: { liniaNegociId } }] }
      : { period: { any } };

  const [dades, ajustos] = await Promise.all([
    db.dadaResultat.findMany({
      where: dadesWhere,
      select: { import_: true, period: { select: { mes: true } }, concepteResultatId: true },
    }),
    db.ajust.findMany({
      where: ajustWhere,
      select: { import_: true, period: { select: { mes: true } }, concepteResultatId: true },
    }),
  ]);

  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) perConcepte.set(c.id, new Array(12).fill(0));

  for (const d of [...dades, ...ajustos]) {
    const arr = perConcepte.get(d.concepteResultatId);
    if (!arr) continue;
    const idx = d.period.mes - 1;
    if (idx >= 0 && idx < 12) arr[idx] += Number(d.import_);
  }

  const rows = buildRows(concepts, perConcepte);
  const conceptRows =
    scope === "empresa" ? await consolidarSiEmpresaAsync(scope, rows, "temporal") : rows;
  return {
    scope,
    titol,
    any,
    concepts: conceptRows,
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

async function resolveAmbitTemporal(scope: AmbitTemporal, id: string | null) {
  let titol = "Empresa (totes les línies)";
  let dadesWhere: Prisma.DadaResultatWhereInput = { liniaNegociId: { not: null } };
  let ajustWhere: Prisma.AjustWhereInput = {};

  if (scope === "linia" && id) {
    const ln = await db.liniaNegoci.findUnique({
      where: { id },
      select: { codi: true, nom: true },
    });
    titol = ln ? `${ln.codi} · ${ln.nom}` : "Línia de negoci";
    dadesWhere = {
      OR: [
        { importacio: { liniaNegociId: id } },
        { liniaNegociId: id, importacio: { liniaNegociId: null } },
      ],
    };
    ajustWhere = { OR: [{ liniaNegociId: id }, { centre: { liniaNegociId: id } }] };
  } else if (scope === "centre" && id) {
    const c = await db.centre.findUnique({ where: { id }, select: { codi: true, nom: true } });
    titol = c ? `${c.codi} · ${c.nom}` : "Centre";
    dadesWhere = { centreId: id };
    ajustWhere = { centreId: id };
  }

  return { titol, dadesWhere, ajustWhere };
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
  const concepts = await getConceptsActius();
  const { titol, dadesWhere, ajustWhere } = await resolveAmbitTemporal(scope, id);
  const anysOrdenats = [...anys].sort((a, b) => a - b);

  const [dades, ajustos] = await Promise.all([
    db.dadaResultat.findMany({
      where: { AND: [dadesWhere, { period: { any: { in: anysOrdenats } } }] },
      select: {
        import_: true,
        period: { select: { any: true, mes: true } },
        concepteResultatId: true,
      },
    }),
    db.ajust.findMany({
      where: { AND: [ajustWhere, { period: { any: { in: anysOrdenats } } }] },
      select: {
        import_: true,
        period: { select: { any: true, mes: true } },
        concepteResultatId: true,
      },
    }),
  ]);

  const perAnyConcepte = new Map<number, Map<string, number[]>>();
  for (const year of anysOrdenats) {
    const m = new Map<string, number[]>();
    for (const c of concepts) m.set(c.id, new Array(12).fill(0));
    perAnyConcepte.set(year, m);
  }

  for (const d of [...dades, ...ajustos]) {
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
    const rows = buildRows(concepts, perAnyConcepte.get(year)!);
    perAny[year] = await consolidarSiEmpresaAsync(scope, rows, "temporal");
    if (perAny[year].some((r) => r.total !== 0)) anysAmbDades.push(year);
  }

  const anysFinals = anysAmbDades.length ? anysAmbDades : anysOrdenats;

  return {
    scope,
    titol,
    anys: anysFinals,
    perAny,
    buit: dades.length === 0 && ajustos.length === 0,
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
  const concepts = await getConceptsActius();
  const { titol, dadesWhere, ajustWhere } = await resolveAmbitTemporal(scope, id);
  const { granularitat, anys, any, mes } = opts;

  // ─── Mensual: 12 columnes = mesos d'un any concret ───────────────────────────
  if (granularitat === "mensual" && any) {
    const [dades, ajustos] = await Promise.all([
      db.dadaResultat.findMany({
        where: { AND: [dadesWhere, { period: { any } }] },
        select: { import_: true, period: { select: { mes: true } }, concepteResultatId: true },
      }),
      db.ajust.findMany({
        where: { AND: [ajustWhere, { period: { any } }] },
        select: { import_: true, period: { select: { mes: true } }, concepteResultatId: true },
      }),
    ]);

    const perConcepte = new Map<string, number[]>();
    for (const c of concepts) perConcepte.set(c.id, new Array(12).fill(0));

    for (const d of [...dades, ...ajustos]) {
      const arr = perConcepte.get(d.concepteResultatId);
      if (!arr) continue;
      const idx = d.period.mes - 1;
      if (idx >= 0 && idx < 12) arr[idx] += Number(d.import_);
    }

    const columnes = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
    const rows = buildRows(concepts, perConcepte);
    return {
      scope,
      titol,
      granularitat,
      columnes,
      concepts: await consolidarSiEmpresaAsync(scope, rows, "temporal"),
      buit: dades.length === 0 && ajustos.length === 0,
      periodeDesc: `Mes a mes · ${any}`,
    };
  }

  // ─── Mes concret: columnes = anys, només dades d'un mes ──────────────────────
  if (granularitat === "mes" && mes) {
    const anysOrdenats = [...anys].sort((a, b) => a - b);
    const anyIdx = new Map<number, number>();
    anysOrdenats.forEach((y, i) => anyIdx.set(y, i));

    const [dades, ajustos] = await Promise.all([
      db.dadaResultat.findMany({
        where: { AND: [dadesWhere, { period: { any: { in: anysOrdenats }, mes } }] },
        select: { import_: true, period: { select: { any: true } }, concepteResultatId: true },
      }),
      db.ajust.findMany({
        where: { AND: [ajustWhere, { period: { any: { in: anysOrdenats }, mes } }] },
        select: { import_: true, period: { select: { any: true } }, concepteResultatId: true },
      }),
    ]);

    const perConcepte = new Map<string, number[]>();
    for (const c of concepts) perConcepte.set(c.id, new Array(anysOrdenats.length).fill(0));

    for (const d of [...dades, ...ajustos]) {
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
      buit: dades.length === 0 && ajustos.length === 0,
      periodeDesc: `${MESOS_LLARGS[mes - 1]} · comparació entre anys`,
    };
  }

  // ─── Anual (per defecte): columnes = anys acumulats ────────────────────────
  const anysOrdenats = [...anys].sort((a, b) => a - b);
  const anyIdx = new Map<number, number>();
  anysOrdenats.forEach((y, i) => anyIdx.set(y, i));

  const [dades, ajustos] = await Promise.all([
    db.dadaResultat.findMany({
      where: { AND: [dadesWhere, { period: { any: { in: anysOrdenats } } }] },
      select: { import_: true, period: { select: { any: true } }, concepteResultatId: true },
    }),
    db.ajust.findMany({
      where: { AND: [ajustWhere, { period: { any: { in: anysOrdenats } } }] },
      select: { import_: true, period: { select: { any: true } }, concepteResultatId: true },
    }),
  ]);

  const perConcepte = new Map<string, number[]>();
  for (const c of concepts) perConcepte.set(c.id, new Array(anysOrdenats.length).fill(0));

  for (const d of [...dades, ...ajustos]) {
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
    buit: dades.length === 0 && ajustos.length === 0,
    periodeDesc: "Acumulat anual per exercici",
  };
}

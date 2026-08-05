import { db } from "@/lib/db";
import { lnInformePerAgregacio } from "@/lib/linia-informe";
import { NODE_COST_SALARIAL, NODE_INGRESSOS } from "@/lib/repartiment/nodes";

const DADA_SELECT = {
  import_: true,
  liniaNegociId: true,
  centreId: true,
  senseCentre: true,
  concepteResultatId: true,
  importacio: { select: { liniaNegociId: true } },
  concepteResultat: { select: { node: true } },
} as const;

type DirectePerLn = Map<string, Map<number, number>>;

function emptyDirecte(): DirectePerLn {
  return new Map();
}

function acumularDada(
  perLn: DirectePerLn,
  d: {
    import_: unknown;
    liniaNegociId: string | null;
    centreId: string | null;
    senseCentre: boolean;
    importacio: { liniaNegociId: string | null };
    concepteResultat: { node: number };
  }
) {
  const lnId = lnInformePerAgregacio(d);
  if (!lnId) return;
  const node = d.concepteResultat.node;
  let m = perLn.get(lnId);
  if (!m) {
    m = new Map();
    perLn.set(lnId, m);
  }
  m.set(node, (m.get(node) ?? 0) + Number(d.import_));
}

function aplicarTraspass(
  perLn: DirectePerLn,
  moviments: {
    import_: unknown;
    centreOrigen: { liniaNegociId: string } | null;
    centreDesti: { liniaNegociId: string } | null;
  }[]
) {
  for (const m of moviments) {
    const imp = Number(m.import_);
    const origenLnId = m.centreOrigen?.liniaNegociId;
    const destiLnId = m.centreDesti?.liniaNegociId;
    if (!origenLnId || !destiLnId) continue;

    let origen = perLn.get(origenLnId);
    if (!origen) {
      origen = new Map();
      perLn.set(origenLnId, origen);
    }
    let desti = perLn.get(destiLnId);
    if (!desti) {
      desti = new Map();
      perLn.set(destiLnId, desti);
    }

    origen.set(NODE_COST_SALARIAL, (origen.get(NODE_COST_SALARIAL) ?? 0) + imp);
    desti.set(NODE_COST_SALARIAL, (desti.get(NODE_COST_SALARIAL) ?? 0) - imp);
  }
}

/** Valors directes SAP per LN i node (un sol mes). */
export async function getDirectePerLnNode(periodId: string): Promise<DirectePerLn> {
  const map = await getDirectePerLnNodeMany([periodId]);
  return map.get(periodId) ?? emptyDirecte();
}

/**
 * Mateix resultat que N crides a getDirectePerLnNode, amb 2 queries
 * (dades + traspassos) en lloc de 2N.
 */
export async function getDirectePerLnNodeMany(
  periodIds: string[]
): Promise<Map<string, DirectePerLn>> {
  const result = new Map<string, DirectePerLn>();
  for (const id of periodIds) result.set(id, emptyDirecte());
  if (!periodIds.length) return result;

  const [dades, execucionsTraspass] = await Promise.all([
    db.dadaResultat.findMany({
      where: { periodId: { in: periodIds } },
      select: { ...DADA_SELECT, periodId: true },
    }),
    db.execucioTraspassPersonal.findMany({
      where: { estat: "CONFIRMAT", periodId: { in: periodIds } },
      select: {
        periodId: true,
        moviments: {
          select: {
            import_: true,
            centreOrigen: { select: { liniaNegociId: true } },
            centreDesti: { select: { liniaNegociId: true } },
          },
        },
      },
    }),
  ]);

  for (const d of dades) {
    const perLn = result.get(d.periodId);
    if (!perLn) continue;
    acumularDada(perLn, d);
  }

  for (const ex of execucionsTraspass) {
    const perLn = result.get(ex.periodId);
    if (!perLn) continue;
    aplicarTraspass(perLn, ex.moviments);
  }

  return result;
}

/** Vendes base per LN (TOTAL INGRESSOS EXPLOTACIO). */
export function vendesLn(directe: DirectePerLn, lnId: string): number {
  return directe.get(lnId)?.get(NODE_INGRESSOS) ?? 0;
}

export interface PesGrupCalculat {
  grupId: string;
  liniaNegociId: string;
  vendesBase: number;
  pesCalculat: number;
}

export type GrupAmbMembres = {
  id: string;
  membres: { liniaNegociId: string }[];
};

/** Pesos a partir de directe ja carregat (sense DB). */
export function calcularPesosGrupsFromDirecte(
  directe: DirectePerLn,
  grups: GrupAmbMembres[]
): PesGrupCalculat[] {
  const result: PesGrupCalculat[] = [];
  for (const g of grups) {
    const vendesMembres = g.membres.map((m) => ({
      lnId: m.liniaNegociId,
      v: Math.max(0, vendesLn(directe, m.liniaNegociId)),
    }));
    const total = vendesMembres.reduce((a, x) => a + x.v, 0);
    for (const { lnId, v } of vendesMembres) {
      result.push({
        grupId: g.id,
        liniaNegociId: lnId,
        vendesBase: v,
        pesCalculat: total > 0 ? v / total : 0,
      });
    }
  }
  return result;
}

/** Calcula pesos de vendes per grup (suma vendes membres → fracció). */
export async function calcularPesosGrups(
  periodId: string,
  directePreload?: DirectePerLn
): Promise<PesGrupCalculat[]> {
  const [directe, grups] = await Promise.all([
    directePreload ? Promise.resolve(directePreload) : getDirectePerLnNode(periodId),
    db.repartimentGrup.findMany({
      where: { isActive: true },
      include: {
        membres: { orderBy: { ordre: "asc" } },
      },
    }),
  ]);

  return calcularPesosGrupsFromDirecte(directe, grups);
}

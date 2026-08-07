import {
  type ImportsPersonalGestio,
  carregarBaseGestioPersonal,
} from "@/lib/cost-personal-centre/base-gestio";
import {
  NODE_ALTRES_DESPESES_SOCIALS,
  NODE_INDEMNITZACIONS,
  NODE_SEGURETAT_SOCIAL,
  NODE_SOUS_SALARIS,
  NODE_TOTAL_COST_SALARIAL,
  esNodePersonalCompte,
} from "@/lib/cost-personal-centre/nodes";
import { db } from "@/lib/db";
import { lnInformePerAgregacio } from "@/lib/linia-informe";
import { NODE_INGRESSOS } from "@/lib/repartiment/nodes";

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
  const node = d.concepteResultat.node;
  // Personal amb centre → base Gestió (SAP+ajust + traspass). Sense centre es manté SAP.
  if (esNodePersonalCompte(node) && d.centreId) return;

  const lnId = lnInformePerAgregacio(d);
  if (!lnId) return;
  let m = perLn.get(lnId);
  if (!m) {
    m = new Map();
    perLn.set(lnId, m);
  }
  m.set(node, (m.get(node) ?? 0) + Number(d.import_));
}

function sumarPersonalLn(perLn: DirectePerLn, lnId: string, imp: ImportsPersonalGestio) {
  let m = perLn.get(lnId);
  if (!m) {
    m = new Map();
    perLn.set(lnId, m);
  }
  m.set(NODE_SOUS_SALARIS, (m.get(NODE_SOUS_SALARIS) ?? 0) + imp.importBrut);
  m.set(NODE_INDEMNITZACIONS, (m.get(NODE_INDEMNITZACIONS) ?? 0) + imp.indemnitzacions);
  m.set(NODE_SEGURETAT_SOCIAL, (m.get(NODE_SEGURETAT_SOCIAL) ?? 0) + imp.totalSegSocial);
  m.set(
    NODE_ALTRES_DESPESES_SOCIALS,
    (m.get(NODE_ALTRES_DESPESES_SOCIALS) ?? 0) + imp.altresDespesesSocials
  );
  m.set(NODE_TOTAL_COST_SALARIAL, (m.get(NODE_TOTAL_COST_SALARIAL) ?? 0) + imp.costPersonal);
}

/**
 * Injeta personal de la base Gestió (SAP+ajust → traspass) agregat per LN del centre.
 */
async function aplicarPersonalGestioADirecte(
  result: Map<string, DirectePerLn>,
  periodIds: string[]
): Promise<void> {
  if (!periodIds.length) return;

  const periods = await db.period.findMany({
    where: { id: { in: periodIds } },
    select: { id: true, any: true, mes: true },
  });
  if (!periods.length) return;

  const byAny = new Map<number, typeof periods>();
  for (const p of periods) {
    let list = byAny.get(p.any);
    if (!list) {
      list = [];
      byAny.set(p.any, list);
    }
    list.push(p);
  }

  const centres = await db.centre.findMany({
    where: { isActive: true },
    select: { id: true, liniaNegociId: true },
  });
  const centreToLn = new Map(centres.map((c) => [c.id, c.liniaNegociId]));

  for (const [any, periodsAny] of byAny) {
    const base = await carregarBaseGestioPersonal({ any });
    for (const period of periodsAny) {
      const perLn = result.get(period.id);
      if (!perLn) continue;
      for (const [centreId, perMes] of base) {
        const cel = perMes.get(period.mes);
        if (!cel) continue;
        const lnId = centreToLn.get(centreId);
        if (!lnId) continue;
        sumarPersonalLn(perLn, lnId, cel.imports);
      }
    }
  }
}

/** Valors directes per LN i node (un sol mes). Personal = base Gestió. */
export async function getDirectePerLnNode(periodId: string): Promise<DirectePerLn> {
  const map = await getDirectePerLnNodeMany([periodId]);
  return map.get(periodId) ?? emptyDirecte();
}

/**
 * Mateix resultat que N crides a getDirectePerLnNode, en batch.
 * Non-personal: SAP(+ajust implícit a dades). Personal centre: base Gestió.
 */
export async function getDirectePerLnNodeMany(
  periodIds: string[]
): Promise<Map<string, DirectePerLn>> {
  const result = new Map<string, DirectePerLn>();
  for (const id of periodIds) result.set(id, emptyDirecte());
  if (!periodIds.length) return result;

  const dades = await db.dadaResultat.findMany({
    where: { periodId: { in: periodIds } },
    select: { ...DADA_SELECT, periodId: true },
  });

  for (const d of dades) {
    const perLn = result.get(d.periodId);
    if (!perLn) continue;
    acumularDada(perLn, d);
  }

  await aplicarPersonalGestioADirecte(result, periodIds);

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

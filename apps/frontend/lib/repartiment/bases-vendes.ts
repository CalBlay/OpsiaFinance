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

/** Valors directes SAP per LN i node (un sol mes). */
export async function getDirectePerLnNode(
  periodId: string
): Promise<Map<string, Map<number, number>>> {
  const dades = await db.dadaResultat.findMany({
    where: { periodId },
    select: DADA_SELECT,
  });

  const perLn = new Map<string, Map<number, number>>();
  for (const d of dades) {
    const lnId = lnInformePerAgregacio(d);
    if (!lnId) continue;
    const node = d.concepteResultat.node;
    if (!perLn.has(lnId)) perLn.set(lnId, new Map());
    const m = perLn.get(lnId)!;
    m.set(node, (m.get(node) ?? 0) + Number(d.import_));
  }

  // Ajusta el node de personal (node 17) amb els traspassos confirmats d'hores.
  // Això és necessari perquè el repartiment Central → LN no faci doble comptatge.
  const execucionsTraspass = await db.execucioTraspassPersonal.findMany({
    where: { estat: "CONFIRMAT", periodId },
    select: {
      moviments: {
        select: {
          import_: true,
          centreOrigen: { select: { liniaNegociId: true } },
          centreDesti: { select: { liniaNegociId: true } },
        },
      },
    },
  });

  for (const ex of execucionsTraspass) {
    for (const m of ex.moviments) {
      const imp = Number(m.import_);
      const origenLnId = m.centreOrigen?.liniaNegociId;
      const destiLnId = m.centreDesti?.liniaNegociId;
      if (!origenLnId || !destiLnId) continue;

      if (!perLn.has(origenLnId)) perLn.set(origenLnId, new Map());
      if (!perLn.has(destiLnId)) perLn.set(destiLnId, new Map());

      perLn
        .get(origenLnId)!
        .set(NODE_COST_SALARIAL, (perLn.get(origenLnId)!.get(NODE_COST_SALARIAL) ?? 0) + imp);
      perLn
        .get(destiLnId)!
        .set(NODE_COST_SALARIAL, (perLn.get(destiLnId)!.get(NODE_COST_SALARIAL) ?? 0) - imp);
    }
  }

  return perLn;
}

/** Vendes base per LN (TOTAL INGRESSOS EXPLOTACIO). */
export function vendesLn(directe: Map<string, Map<number, number>>, lnId: string): number {
  return directe.get(lnId)?.get(NODE_INGRESSOS) ?? 0;
}

export interface PesGrupCalculat {
  grupId: string;
  liniaNegociId: string;
  vendesBase: number;
  pesCalculat: number;
}

/** Calcula pesos de vendes per grup (suma vendes membres → fracció). */
export async function calcularPesosGrups(periodId: string): Promise<PesGrupCalculat[]> {
  const directe = await getDirectePerLnNode(periodId);
  const grups = await db.repartimentGrup.findMany({
    where: { isActive: true },
    include: {
      membres: { orderBy: { ordre: "asc" } },
    },
  });

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

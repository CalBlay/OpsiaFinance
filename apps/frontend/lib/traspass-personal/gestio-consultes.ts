import { recalcularCompositesOnly } from "@/lib/compte-subtotals";
import type { ConceptePivot } from "@/lib/consultes";
import { type RangMesos, prismaPeriodFilter } from "@/lib/periodes";
import { NODE_COST_SALARIAL } from "@/lib/repartiment/nodes";

/** Acumula delta per centre i node. */
export function aplicarDeltaCentre(
  perCentre: Map<string, Map<number, number>>,
  centreId: string,
  node: number,
  delta: number
): void {
  let nodes = perCentre.get(centreId);
  if (!nodes) {
    nodes = new Map();
    perCentre.set(centreId, nodes);
  }
  nodes.set(node, (nodes.get(node) ?? 0) + delta);
}

/**
 * Carrega deltas de traspassos confirmats: −import a origen, +import a destí.
 * Retorna Map<centreId, Map<node, delta>>.
 */
export async function carregarDeltasTraspassPersonalPerCentre(
  any: number,
  rang: RangMesos
): Promise<Map<string, Map<number, number>>> {
  const { db } = await import("@/lib/db");

  const execucions = await db.execucioTraspassPersonal.findMany({
    where: {
      estat: "CONFIRMAT",
      period: prismaPeriodFilter(any, rang),
    },
    include: {
      moviments: {
        select: {
          centreOrigenId: true,
          centreDestiId: true,
          concepteNode: true,
          import_: true,
        },
      },
    },
  });

  const perCentre = new Map<string, Map<number, number>>();
  for (const ex of execucions) {
    for (const m of ex.moviments) {
      const imp = Number(m.import_);
      // Costos al C.Explotació van en negatiu. El traspass mou cost:
      //   origen: surt cost → cal fer el cost menys negatiu (+import)
      //   destí:  entra cost → cal fer el cost més negatiu (−import)
      const node = NODE_COST_SALARIAL;
      aplicarDeltaCentre(perCentre, m.centreOrigenId, node, imp);
      aplicarDeltaCentre(perCentre, m.centreDestiId, node, -imp);
    }
  }
  return perCentre;
}

/** Aplica deltas de traspass personal a columnes de centres. */
export function aplicarDeltasTraspassPersonalCentres(
  rows: ConceptePivot[],
  centreIds: string[],
  deltaByCentreNode: Map<string, Map<number, number>>
): ConceptePivot[] {
  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));

  for (const row of merged) {
    for (let i = 0; i < centreIds.length; i++) {
      const delta = deltaByCentreNode.get(centreIds[i])?.get(row.node) ?? 0;
      if (delta !== 0) row.valors[i] += delta;
    }
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }

  return recalcularCompositesOnly(merged);
}

/** Agrega deltas per centre → deltas per LN. */
export function agregarDeltasTraspassPerLn(
  deltaByCentreNode: Map<string, Map<number, number>>,
  centreToLn: Map<string, string>
): Map<string, Map<number, number>> {
  const perLn = new Map<string, Map<number, number>>();
  for (const [centreId, nodes] of deltaByCentreNode) {
    const lnId = centreToLn.get(centreId);
    if (!lnId) continue;
    let acc = perLn.get(lnId);
    if (!acc) {
      acc = new Map();
      perLn.set(lnId, acc);
    }
    for (const [node, v] of nodes) {
      acc.set(node, (acc.get(node) ?? 0) + v);
    }
  }
  return perLn;
}

/** Aplica deltas mensuals de traspass personal a la consulta per centre (12 mesos). */
export async function aplicarTraspassPersonalEvolucioCentre(
  centreId: string,
  any: number,
  rows: ConceptePivot[]
): Promise<ConceptePivot[]> {
  const { db } = await import("@/lib/db");

  const periods = await db.period.findMany({
    where: { any },
    select: { id: true, mes: true },
  });
  if (!periods.length) return rows;

  const execucions = await db.execucioTraspassPersonal.findMany({
    where: {
      estat: "CONFIRMAT",
      periodId: { in: periods.map((p) => p.id) },
    },
    include: {
      period: { select: { mes: true } },
      moviments: {
        where: {
          OR: [{ centreOrigenId: centreId }, { centreDestiId: centreId }],
        },
        select: {
          centreOrigenId: true,
          centreDestiId: true,
          concepteNode: true,
          import_: true,
        },
      },
    },
  });

  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  for (const ex of execucions) {
    const mesIdx = ex.period.mes - 1;
    if (mesIdx < 0 || mesIdx > 11) continue;
    for (const m of ex.moviments) {
      const imp = Number(m.import_);
      const node = NODE_COST_SALARIAL;
      for (const row of merged) {
        if (row.node !== node) continue;
        // Mateix criteri de signe (costos negatius al compte).
        if (m.centreOrigenId === centreId) row.valors[mesIdx] += imp;
        if (m.centreDestiId === centreId) row.valors[mesIdx] -= imp;
      }
    }
  }

  for (const row of merged) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }
  return recalcularCompositesOnly(merged);
}

/** Combina deltas de repartiment LN i traspass personal per vista empresa. */
export function combinarDeltasLn(
  repartiment: Map<string, Map<number, number>>,
  traspass: Map<string, Map<number, number>>
): Map<string, Map<number, number>> {
  const merged = new Map<string, Map<number, number>>();
  for (const src of [repartiment, traspass]) {
    for (const [lnId, nodes] of src) {
      let acc = merged.get(lnId);
      if (!acc) {
        acc = new Map();
        merged.set(lnId, acc);
      }
      for (const [node, v] of nodes) {
        acc.set(node, (acc.get(node) ?? 0) + v);
      }
    }
  }
  return merged;
}

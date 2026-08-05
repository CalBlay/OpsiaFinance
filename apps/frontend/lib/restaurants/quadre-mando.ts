import { getComparativaRestaurants } from "@/lib/cost-salarial/consultes";
import { getAnysCostSalarial } from "@/lib/cost-salarial/consultes";
import { db } from "@/lib/db";
import { NODE_COMPRES, NODE_EBITDA, NODE_VENDES } from "@/lib/kpi-definitions";
import { MESOS_LLARGS } from "@/lib/periodes";
import {
  getAnysVendesRestaurants,
  getCentresRestaurantsVendes,
  getComparativaVendes,
} from "@/lib/vendes-restaurants/consultes";

export type SemaforPrime = "verd" | "ambre" | "vermell" | "gris";

export interface FilaQuadreRestaurant {
  centre: { id: string; codi: string; nom: string; etiqueta: string };
  /** Vendes TPV (base) */
  vendesTpv: number | null;
  variacioPct: number | null;
  costLaboral: number | null;
  sala: number | null;
  cuina: number | null;
  pctSala: number | null;
  pctCuina: number | null;
  /** Personal % = cost Excel ÷ TPV */
  laborPct: number | null;
  /** |Compres P&L| */
  foodCost: number | null;
  /** Food % = |compres| ÷ TPV (si hi ha TPV) o ÷ |vendes P&L| */
  foodPct: number | null;
  /** Cost operatiu % = Personal % + Compres % */
  primePct: number | null;
  ebitda: number | null;
  ebitdaPct: number | null;
  vendesPl: number | null;
  gapTpvPl: number | null;
  gapTpvPlPct: number | null;
  semafor: SemaforPrime;
  teDades: boolean;
  comentaris: string[];
}

export interface QuadreMandoRestaurants {
  any: number;
  /** 0 = tot l'any */
  mes: number;
  periode: string;
  files: FilaQuadreRestaurant[];
  totals: Omit<FilaQuadreRestaurant, "centre" | "comentaris" | "teDades"> & {
    centresAmbDades: number;
    centresTotals: number;
  };
  buit: boolean;
}

const PRIME_VERD = 60;
const PRIME_AMBRE = 65;

function pct(part: number, base: number): number | null {
  if (!base) return null;
  return (part / Math.abs(base)) * 100;
}

function semaforDePrime(primePct: number | null, teDades: boolean): SemaforPrime {
  if (!teDades || primePct == null) return "gris";
  if (primePct <= PRIME_VERD) return "verd";
  if (primePct <= PRIME_AMBRE) return "ambre";
  return "vermell";
}

async function getPlNodesPerCentres(
  centreIds: string[],
  any: number,
  mes: number | null,
  nodes: number[]
): Promise<Map<string, Map<number, number>>> {
  const out = new Map<string, Map<number, number>>();
  if (!centreIds.length || !nodes.length) return out;

  const concepts = await db.concepteResultat.findMany({
    where: { node: { in: nodes }, isActive: true },
    select: { id: true, node: true },
  });
  if (!concepts.length) return out;

  const nodeById = new Map(concepts.map((c) => [c.id, c.node]));
  const dades = await db.dadaResultat.findMany({
    where: {
      centreId: { in: centreIds },
      concepteResultatId: { in: concepts.map((c) => c.id) },
      period: mes != null ? { any, mes } : { any },
    },
    select: { centreId: true, concepteResultatId: true, import_: true },
  });

  for (const d of dades) {
    if (!d.centreId) continue;
    const node = nodeById.get(d.concepteResultatId);
    if (node == null) continue;
    let byNode = out.get(d.centreId);
    if (!byNode) {
      byNode = new Map();
      out.set(d.centreId, byNode);
    }
    byNode.set(node, (byNode.get(node) ?? 0) + Number(d.import_));
  }
  return out;
}

function buildComentaris(
  f: Omit<FilaQuadreRestaurant, "comentaris">,
  mitjana: {
    laborPct: number | null;
    foodPct: number | null;
    primePct: number | null;
    pctCuina: number | null;
  }
): string[] {
  const out: string[] = [];
  if (!f.teDades) {
    out.push("Sense dades operatives per aquest període.");
    return out;
  }

  if (f.primePct != null) {
    if (f.primePct > PRIME_AMBRE) {
      out.push(
        `Cost operatiu ${f.primePct.toFixed(1)}% (>${PRIME_AMBRE}%): pressió alta en compres o personal.`
      );
    } else if (f.primePct > PRIME_VERD) {
      out.push(
        `Cost operatiu ${f.primePct.toFixed(1)}% (zona ambre ${PRIME_VERD}–${PRIME_AMBRE}%).`
      );
    } else {
      out.push(`Cost operatiu ${f.primePct.toFixed(1)}% dins objectiu (≤${PRIME_VERD}%).`);
    }
  }

  if (f.laborPct != null && mitjana.laborPct != null) {
    const diff = f.laborPct - mitjana.laborPct;
    if (Math.abs(diff) >= 2) {
      out.push(
        `Personal % ${diff > 0 ? "+" : ""}${diff.toFixed(1)} pp vs mitjana LN (${mitjana.laborPct.toFixed(1)}%).`
      );
    }
  }

  if (f.foodPct != null && mitjana.foodPct != null) {
    const diff = f.foodPct - mitjana.foodPct;
    if (Math.abs(diff) >= 2) {
      out.push(`Cost de compres % ${diff > 0 ? "+" : ""}${diff.toFixed(1)} pp vs mitjana LN.`);
    }
  }

  if (f.pctCuina != null && mitjana.pctCuina != null) {
    const diff = f.pctCuina - mitjana.pctCuina;
    if (Math.abs(diff) >= 8) {
      out.push(
        `Cuina concentra el ${f.pctCuina.toFixed(0)}% del cost de personal (mitjana LN ${mitjana.pctCuina.toFixed(0)}%).`
      );
    }
  }

  if (f.gapTpvPlPct != null && Math.abs(f.gapTpvPlPct) >= 3) {
    out.push(
      `Desviació TPV vs compte ${f.gapTpvPlPct > 0 ? "+" : ""}${f.gapTpvPlPct.toFixed(1)}% → revisar tancament / tall de període.`
    );
  }

  if (f.variacioPct != null && f.variacioPct <= -5) {
    out.push(`Vendes TPV ${f.variacioPct.toFixed(1)}% vs període comparable.`);
  } else if (f.variacioPct != null && f.variacioPct >= 8) {
    out.push(`Vendes TPV fortes: +${f.variacioPct.toFixed(1)}% vs període comparable.`);
  }

  return out;
}

export async function getAnysQuadreRestaurants(): Promise<number[]> {
  const [vendes, cost] = await Promise.all([getAnysVendesRestaurants(), getAnysCostSalarial()]);
  return [...new Set([...vendes, ...cost])].sort((a, b) => b - a);
}

/**
 * Quadre de comandament multi-unit: TPV + cost Excel + P&L (compres/EBITDA).
 * Personal % = cost Excel ÷ vendes TPV (lectura operativa).
 */
export async function getQuadreMandoRestaurants(
  any: number,
  mes: number,
  nomesMirallFdlc = false
): Promise<QuadreMandoRestaurants> {
  const anual = mes <= 0;
  const mesCost = anual ? null : mes;
  const periode = anual ? `Any ${any}` : `${MESOS_LLARGS[mes - 1]} ${any}`;

  const centres = await getCentresRestaurantsVendes(nomesMirallFdlc);
  if (!centres.length) {
    return {
      any,
      mes: anual ? 0 : mes,
      periode,
      files: [],
      totals: emptyTotals(0),
      buit: true,
    };
  }

  const centreIds = centres.map((c) => c.id);

  const [vendes, cost, plMap] = await Promise.all([
    getComparativaVendes(any, anual ? 0 : mes, nomesMirallFdlc),
    getComparativaRestaurants(any, mesCost),
    getPlNodesPerCentres(centreIds, any, mesCost, [NODE_COMPRES, NODE_EBITDA, NODE_VENDES]),
  ]);

  const costById = new Map(cost.files.map((f) => [f.centre.id, f]));
  const vendesById = new Map(vendes.files.map((f) => [f.centre.id, f]));

  const filesRaw: Omit<FilaQuadreRestaurant, "comentaris">[] = centres.map((centre) => {
    const v = vendesById.get(centre.id);
    const c = costById.get(centre.id);
    const pl = plMap.get(centre.id);

    const vendesTpv = v?.teDades ? v.base : null;
    const costLaboral = c ? c.costTotal : null;
    const sala = c ? c.sala : null;
    const cuina = c ? c.cuina : null;
    const foodRaw = pl?.get(NODE_COMPRES) ?? null;
    const foodCost = foodRaw != null ? Math.abs(foodRaw) : null;
    const ebitda = pl?.get(NODE_EBITDA) ?? null;
    const vendesPl = v?.teDades
      ? v.vendesPl
      : pl?.has(NODE_VENDES)
        ? (pl.get(NODE_VENDES) ?? 0)
        : null;

    const laborPct =
      vendesTpv != null && costLaboral != null && vendesTpv !== 0
        ? pct(costLaboral, vendesTpv)
        : null;

    const denomFood =
      vendesTpv && vendesTpv !== 0 ? vendesTpv : vendesPl != null ? Math.abs(vendesPl) : 0;
    const foodPct = foodCost != null && denomFood ? pct(foodCost, denomFood) : null;

    const primePct =
      laborPct != null && foodPct != null
        ? laborPct + foodPct
        : laborPct != null
          ? laborPct
          : foodPct;

    const ebitdaPct =
      ebitda != null && vendesTpv && vendesTpv !== 0
        ? pct(ebitda, vendesTpv)
        : ebitda != null && vendesPl
          ? pct(ebitda, vendesPl)
          : null;

    const gapTpvPl = v?.desviacioPl ?? null;
    const gapTpvPlPct =
      gapTpvPl != null && vendesPl && Math.abs(vendesPl) > 0
        ? (gapTpvPl / Math.abs(vendesPl)) * 100
        : null;

    const teDades = Boolean(v?.teDades || c || (pl && pl.size > 0));

    return {
      centre,
      vendesTpv,
      variacioPct: v?.variacioPct ?? null,
      costLaboral,
      sala,
      cuina,
      pctSala: c?.pctSala ?? null,
      pctCuina: c?.pctCuina ?? null,
      laborPct,
      foodCost,
      foodPct,
      primePct,
      ebitda,
      ebitdaPct,
      vendesPl,
      gapTpvPl,
      gapTpvPlPct,
      semafor: semaforDePrime(primePct, teDades),
      teDades,
    };
  });

  const ambDades = filesRaw.filter((f) => f.teDades);
  const mitjana = {
    laborPct: avg(ambDades.map((f) => f.laborPct)),
    foodPct: avg(ambDades.map((f) => f.foodPct)),
    primePct: avg(ambDades.map((f) => f.primePct)),
    pctCuina: avg(ambDades.map((f) => f.pctCuina)),
  };

  const files: FilaQuadreRestaurant[] = filesRaw
    .map((f) => ({
      ...f,
      comentaris: buildComentaris(f, mitjana),
    }))
    .sort((a, b) => {
      // Primer els que tenen dades; després per prime desc (pitjors primer) o etiqueta
      if (a.teDades !== b.teDades) return a.teDades ? -1 : 1;
      if (a.primePct != null && b.primePct != null) return b.primePct - a.primePct;
      return a.centre.etiqueta.localeCompare(b.centre.etiqueta, "ca", { sensitivity: "base" });
    });

  const sum = (pick: (f: (typeof filesRaw)[0]) => number | null) =>
    filesRaw.reduce((s, f) => s + (pick(f) ?? 0), 0);

  const totVendesTpv = sum((f) => f.vendesTpv);
  const totCost = sum((f) => f.costLaboral);
  const totSala = sum((f) => f.sala);
  const totCuina = sum((f) => f.cuina);
  const totFood = sum((f) => f.foodCost);
  const totEbitda = sum((f) => f.ebitda);
  const totVendesPl = sum((f) => f.vendesPl);

  const totLaborPct = totVendesTpv ? pct(totCost, totVendesTpv) : null;
  const totFoodPct = totVendesTpv
    ? pct(totFood, totVendesTpv)
    : totVendesPl
      ? pct(totFood, totVendesPl)
      : null;
  const totPrime =
    totLaborPct != null && totFoodPct != null
      ? totLaborPct + totFoodPct
      : (totLaborPct ?? totFoodPct);
  const totGap = vendes.totals.desviacioPl;
  const totGapPct = totGap != null && totVendesPl ? (totGap / Math.abs(totVendesPl)) * 100 : null;

  const centresAmbDades = ambDades.length;
  const buit = centresAmbDades === 0;

  return {
    any,
    mes: anual ? 0 : mes,
    periode,
    files,
    totals: {
      vendesTpv: centresAmbDades ? totVendesTpv : null,
      variacioPct: vendes.totals.variacioPct,
      costLaboral: totCost || null,
      sala: totSala || null,
      cuina: totCuina || null,
      pctSala: totCost ? pct(totSala, totCost) : null,
      pctCuina: totCost ? pct(totCuina, totCost) : null,
      laborPct: totLaborPct,
      foodCost: totFood || null,
      foodPct: totFoodPct,
      primePct: totPrime,
      ebitda: totEbitda || null,
      ebitdaPct: totVendesTpv ? pct(totEbitda, totVendesTpv) : null,
      vendesPl: totVendesPl || null,
      gapTpvPl: totGap,
      gapTpvPlPct: totGapPct,
      semafor: semaforDePrime(totPrime, !buit),
      centresAmbDades,
      centresTotals: centres.length,
    },
    buit,
  };
}

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function emptyTotals(nCentres: number): QuadreMandoRestaurants["totals"] {
  return {
    vendesTpv: null,
    variacioPct: null,
    costLaboral: null,
    sala: null,
    cuina: null,
    pctSala: null,
    pctCuina: null,
    laborPct: null,
    foodCost: null,
    foodPct: null,
    primePct: null,
    ebitda: null,
    ebitdaPct: null,
    vendesPl: null,
    gapTpvPl: null,
    gapTpvPlPct: null,
    semafor: "gris",
    centresAmbDades: 0,
    centresTotals: nCentres,
  };
}

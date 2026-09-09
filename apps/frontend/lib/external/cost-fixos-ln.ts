/**
 * Cost salarial total (node 17) per LN — vista SAP del C.explotació.
 * Mateixa font que Consultes → Per línia → vista SAP → KPI PERSONAL (evolució mensual).
 * API M2M per Cal Blay · Cost de serveis.
 */

import { getEvolucioMensual } from "@/lib/consultes";
import { db } from "@/lib/db";
import { assertExternalApiKey } from "@/lib/external/cost-personal-estructura";
import { GRUP_EMPRESA_DEFAULT } from "@/lib/grups-empresa";
import { NODE_COST_SALARIAL } from "@/lib/kpi-definitions";

export { assertExternalApiKey };

export type CostSalarialLnRow = {
  lnCodi: string;
  lnNom: string;
  vista: "sap";
  /** TOTAL COST SALARIAL (node 17) del mes, € positiu de despesa. */
  costSalarial: number;
};

export type CostSalarialLnResponse = {
  year: number;
  month: number;
  vista: "sap";
  node: typeof NODE_COST_SALARIAL;
  lines: CostSalarialLnRow[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function costSalarialForLn(
  ln: { id: string; codi: string; nom: string },
  year: number,
  month: number
): Promise<CostSalarialLnRow> {
  // SAP = sense ajustos (igual que getEvolucioMensualPerVista vista "sap")
  const ev = await getEvolucioMensual("linia", ln.id, year, GRUP_EMPRESA_DEFAULT, {
    inclouAjustos: false,
  });
  const row = ev.concepts.find((c) => c.node === NODE_COST_SALARIAL);
  const importMes = Number(row?.valors?.[month - 1]) || 0;
  // Al compte els costos van en negatiu → despesa positiva
  const costSalarial = round2(Math.abs(importMes));

  return {
    lnCodi: ln.codi,
    lnNom: ln.nom,
    vista: "sap",
    costSalarial,
  };
}

/** Cost salarial SAP per totes les LN actives i un mes. */
export async function buildCostSalarialLn(
  year: number,
  month: number
): Promise<CostSalarialLnResponse> {
  const lns = await db.liniaNegoci.findMany({
    where: { isActive: true },
    orderBy: [{ ordre: "asc" }, { codi: "asc" }],
    select: { id: true, codi: true, nom: true },
  });

  const lines = await Promise.all(lns.map((ln) => costSalarialForLn(ln, year, month)));

  return {
    year,
    month,
    vista: "sap",
    node: NODE_COST_SALARIAL,
    lines,
  };
}

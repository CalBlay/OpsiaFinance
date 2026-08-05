/**
 * Mirall operatiu: serveis restaurant FDLC → C.Explotació del centre CCR00008.
 *
 * El compte 70500002 (SERVEIS RESTAURANT) mapa a FDLC node 3 (Prestació de serveis).
 * A la consulta «per centre» de CCR00008 es mostra com a VENDES (node 2).
 * No es persisteix a DadaResultat de Cal Blay → no afecta totals d'empresa / LN Cal Blay en Directe.
 *
 * Al **Consolidat · Gestió** sí que es reclassifica:
 *   + VENDES LN00001  ·  − PRESTACIÓ DE SERVEIS FDLC
 * així el mateix import no es compta dues vegades i queda a Restaurants.
 * En Directe consolidat es deixa tal com ve de SAP.
 */

import { recalcularSubtotalsCompte } from "@/lib/compte-subtotals";
import type { ConceptePivot } from "@/lib/consultes";
import { db } from "@/lib/db";
import { FDLC_LN_CODI } from "@/lib/fdlc/constants";
import { FDLC_COMPTE_SERVEIS_RESTAURANT, FDLC_NODE_SERVEIS_RESTAURANT } from "@/lib/fdlc/mapeig";
import { NODE_VENDES } from "@/lib/kpi-definitions";
import type { RangMesos } from "@/lib/periodes";

export { FDLC_COMPTE_SERVEIS_RESTAURANT, FDLC_NODE_SERVEIS_RESTAURANT };

/** Centre LN00001 on es reflecteixen els ingressos (Font de la Canya). */
export const CENTRE_CODI_MIRALL_SERVEIS_FDLC = "CCR00008";

/** LN Restaurants on el consolidat imputa les vendes del mirall. */
export const CODI_LN_MIRALL_SERVEIS_FDLC = "LN00001";

export { NODE_VENDES as NODE_DESTI_MIRALL_SERVEIS_FDLC };

export function esCentreMirallServeisFdlc(codi: string): boolean {
  return codi === CENTRE_CODI_MIRALL_SERVEIS_FDLC;
}

/** Imports mensuals (índex 0 = gener) del node origen FDLC per a l'exercici. */
export async function getImportsMirallServeisFdlcPerMes(any: number): Promise<number[]> {
  const valors = new Array(12).fill(0);

  const dades = await db.dadaResultat.findMany({
    where: {
      period: { any },
      senseCentre: true,
      liniaNegoci: { codi: FDLC_LN_CODI },
      concepteResultat: { node: FDLC_NODE_SERVEIS_RESTAURANT },
      importacio: { formatInforme: { tipusInforme: "PYG_FDLC" } },
    },
    select: {
      import_: true,
      period: { select: { mes: true } },
    },
  });

  for (const d of dades) {
    const i = d.period.mes - 1;
    if (i >= 0 && i < 12) valors[i] += Number(d.import_);
  }

  return valors;
}

/** Suma del mirall per al rang de mesos (consulta consolidat). */
export async function getImportMirallServeisFdlcRang(
  any: number,
  rang: RangMesos
): Promise<number> {
  const mesos = await getImportsMirallServeisFdlcPerMes(any);
  let suma = 0;
  for (let m = rang.des; m <= rang.fins; m++) {
    suma += mesos[m - 1] ?? 0;
  }
  return Math.round(suma * 100) / 100;
}

/**
 * Consolidat · Gestió: mou Prestació de serveis FDLC → Vendes LN00001 (Restaurants).
 * El total d'empresa no canvia (zero-sum entre columnes); només canvia l'atribució.
 */
export function aplicarReclassificacioMirallConsolidat(
  rows: ConceptePivot[],
  linies: { id: string; codi: string }[],
  importMirall: number
): ConceptePivot[] {
  if (importMirall === 0 || !rows.length) return rows;

  const idxRest = linies.findIndex((l) => l.codi === CODI_LN_MIRALL_SERVEIS_FDLC);
  const idxFdlc = linies.findIndex((l) => l.codi === FDLC_LN_CODI);
  if (idxRest < 0 || idxFdlc < 0) return rows;

  const merged = rows.map((r) => ({ ...r, valors: [...r.valors] }));
  const byNode = new Map(merged.map((r) => [r.node, r]));

  const vendes = byNode.get(NODE_VENDES);
  const prestacio = byNode.get(FDLC_NODE_SERVEIS_RESTAURANT);

  if (vendes && idxRest < vendes.valors.length) {
    vendes.valors[idxRest] = (vendes.valors[idxRest] ?? 0) + importMirall;
  }
  if (prestacio && idxFdlc < prestacio.valors.length) {
    prestacio.valors[idxFdlc] = (prestacio.valors[idxFdlc] ?? 0) - importMirall;
  }

  for (const row of merged) {
    row.total = row.valors.reduce((a, b) => a + b, 0);
  }

  return recalcularSubtotalsCompte(
    merged.map((r) => ({ node: r.node, esSubtotal: r.esSubtotal })),
    merged
  );
}

"use server";

import type { PivotColumn } from "@/components/consultes/PivotTable";
import {
  filtraConceptesPerMesos,
  inferDefaultMesos,
  parseMesosParam,
} from "@/lib/comparativa-utils";
import {
  type AmbitTemporal,
  type ConceptePivot,
  type GranularitatTemporal,
  MAX_ANYS_COMPARATIVA,
  MESOS_CURTS,
  getAnysAmbDades,
  getComparativaMensualEntreAnys,
  getComparativaTemporal,
} from "@/lib/consultes";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { NODE_VENDES } from "@/lib/kpi-definitions";
import type { VistaCompte } from "@/lib/vista-compte";

export type ComparativaPivotParams = {
  scope: AmbitTemporal;
  id: string | null;
  granularitat: GranularitatTemporal;
  mes: number;
  mesosRaw: string | null;
  vista: VistaCompte;
  grup: GrupEmpresa;
};

export type ComparativaPivotPayload = {
  columns: PivotColumn[];
  rows: ConceptePivot[];
  showTotal: boolean;
  totalLabel: string;
};

/** Pivot de comparativa només quan s'obre el compte o s'exporta. */
export async function carregarComparativaPivotAction(
  params: ComparativaPivotParams
): Promise<ComparativaPivotPayload> {
  const anysTots = await getAnysAmbDades();
  const anys = anysTots.slice(0, MAX_ANYS_COMPARATIVA);
  if (!anys.length || ((params.scope === "linia" || params.scope === "centre") && !params.id)) {
    return { columns: [], rows: [], showTotal: false, totalLabel: "Període" };
  }

  if (params.granularitat === "mensual") {
    const compMensual = await getComparativaMensualEntreAnys(
      params.scope,
      params.id,
      anys,
      params.grup,
      params.vista
    );
    const anysComparats = compMensual.anys;
    const anyTaula = anysComparats[anysComparats.length - 1];
    const parsed = parseMesosParam(params.mesosRaw ?? undefined);
    const mesosSeleccionats =
      parsed ?? inferDefaultMesos(compMensual.perAny[anyTaula], NODE_VENDES);
    const conceptsTaula = anyTaula
      ? filtraConceptesPerMesos(compMensual.perAny[anyTaula] ?? [], mesosSeleccionats)
      : [];
    return {
      columns: mesosSeleccionats.map((m) => ({ key: String(m), label: MESOS_CURTS[m - 1] })),
      rows: conceptsTaula,
      showTotal: true,
      totalLabel: "Període",
    };
  }

  const comp = await getComparativaTemporal(
    params.scope,
    params.id,
    {
      granularitat: params.granularitat,
      anys,
      mes: params.granularitat === "mes" ? params.mes : undefined,
    },
    params.grup,
    params.vista
  );

  return {
    columns: comp.columnes,
    rows: comp.concepts,
    showTotal: false,
    totalLabel: "Període",
  };
}

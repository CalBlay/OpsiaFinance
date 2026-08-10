"use server";

import type { PivotColumn, PivotRow } from "@/components/consultes/PivotTable";
import type { VistaCompte } from "@/lib/consultes";
import { getArbreSeleccio } from "@/lib/consultes";
import {
  getInformeCostPersonalCentres,
  getInformeCostPersonalDepartaments,
  getInformeCostPersonalLinies,
} from "@/lib/cost-personal-centre/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";

export type CostPersonalPivotParams = {
  any: number;
  mes: number | null;
  lnId: string | null;
  centreId: string | null;
  vista: VistaCompte;
};

export type CostPersonalPivotPayload = {
  columns: PivotColumn[];
  rows: PivotRow[];
  colMap: Record<
    string,
    { mes?: number; centreId?: string; liniaNegociId?: string; departament?: string }
  >;
};

/** Detall del compte de cost de personal en diferit. */
export async function carregarCostPersonalPivotAction(
  params: CostPersonalPivotParams
): Promise<CostPersonalPivotPayload> {
  const [arbreRaw, grup] = await Promise.all([getArbreSeleccio(), getGrupEmpresaActual()]);
  const lnIds = liniesPerConsultaDetall(arbreRaw, grup).map((l) => l.id);

  const informe = params.centreId
    ? await getInformeCostPersonalDepartaments(
        params.centreId,
        params.any,
        params.mes,
        params.vista,
        { lnIds }
      )
    : params.lnId
      ? await getInformeCostPersonalCentres(params.lnId, params.any, params.mes, params.vista, {
          lnIds,
        })
      : await getInformeCostPersonalLinies(params.any, params.mes, params.vista, { lnIds });

  return {
    columns: informe.columns,
    rows: informe.rows,
    colMap: informe.colMap,
  };
}

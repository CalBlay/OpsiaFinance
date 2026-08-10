"use client";

import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import type { VistaCompte } from "@/lib/vista-compte";
import { useCallback, useRef, useState } from "react";
import {
  type CostPersonalPivotParams,
  type CostPersonalPivotPayload,
  carregarCostPersonalPivotAction,
} from "./actions";

export function CostPersonalDetallLazy({
  params,
  vista,
  grup,
}: {
  params: CostPersonalPivotParams;
  vista: VistaCompte;
  grup: GrupEmpresa;
}) {
  const [payload, setPayload] = useState<CostPersonalPivotPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const ensure = useCallback(async () => {
    if (payloadRef.current) return;
    setLoading(true);
    try {
      setPayload(await carregarCostPersonalPivotAction(params));
    } finally {
      setLoading(false);
    }
  }, [params]);

  return (
    <DetallCompteCollapsible
      defaultOpen={false}
      title="Detall del compte"
      onFirstOpen={ensure}
      loading={loading && !payload}
    >
      {payload ? (
        <PivotTableDrilldown
          columns={payload.columns}
          rows={payload.rows}
          totalLabel="Total"
          firstColLabel="Concepte"
          canEdit={false}
          drilldown={{
            any: params.any,
            vista,
            grup,
            colMap: Object.fromEntries(
              Object.entries(payload.colMap).map(([k, v]) => [
                k,
                {
                  mes: v.mes,
                  centreId: v.centreId,
                  liniaNegociId: v.liniaNegociId,
                },
              ])
            ),
          }}
        />
      ) : null}
    </DetallCompteCollapsible>
  );
}

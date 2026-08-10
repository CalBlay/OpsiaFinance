"use client";

import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { PivotTable } from "@/components/consultes/PivotTable";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ComparativaPivotParams,
  type ComparativaPivotPayload,
  carregarComparativaPivotAction,
} from "./actions";

type Ctx = {
  ensure: () => Promise<ComparativaPivotPayload>;
  payload: ComparativaPivotPayload | null;
  loading: boolean;
};

const ComparativaPivotCtx = createContext<Ctx | null>(null);

export function ComparativaPivotProvider({
  params,
  children,
}: {
  params: ComparativaPivotParams;
  children: ReactNode;
}) {
  const [payload, setPayload] = useState<ComparativaPivotPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const ensure = useCallback(async () => {
    if (payloadRef.current) return payloadRef.current;
    setLoading(true);
    try {
      const next = await carregarComparativaPivotAction(params);
      setPayload(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [params]);

  const value = useMemo(() => ({ ensure, payload, loading }), [ensure, payload, loading]);

  return <ComparativaPivotCtx.Provider value={value}>{children}</ComparativaPivotCtx.Provider>;
}

function useComparativaPivot() {
  const ctx = useContext(ComparativaPivotCtx);
  if (!ctx) throw new Error("ComparativaPivotProvider required");
  return ctx;
}

export function ComparativaExportLazy({
  filename,
  title,
  subtitle,
  disabled,
}: {
  filename: string;
  title: string;
  subtitle?: string;
  disabled: boolean;
}) {
  const { ensure, payload, loading } = useComparativaPivot();
  return (
    <span onPointerEnter={() => void ensure()}>
      <ExportInformeButton
        disabled={disabled || (!payload?.rows.length && loading)}
        filename={filename}
        title={title}
        subtitle={subtitle}
        columns={payload?.columns ?? []}
        rows={payload?.rows ?? []}
        showTotal={payload?.showTotal ?? false}
        totalLabel={payload?.totalLabel ?? "Període"}
        sheetName="Comparativa"
      />
    </span>
  );
}

export function ComparativaDetallLazy({
  title = "Obrir compte d'explotació detallat",
}: {
  title?: string;
}) {
  const { ensure, payload, loading } = useComparativaPivot();
  return (
    <DetallCompteCollapsible title={title} onFirstOpen={ensure} loading={loading && !payload}>
      {payload ? (
        <PivotTable
          columns={payload.columns}
          rows={payload.rows}
          showTotal={payload.showTotal}
          totalLabel={payload.totalLabel}
          firstColLabel="Concepte"
        />
      ) : null}
    </DetallCompteCollapsible>
  );
}

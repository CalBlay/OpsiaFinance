"use client";

import type { DetallCellaParams } from "@/lib/consultes";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { useCallback, useRef, useState } from "react";
import { fetchDetallCellaAction } from "../../app/(app)/consultes/actions";
import { type DetallCellaContext, DetallCellaModal } from "./DetallCellaModal";
import {
  type PivotCellClickHandler,
  type PivotCellPointerDownHandler,
  type PivotColumn,
  type PivotEditConfig,
  type PivotRow,
  PivotTable,
} from "./PivotTable";
import {
  detallCellaCacheKey,
  getDetallCellaCached,
  loadDetallCellaCached,
} from "./detall-cella-client-cache";

/** Mapatge serialitzable: per a cada colKey, quins filtres s'apliquen al drill-down. */
export type DrilldownColumnMap = {
  [colKey: string]: {
    mes?: number;
    rang?: { des: number; fins: number };
    centreId?: string;
    liniaNegociId?: string;
  };
};

export interface DrilldownConfig {
  any: number;
  colMap: DrilldownColumnMap;
  /** Llista d'IDs de LN del grup (Cal Blay o FDLC). Exclou LN d'altres grups al drill-down. */
  lnIdsGrup?: string[];
  vista?: import("@/lib/vista-compte").VistaCompte;
  /** Àmbit d'empresa (calblay / fdlc / consolidat). */
  grup?: GrupEmpresa;
}

function buildDetallParams(
  info: Parameters<PivotCellClickHandler>[0],
  drilldown: DrilldownConfig
): DetallCellaParams | null {
  const colParams = drilldown.colMap[info.colKey];
  if (!colParams) return null;
  return {
    concepteResultatId: info.concepteId,
    any: drilldown.any,
    mes: colParams.mes,
    rang: colParams.rang,
    centreId: colParams.centreId,
    liniaNegociId: colParams.liniaNegociId,
    lnIdsGrup: drilldown.lnIdsGrup,
    vista: drilldown.vista,
    grup: drilldown.grup,
  };
}

function buildModalContext(
  info: Parameters<PivotCellClickHandler>[0],
  drilldown: DrilldownConfig
): DetallCellaContext | null {
  const colParams = drilldown.colMap[info.colKey];
  if (!colParams) return null;
  return {
    concepteId: info.concepteId,
    concepteNom: info.concepteNom,
    any: drilldown.any,
    mes: colParams.mes,
    rang: colParams.rang,
    centreId: colParams.centreId,
    liniaNegociId: colParams.liniaNegociId,
    lnIdsGrup: drilldown.lnIdsGrup,
    vista: drilldown.vista,
    grup: drilldown.grup,
    columnLabel: info.colLabel,
    cellValue: info.value,
  };
}

export function PivotTableDrilldown({
  columns,
  rows,
  totalLabel,
  showTotal,
  firstColLabel,
  canEdit,
  editConfig,
  drilldown,
}: {
  columns: PivotColumn[];
  rows: PivotRow[];
  totalLabel?: string;
  showTotal?: boolean;
  firstColLabel?: string;
  canEdit?: boolean;
  editConfig?: PivotEditConfig;
  drilldown: DrilldownConfig;
}) {
  const [modalCtx, setModalCtx] = useState<DetallCellaContext | null>(null);
  const prefetchTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const startDetallLoad = useCallback((params: DetallCellaParams) => {
    const key = detallCellaCacheKey(params);
    const timer = prefetchTimers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      prefetchTimers.current.delete(key);
    }
    if (getDetallCellaCached(key)) return;
    void loadDetallCellaCached(key, () => fetchDetallCellaAction(params));
  }, []);

  const prefetchDetall = useCallback(
    (info: Parameters<PivotCellClickHandler>[0]) => {
      const params = buildDetallParams(info, drilldown);
      if (!params) return;
      const key = detallCellaCacheKey(params);
      if (getDetallCellaCached(key) || prefetchTimers.current.has(key)) return;

      prefetchTimers.current.set(
        key,
        setTimeout(() => {
          prefetchTimers.current.delete(key);
          startDetallLoad(params);
        }, 60)
      );
    },
    [drilldown, startDetallLoad]
  );

  const handleCellPointerDown: PivotCellPointerDownHandler = useCallback(
    (info) => {
      const params = buildDetallParams(info, drilldown);
      if (params) startDetallLoad(params);
    },
    [drilldown, startDetallLoad]
  );

  const handleCellClick: PivotCellClickHandler = (info) => {
    const ctx = buildModalContext(info, drilldown);
    if (!ctx) return;
    setModalCtx(ctx);
  };

  return (
    <>
      <PivotTable
        columns={columns}
        rows={rows}
        totalLabel={totalLabel}
        showTotal={showTotal}
        firstColLabel={firstColLabel}
        onCellClick={handleCellClick}
        onCellHover={prefetchDetall}
        onCellPointerDown={handleCellPointerDown}
      />
      {modalCtx && (
        <DetallCellaModal
          context={modalCtx}
          onClose={() => setModalCtx(null)}
          canEdit={canEdit}
          onSave={editConfig?.onSave}
        />
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { type DetallCellaContext, DetallCellaModal } from "./DetallCellaModal";
import {
  type PivotCellClickHandler,
  type PivotColumn,
  type PivotEditConfig,
  type PivotRow,
  PivotTable,
} from "./PivotTable";

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

  const handleCellClick: PivotCellClickHandler = (info) => {
    const params = drilldown.colMap[info.colKey];
    if (!params) return;
    setModalCtx({
      concepteId: info.concepteId,
      concepteNom: info.concepteNom,
      any: drilldown.any,
      mes: params.mes,
      rang: params.rang,
      centreId: params.centreId,
      liniaNegociId: params.liniaNegociId,
      lnIdsGrup: drilldown.lnIdsGrup,
      columnLabel: info.colLabel,
    });
  };

  return (
    <>
      <PivotTable
        columns={columns}
        rows={rows}
        totalLabel={totalLabel}
        showTotal={showTotal}
        firstColLabel={firstColLabel}
        canEdit={canEdit}
        editConfig={editConfig}
        onCellClick={handleCellClick}
      />
      {modalCtx && <DetallCellaModal context={modalCtx} onClose={() => setModalCtx(null)} />}
    </>
  );
}

"use client";

import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import { PresentacioComite } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { slugFilename } from "@/lib/export/filename";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { etiquetaGrupEmpresa } from "@/lib/grups-empresa";
import type { RangMesos } from "@/lib/periodes";
import { etiquetaRangMesos } from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import { replaceVistaQuery } from "@/lib/vista-url";
import { useCallback, useEffect, useRef, useState } from "react";
import { ajustarImportConsultaAction } from "../actions";
import { EmpresaSelectors } from "./EmpresaSelectors";
import { carregarEmpresaGestioAction, carregarEmpresaPivotAction } from "./actions";
import type { EmpresaVistaData } from "./empresa-vista-data";

function etiquetaTitolEmpresa(grup: GrupEmpresa): string {
  return `Resultats · ${etiquetaGrupEmpresa(grup)}`;
}

export function EmpresaBoard({
  anys,
  anyActual,
  rang,
  grup,
  vistaInicial,
  directe,
  gestio: gestioInicial,
  potCarregarGestio = false,
}: {
  anys: number[];
  anyActual: number;
  rang: RangMesos;
  grup: GrupEmpresa;
  vistaInicial: VistaCompte;
  directe: EmpresaVistaData;
  gestio: EmpresaVistaData | null;
  potCarregarGestio?: boolean;
}) {
  const [vista, setVista] = useState<VistaCompte>(vistaInicial);
  const [gestio, setGestio] = useState<EmpresaVistaData | null>(gestioInicial);
  const pivotScopeKey = `${anyActual}:${rang.des}-${rang.fins}:${grup}`;
  const [pivotScope, setPivotScope] = useState(pivotScopeKey);
  const [pivotByVista, setPivotByVista] = useState<
    Partial<Record<VistaCompte, EmpresaVistaData["pivotRows"]>>
  >({});
  const [pivotLoading, setPivotLoading] = useState(false);
  const pivotRef = useRef(pivotByVista);
  pivotRef.current = pivotByVista;

  if (pivotScope !== pivotScopeKey) {
    setPivotScope(pivotScopeKey);
    setPivotByVista({});
  }

  useEffect(() => {
    setVista(vistaInicial);
  }, [vistaInicial]);

  useEffect(() => {
    setGestio(gestioInicial);
  }, [gestioInicial]);

  // Prefetch Gestió en background després del primer paint Directe.
  useEffect(() => {
    if (!potCarregarGestio || gestio) return;
    let cancelled = false;
    carregarEmpresaGestioAction({ any: anyActual, rang, grup }).then((data) => {
      if (!cancelled && data) setGestio(data);
    });
    return () => {
      cancelled = true;
    };
  }, [potCarregarGestio, gestio, anyActual, rang, grup]);

  const data = vista === "gestio" && gestio ? gestio : directe;
  const pivotRows = data.pivotRows.length ? data.pivotRows : (pivotByVista[vista] ?? []);
  const nomEmpresa = etiquetaGrupEmpresa(grup);
  const periodeLabel = etiquetaRangMesos(rang, anyActual);

  const ensurePivot = useCallback(async () => {
    if (data.pivotRows.length || pivotRef.current[vista]?.length) return;
    setPivotLoading(true);
    try {
      const rows = await carregarEmpresaPivotAction({
        any: anyActual,
        rang,
        grup,
        vista,
      });
      setPivotByVista((prev) => ({ ...prev, [vista]: rows }));
    } finally {
      setPivotLoading(false);
    }
  }, [anyActual, data.pivotRows.length, grup, rang, vista]);

  const onVistaLocal = gestio
    ? (next: VistaCompte) => {
        setVista(next);
        replaceVistaQuery(next);
      }
    : undefined;

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title={etiquetaTitolEmpresa(grup)}
        subtitle={data.subtitle}
        actions={
          <>
            <EmpresaSelectors
              anys={anys}
              any={anyActual}
              rang={rang}
              vista={vista}
              grup={grup}
              onVistaLocal={onVistaLocal}
            />
            <span onPointerEnter={() => void ensurePivot()}>
              <ExportInformeButton
                disabled={data.buit || (!pivotRows.length && pivotLoading)}
                filename={slugFilename(`compte-empresa-${nomEmpresa}-${periodeLabel}`)}
                title={etiquetaTitolEmpresa(grup)}
                subtitle={data.exportSubtitle}
                columns={data.columns}
                rows={pivotRows}
                totalLabel={data.totalLabel}
                sheetName="Compte"
              />
            </span>
          </>
        }
      />

      {data.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades</h3>
          <p>
            No hi ha dades de {nomEmpresa} per {periodeLabel.toLowerCase()}.
          </p>
        </div>
      ) : (
        <div key={data.vista}>
          <GestioAvis vista={data.vista} info={data.infoGestio} />
          {data.mensual && data.perLn ? (
            <PresentacioComite
              titol={
                data.vista === "gestio"
                  ? "Com va el grup (gestió · costos repartits)"
                  : "Com va el grup (directe)"
              }
              periode={data.periodePresentacio}
              kpis={data.kpisComite}
              mensual={data.mensual}
              perLn={data.perLn}
            />
          ) : null}

          <DetallCompteCollapsible
            caption={data.tableCaption}
            defaultOpen={false}
            onFirstOpen={ensurePivot}
            loading={pivotLoading && !pivotRows.length}
          >
            <PivotTableDrilldown
              columns={data.columns}
              rows={pivotRows}
              totalLabel={data.totalLabel}
              firstColLabel="Concepte"
              canEdit={data.canEdit}
              editConfig={data.canEdit ? { onSave: ajustarImportConsultaAction } : undefined}
              drilldown={{
                any: anyActual,
                colMap: data.drilldownColMap,
                lnIdsGrup: data.lnIdsGrup,
                vista: data.vista,
                grup,
              }}
            />
          </DetallCompteCollapsible>
        </div>
      )}
    </div>
  );
}

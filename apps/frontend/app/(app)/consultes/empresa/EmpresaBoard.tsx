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
import { esUnMes, etiquetaRangMesos } from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import { etiquetaVistaCompte, vistaInclouRepartiment } from "@/lib/vista-compte";
import { replaceVistaQuery } from "@/lib/vista-url";
import { useCallback, useEffect, useRef, useState } from "react";
import { ajustarImportConsultaAction } from "../actions";
import { EmpresaSelectors } from "./EmpresaSelectors";
import { carregarEmpresaCapaAction, carregarEmpresaPivotAction } from "./actions";
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
  capesInicials,
  potCarregarCapes = false,
}: {
  anys: number[];
  anyActual: number;
  rang: RangMesos;
  grup: GrupEmpresa;
  vistaInicial: VistaCompte;
  capesInicials: Partial<Record<VistaCompte, EmpresaVistaData>>;
  potCarregarCapes?: boolean;
}) {
  const [vista, setVista] = useState<VistaCompte>(vistaInicial);
  const [capes, setCapes] = useState(capesInicials);
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
    setCapes(capesInicials);
  }, [capesInicials]);

  // Prefetch capes que falten (SAP / traspassos / gestió) després del paint.
  useEffect(() => {
    if (!potCarregarCapes) return;
    const pending = (["sap", "directe", "traspassos", "gestio"] as VistaCompte[]).filter(
      (v) => !capes[v]
    );
    if (!pending.length) return;
    let cancelled = false;
    void Promise.all(
      pending.map(async (v) => {
        const data = await carregarEmpresaCapaAction({ any: anyActual, rang, grup, vista: v });
        if (!cancelled && data) {
          setCapes((prev) => (prev[v] ? prev : { ...prev, [v]: data }));
        }
      })
    );
    return () => {
      cancelled = true;
    };
  }, [potCarregarCapes, capes, anyActual, rang, grup]);

  const data = capes[vista] ?? capes.directe ?? Object.values(capes).find(Boolean);
  const vistesCarregades = (Object.keys(capes) as VistaCompte[]).filter((k) => !!capes[k]);
  const pivotRows = data?.pivotRows.length ? data.pivotRows : (pivotByVista[vista] ?? []);
  const nomEmpresa = etiquetaGrupEmpresa(grup);
  const periodeLabel = etiquetaRangMesos(rang, anyActual);
  const unMes = esUnMes(rang);

  const ensurePivot = useCallback(async () => {
    if (!data || data.pivotRows.length || pivotRef.current[vista]?.length) return;
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
  }, [anyActual, data, grup, rang, vista]);

  const onVistaLocal = (next: VistaCompte) => {
    if (!capes[next]) return false;
    setVista(next);
    replaceVistaQuery(next);
    return true;
  };

  if (!data) {
    return (
      <div className={styles.page}>
        <ConsultaHeader title={etiquetaTitolEmpresa(grup)} subtitle="Carregant…" />
      </div>
    );
  }

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
              vistesCarregades={vistesCarregades}
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
        <div key={`${pivotScopeKey}:${data.vista}`}>
          {vistaInclouRepartiment(vista) && data.infoGestio ? (
            <GestioAvis vista={vista} info={data.infoGestio} />
          ) : null}
          <PresentacioComite
            titol={etiquetaTitolEmpresa(grup)}
            periode={data.periodePresentacio}
            kpis={data.kpisComite}
            mensual={data.mensual}
            perLn={data.perLn}
          />

          <DetallCompteCollapsible
            key={pivotScopeKey}
            title={`Compte d'explotació · ${etiquetaVistaCompte(vista)}`}
            caption={data.tableCaption}
            defaultOpen={unMes}
            onFirstOpen={ensurePivot}
            onOpen={ensurePivot}
            loading={pivotLoading && !pivotRows.length}
          >
            <PivotTableDrilldown
              columns={data.columns}
              rows={pivotRows}
              totalLabel={data.totalLabel}
              canEdit={data.canEdit}
              editConfig={
                data.canEdit
                  ? {
                      onSave: async (input) => {
                        return ajustarImportConsultaAction({
                          ...input,
                          any: anyActual,
                          mes: unMes ? rang.des : input.mes,
                        });
                      },
                    }
                  : undefined
              }
              drilldown={{
                any: anyActual,
                vista,
                grup,
                lnIdsGrup: data.lnIdsGrup,
                colMap: data.drilldownColMap,
              }}
            />
          </DetallCompteCollapsible>
        </div>
      )}
    </div>
  );
}

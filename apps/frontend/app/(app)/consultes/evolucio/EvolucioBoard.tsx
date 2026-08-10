"use client";

import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import type { PivotColumn } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import { EvolucioChart } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import type { AmbitEvolucio, ConceptePivot, EvolucioMensual } from "@/lib/consultes";
import { slugFilename } from "@/lib/export/filename";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import type { KpiInformeItem } from "@/lib/kpi-definitions";
import {
  NODE_EBITDA,
  NODE_INGRESSOS,
  buildKpisEmpresa,
  buildKpisInforme,
} from "@/lib/kpi-definitions";
import { OPSIA_CHART } from "@/lib/opsia-colors";
import { MESOS_CURTS } from "@/lib/periodes";
import type { InfoGestioConsulta } from "@/lib/repartiment/service";
import type { VistaCompte } from "@/lib/vista-compte";
import { replaceVistaQuery } from "@/lib/vista-url";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ajustarImportConsultaAction } from "../actions";
import { EvolucioSelectors } from "./EvolucioSelectors";
import { carregarEvolucioGestioAction, carregarEvolucioPivotAction } from "./actions";

type LnOpt = { id: string; codi: string; nom: string };

function buildKpis(ev: EvolucioMensual | null, scope: AmbitEvolucio): KpiInformeItem[] {
  if (!ev) return [];
  const findRow = (node: number) => ev.concepts.find((c) => c.node === node);
  return scope === "empresa"
    ? buildKpisEmpresa((node) => findRow(node)?.total ?? 0)
    : buildKpisInforme((node) => findRow(node)?.total ?? 0);
}

export function EvolucioBoard({
  linies,
  anys,
  scope,
  lnId,
  anyActual,
  vistaInicial,
  nomesEmpresa,
  mostraVistaGestio,
  potGestio,
  isAdmin,
  grup,
  lnIdsEmpresa,
  directe,
  gestio: gestioInicial,
  infoGestio: infoGestioInicial,
  potCarregarGestio = false,
}: {
  linies: LnOpt[];
  anys: number[];
  scope: AmbitEvolucio;
  lnId: string | null;
  anyActual: number;
  vistaInicial: VistaCompte;
  nomesEmpresa: boolean;
  mostraVistaGestio: boolean;
  potGestio: boolean;
  isAdmin: boolean;
  grup: GrupEmpresa;
  lnIdsEmpresa: string[];
  directe: EvolucioMensual | null;
  gestio: EvolucioMensual | null;
  infoGestio: InfoGestioConsulta | null;
  potCarregarGestio?: boolean;
}) {
  const [vista, setVista] = useState<VistaCompte>(vistaInicial);
  const [gestio, setGestio] = useState<EvolucioMensual | null>(gestioInicial);
  const [infoGestio, setInfoGestio] = useState<InfoGestioConsulta | null>(infoGestioInicial);
  const pivotScopeKey = `${scope}:${lnId ?? ""}:${anyActual}:${grup}`;
  const [pivotScope, setPivotScope] = useState(pivotScopeKey);
  const [pivotByVista, setPivotByVista] = useState<Partial<Record<VistaCompte, ConceptePivot[]>>>(
    {}
  );
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

  useEffect(() => {
    setInfoGestio(infoGestioInicial);
  }, [infoGestioInicial]);

  // Prefetch Gestió en background després del primer paint Directe.
  useEffect(() => {
    if (!potCarregarGestio || gestio) return;
    let cancelled = false;
    carregarEvolucioGestioAction({ scope, lnId, any: anyActual, grup }).then((data) => {
      if (cancelled || !data) return;
      setGestio(data.gestio);
      setInfoGestio(data.infoGestio);
    });
    return () => {
      cancelled = true;
    };
  }, [potCarregarGestio, gestio, scope, lnId, anyActual, grup]);

  const ev = vista === "gestio" && gestio ? gestio : directe;
  const pivotRows = pivotByVista[vista] ?? null;
  const rowsTaula = pivotRows ?? [];
  const canEdit = isAdmin && vista === "directe" && scope === "linia";
  const vistaLabel = vista === "gestio" ? "compte de gestió" : "directe SAP";
  const columns: PivotColumn[] = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
  const kpis = useMemo(() => buildKpis(ev, scope), [ev, scope]);
  const periodeLabel = `Acumulat ${anyActual}`;

  const chartSeries = useMemo(() => {
    if (!ev) return [];
    const findRow = (node: number) => ev.concepts.find((c) => c.node === node);
    return [
      {
        name: "Ingressos",
        type: "bar" as const,
        color: OPSIA_CHART.ingressos,
        data: findRow(NODE_INGRESSOS)?.valors ?? [],
      },
      {
        name: "EBITDA",
        type: "line" as const,
        color: OPSIA_CHART.ebitda,
        data: findRow(NODE_EBITDA)?.valors ?? [],
      },
    ];
  }, [ev]);

  const ensurePivot = useCallback(async () => {
    if (pivotRef.current[vista]?.length) return;
    setPivotLoading(true);
    try {
      const rows = await carregarEvolucioPivotAction({
        scope,
        lnId,
        any: anyActual,
        grup,
        vista,
      });
      setPivotByVista((prev) => ({ ...prev, [vista]: rows }));
    } finally {
      setPivotLoading(false);
    }
  }, [anyActual, grup, lnId, scope, vista]);

  const onVistaLocal =
    potGestio && gestio
      ? (next: VistaCompte) => {
          setVista(next);
          replaceVistaQuery(next);
        }
      : undefined;

  const necessitaLn = scope === "linia" && !lnId;
  const exportRows = pivotRows ?? [];

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="Evolució mensual"
        subtitle={
          ev
            ? `${ev.titol} — ${anyActual} · ${vistaLabel}`
            : "Tria l'àmbit per veure l'evolució mes a mes."
        }
        actions={
          <>
            <EvolucioSelectors
              linies={linies}
              anys={anys}
              scope={scope}
              lnId={lnId}
              any={anyActual}
              vista={vista}
              nomesEmpresa={nomesEmpresa}
              mostraVistaGestio={mostraVistaGestio}
              onVistaLocal={onVistaLocal}
            />
            <span onPointerEnter={() => void ensurePivot()}>
              <ExportInformeButton
                disabled={!ev || ev.buit || (!exportRows.length && pivotLoading)}
                filename={slugFilename(`evolucio-${ev?.titol ?? scope}-${anyActual}`)}
                title="Evolució mensual"
                subtitle={
                  ev ? `${ev.titol} — ${anyActual} · ${vistaLabel}` : `Acumulat ${anyActual}`
                }
                columns={columns}
                rows={exportRows}
                totalLabel="Any"
                sheetName="Evolució"
              />
            </span>
          </>
        }
      />

      {necessitaLn ? (
        <div className={styles.prompt}>
          <h3>Selecciona una línia de negoci</h3>
          <p>Tria la línia que vols analitzar mes a mes, o canvia l&apos;àmbit a Empresa.</p>
        </div>
      ) : ev?.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades per {anyActual}</h3>
          <p>No hi ha dades carregades per aquest àmbit i any.</p>
        </div>
      ) : (
        <div key={vista}>
          <GestioAvis vista={vista} info={infoGestio} />
          <KpiInformeCards kpis={kpis} periodeLabel={periodeLabel} />

          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Evolució mensual · Ingressos i EBITDA</h3>
            <EvolucioChart categories={MESOS_CURTS} series={chartSeries} />
          </div>

          <DetallCompteCollapsible
            onFirstOpen={ensurePivot}
            loading={pivotLoading && !pivotRows?.length}
          >
            <PivotTableDrilldown
              columns={columns}
              rows={rowsTaula}
              totalLabel="Any"
              firstColLabel="Concepte"
              canEdit={canEdit}
              editConfig={canEdit ? { onSave: ajustarImportConsultaAction } : undefined}
              drilldown={{
                any: anyActual,
                vista,
                grup,
                lnIdsGrup: scope === "empresa" ? lnIdsEmpresa : undefined,
                colMap: Object.fromEntries(
                  Array.from({ length: 12 }, (_, i) => [
                    String(i),
                    { mes: i + 1, ...(scope === "linia" && lnId ? { liniaNegociId: lnId } : {}) },
                  ])
                ),
              }}
            />
          </DetallCompteCollapsible>
        </div>
      )}
    </div>
  );
}

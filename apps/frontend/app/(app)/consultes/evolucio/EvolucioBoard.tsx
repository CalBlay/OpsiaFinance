"use client";

import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import type { ChartSeries } from "@/components/consultes/EvolucioChart";
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
import type { NaturaByNodeRecord } from "@/lib/punt-equilibri";
import { calcularPePerMes, kpisPuntEquilibri, nMesosAmbIngressos } from "@/lib/punt-equilibri";
import type { InfoGestioConsulta } from "@/lib/repartiment/service";
import type { VistaCompte } from "@/lib/vista-compte";
import { etiquetaVistaCompte } from "@/lib/vista-compte";
import { replaceVistaQuery } from "@/lib/vista-url";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ajustarImportConsultaAction } from "../actions";
import { EvolucioSelectors } from "./EvolucioSelectors";
import {
  carregarEvolucioCapaAction,
  carregarEvolucioGestioAction,
  carregarEvolucioPivotAction,
} from "./actions";

type LnOpt = { id: string; codi: string; nom: string };

function buildKpis(
  ev: EvolucioMensual | null,
  scope: AmbitEvolucio,
  naturaByNode?: NaturaByNodeRecord,
  peKpisLn?: KpiInformeItem[],
  vista?: VistaCompte
): KpiInformeItem[] {
  if (!ev) return [];
  const findRow = (node: number) => ev.concepts.find((c) => c.node === node);
  const base =
    scope === "empresa"
      ? buildKpisEmpresa((node) => findRow(node)?.total ?? 0)
      : buildKpisInforme((node) => findRow(node)?.total ?? 0);

  // PE LN Gestió (amb Estructura Central): només quan la vista activa és Gestió,
  // així PE i EBITDA comparteixen el mateix compte.
  if (scope === "linia" && vista === "gestio" && peKpisLn?.length) {
    return [...base, ...peKpisLn];
  }

  if (!naturaByNode) return base;
  const peConcepts = ev.concepts.map((c) => ({
    node: c.node,
    total: c.total,
    esSubtotal: c.esSubtotal,
  }));
  const nMesos = nMesosAmbIngressos(findRow(NODE_INGRESSOS)?.valors ?? []);
  const pe = kpisPuntEquilibri(peConcepts, naturaByNode, { nMesos });
  // A Directe/Traspassos: PE de la vista + badge d'estructura Central (si ve de peKpisLn).
  const estructura =
    scope === "linia" ? (peKpisLn?.filter((k) => k.tipus === "estructura") ?? []) : [];
  return [...base, ...pe, ...estructura];
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
  naturaByNode,
  peKpisLn,
  peMensualLn,
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
  naturaByNode?: NaturaByNodeRecord;
  /** PE propi precalculat (només scope=línia). */
  peKpisLn?: KpiInformeItem[];
  peMensualLn?: (number | null)[];
}) {
  const [vista, setVista] = useState<VistaCompte>(vistaInicial);
  const [gestio, setGestio] = useState<EvolucioMensual | null>(gestioInicial);
  const [infoGestio, setInfoGestio] = useState<InfoGestioConsulta | null>(infoGestioInicial);
  const [capes, setCapes] = useState<Partial<Record<VistaCompte, EvolucioMensual>>>(() => ({
    ...(directe ? { [vistaInicial]: directe } : {}),
    ...(gestioInicial ? { gestio: gestioInicial, traspassos: gestioInicial } : {}),
  }));
  const [capaLoading, setCapaLoading] = useState(false);
  const pivotScopeKey = `${scope}:${lnId ?? ""}:${anyActual}:${grup}`;
  /** Cache lligada a l'àmbit: evita mostrar files de la LN anterior mentre React aplica el clear. */
  const [pivotCache, setPivotCache] = useState<{
    key: string;
    byVista: Partial<Record<VistaCompte, ConceptePivot[]>>;
  }>({ key: pivotScopeKey, byVista: {} });
  const [pivotLoading, setPivotLoading] = useState(false);
  const pivotLoadGen = useRef(0);
  /** Si el compte ja s'havia obert, en canviar de LN el tornem a obrir i recarreguem. */
  const detallObertRef = useRef(false);

  const pivotByVista = pivotCache.key === pivotScopeKey ? pivotCache.byVista : {};
  const pivotRef = useRef({ key: pivotScopeKey, byVista: pivotByVista });
  pivotRef.current = { key: pivotScopeKey, byVista: pivotByVista };

  useEffect(() => {
    setVista(vistaInicial);
    setCapes({
      ...(directe ? { [vistaInicial]: directe } : {}),
      ...(gestioInicial ? { gestio: gestioInicial, traspassos: gestioInicial } : {}),
    });
    const recarregarPivot = Object.values(pivotRef.current.byVista).some((rows) => !!rows?.length);
    const scopeKey = `${scope}:${lnId ?? ""}:${anyActual}:${grup}`;
    setPivotCache({ key: scopeKey, byVista: {} });
    if (!recarregarPivot) return;
    let cancelled = false;
    setPivotLoading(true);
    void carregarEvolucioPivotAction({
      scope,
      lnId,
      any: anyActual,
      grup,
      vista: vistaInicial,
    }).then((rows) => {
      if (cancelled) return;
      setPivotCache({ key: scopeKey, byVista: { [vistaInicial]: rows } });
      setPivotLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vistaInicial, directe, gestioInicial, scope, lnId, anyActual, grup]);

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
      setCapes((prev) => ({ ...prev, gestio: data.gestio, traspassos: data.gestio }));
      setInfoGestio(data.infoGestio);
    });
    return () => {
      cancelled = true;
    };
  }, [potCarregarGestio, gestio, scope, lnId, anyActual, grup]);

  const ev = capes[vista] ?? null;
  const pivotRows = pivotByVista[vista] ?? null;
  const rowsTaula = pivotRows ?? [];
  const canEdit = isAdmin && vista === "directe" && scope === "linia" && !!lnId;
  const vistaLabel = etiquetaVistaCompte(vista);
  const columns: PivotColumn[] = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
  const kpis = useMemo(
    () => buildKpis(ev, scope, naturaByNode, peKpisLn, vista),
    [ev, scope, naturaByNode, peKpisLn, vista]
  );
  const periodeLabel = `Acumulat ${anyActual}`;

  const chartSeries = useMemo((): ChartSeries[] => {
    if (!ev) return [];
    const findRow = (node: number) => ev.concepts.find((c) => c.node === node);
    const series: ChartSeries[] = [
      {
        name: "Ingressos",
        type: "bar",
        color: OPSIA_CHART.ingressos,
        data: findRow(NODE_INGRESSOS)?.valors ?? [],
      },
      {
        name: "EBITDA",
        type: "line",
        color: OPSIA_CHART.ebitda,
        data: findRow(NODE_EBITDA)?.valors ?? [],
        endLabel: "EBITDA",
        endLabelDy: -12,
      },
    ];
    // LN: sèrie peMensualLn (Fixos_mes ÷ MC%_període). Empresa: mateix criteri via calcularPePerMes.
    if (naturaByNode) {
      const peMes =
        scope === "linia" && peMensualLn?.length
          ? peMensualLn
          : calcularPePerMes(
              ev.concepts.map((c) => ({
                node: c.node,
                valors: c.valors,
                esSubtotal: c.esSubtotal,
              })),
              naturaByNode
            );
      series.push({
        name: "PE",
        type: "line",
        color: OPSIA_CHART.pe,
        data: peMes,
        strokeDasharray: "6 4",
        endLabel: "PE",
        endLabelDy: 12,
      });
    }
    return series;
  }, [ev, naturaByNode, scope, peMensualLn]);

  const ensurePivot = useCallback(async () => {
    const scopeKey = `${scope}:${lnId ?? ""}:${anyActual}:${grup}`;
    if (pivotRef.current.key === scopeKey && pivotRef.current.byVista[vista]?.length) return;
    const gen = ++pivotLoadGen.current;
    setPivotLoading(true);
    try {
      const rows = await carregarEvolucioPivotAction({
        scope,
        lnId,
        any: anyActual,
        grup,
        vista,
      });
      if (gen !== pivotLoadGen.current) return;
      setPivotCache((prev) => {
        if (prev.key !== scopeKey) return { key: scopeKey, byVista: { [vista]: rows } };
        return { key: scopeKey, byVista: { ...prev.byVista, [vista]: rows } };
      });
    } finally {
      if (gen === pivotLoadGen.current) setPivotLoading(false);
    }
  }, [anyActual, grup, lnId, scope, vista]);

  const openPivot = useCallback(() => {
    detallObertRef.current = true;
    return ensurePivot();
  }, [ensurePivot]);

  const onVistaLocal = (next: VistaCompte) => {
    if ((next === "traspassos" || next === "gestio") && !potGestio) return false;
    setVista(next);
    replaceVistaQuery(next);
    if (capes[next]) return true;
    setCapaLoading(true);
    void carregarEvolucioCapaAction({ scope, lnId, any: anyActual, grup, vista: next }).then(
      (data) => {
        setCapaLoading(false);
        if (data) setCapes((prev) => ({ ...prev, [next]: data }));
      }
    );
    return true;
  };

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
      ) : !ev && capaLoading ? (
        <div className={styles.prompt}>
          <h3>Carregant…</h3>
          <p>Preparant la vista {vistaLabel}.</p>
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
            <h3 className={styles.chartTitle}>
              Evolució mensual · Ingressos, EBITDA
              {scope === "linia" && peMensualLn?.length ? " i PE" : naturaByNode ? " i PE" : ""}
            </h3>
            <EvolucioChart categories={MESOS_CURTS} series={chartSeries} />
          </div>

          <DetallCompteCollapsible
            key={`${pivotScopeKey}:${vista}`}
            defaultOpen={detallObertRef.current || vista === "ajustos"}
            onFirstOpen={openPivot}
            onOpen={openPivot}
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

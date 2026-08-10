"use client";

import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import type { PivotColumn } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import { EvolucioChart } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import type { CompteExplotacioCentre, ConceptePivot } from "@/lib/consultes";
import { etiquetaCentre } from "@/lib/consultes-etiquetes";
import { slugFilename } from "@/lib/export/filename";
import { NODE_EBITDA, NODE_INGRESSOS, buildKpisInforme } from "@/lib/kpi-definitions";
import { OPSIA_CHART } from "@/lib/opsia-colors";
import { MESOS_CURTS } from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import { replaceVistaQuery } from "@/lib/vista-url";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ajustarImportConsultaAction } from "../actions";
import { CentreLnChooser, CentreResumPresentacio } from "../presenters-dynamic";
import type { FilaResumCentre, MesCostCentre } from "./CentreResumPresentacio";
import { CentreSelectors } from "./CentreSelectors";
import { carregarCentreGestioAction, carregarCentrePivotAction } from "./actions";

type LnOpt = {
  id: string;
  codi: string;
  nom: string;
  centres: { id: string; codi: string; nom: string }[];
};

type ResumCentre = {
  lnNom: string;
  totals: {
    costPersonal: number;
    vendes: number;
    personalPctVendes: number | null;
    foodPctVendes: number | null;
    ebitdaPct: number | null;
  };
  cobertura: { ambDades: number; total: number };
  files: FilaResumCentre[];
  evolucioMensual: MesCostCentre[];
  buit: boolean;
};

export function CentreBoard({
  arbre,
  anys,
  lnId,
  centreId,
  anyActual,
  vistaInicial,
  isAdmin,
  directe,
  gestio: gestioInicial,
  potCarregarGestio = false,
  resum = null,
  lnChooser = null,
}: {
  arbre: LnOpt[];
  anys: number[];
  lnId: string | null;
  centreId: string | null;
  anyActual: number;
  vistaInicial: VistaCompte;
  isAdmin: boolean;
  directe: CompteExplotacioCentre | null;
  gestio: CompteExplotacioCentre | null;
  potCarregarGestio?: boolean;
  resum?: ResumCentre | null;
  lnChooser?: { id: string; name: string; nCentres: number; href: string }[] | null;
}) {
  const [vista, setVista] = useState<VistaCompte>(vistaInicial);
  const [gestio, setGestio] = useState<CompteExplotacioCentre | null>(gestioInicial);
  const pivotScopeKey = `${centreId ?? ""}:${anyActual}`;
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
    if (!potCarregarGestio || !centreId || gestio) return;
    let cancelled = false;
    carregarCentreGestioAction(centreId, anyActual).then((data) => {
      if (!cancelled && data) setGestio(data);
    });
    return () => {
      cancelled = true;
    };
  }, [potCarregarGestio, centreId, anyActual, gestio]);

  const compte = vista === "gestio" && gestio ? gestio : directe;
  const canEdit = isAdmin && vista === "directe";
  const columns: PivotColumn[] = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
  const periodeLabel = `Acumulat ${anyActual}`;
  const pivotRows = pivotByVista[vista] ?? null;
  const vistaLabel = vista === "gestio" ? "Gestió" : "Directe";

  const kpis = useMemo(() => {
    if (!compte) return [];
    const findRow = (node: number) => compte.concepts.find((c) => c.node === node);
    return buildKpisInforme((node) => findRow(node)?.total ?? 0);
  }, [compte]);

  const chartSeries = useMemo(() => {
    if (!compte) return [];
    const findRow = (node: number) => compte.concepts.find((c) => c.node === node);
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
  }, [compte]);

  const ensurePivot = useCallback(async () => {
    if (!centreId || pivotRef.current[vista]?.length) return;
    setPivotLoading(true);
    try {
      const rows = await carregarCentrePivotAction(centreId, anyActual, vista);
      setPivotByVista((prev) => ({ ...prev, [vista]: rows }));
    } finally {
      setPivotLoading(false);
    }
  }, [anyActual, centreId, vista]);

  const onVistaLocal =
    centreId && gestio
      ? (next: VistaCompte) => {
          setVista(next);
          replaceVistaQuery(next);
        }
      : undefined;

  const exportRows = pivotRows ?? [];

  const subtitle = compte?.centre
    ? `${etiquetaCentre(compte.centre)} — ${compte.centre.liniaNegoci.nom}${vista === "gestio" ? " · gestió (traspassos personal)" : " · directe SAP"}`
    : lnId && !centreId && resum
      ? `Costos i intensitat per centre · ${resum.lnNom} · ${periodeLabel} · ${vistaLabel}`
      : !lnId
        ? "Tria una línia per veure el resum de costos dels seus centres."
        : "Selecciona un centre per veure el seu compte d'explotació anual, mes a mes.";

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="Compte d'explotació · per centre"
        subtitle={subtitle}
        actions={
          <>
            <CentreSelectors
              arbre={arbre}
              anys={anys}
              lnId={lnId}
              centreId={centreId}
              any={anyActual}
              vista={vista}
              onVistaLocal={onVistaLocal}
            />
            {centreId ? (
              <span onPointerEnter={() => void ensurePivot()}>
                <ExportInformeButton
                  disabled={!compte || compte.buit || (!exportRows.length && pivotLoading)}
                  filename={slugFilename(
                    `compte-centre-${compte?.centre ? etiquetaCentre(compte.centre) : "centre"}-${anyActual}`
                  )}
                  title="Compte d'explotació · per centre"
                  subtitle={
                    compte?.centre
                      ? `${etiquetaCentre(compte.centre)} — ${compte.centre.liniaNegoci.nom} · ${periodeLabel} · ${vista === "gestio" ? "Gestió" : "Directe"}`
                      : periodeLabel
                  }
                  columns={columns}
                  rows={exportRows}
                  totalLabel="Any"
                  sheetName="Centre"
                />
              </span>
            ) : null}
          </>
        }
      />

      {!lnId ? (
        lnChooser ? (
          <CentreLnChooser linies={lnChooser} anyActual={anyActual} vista={vistaLabel} />
        ) : (
          <div className={styles.prompt}>
            <h3>Cap línia seleccionada</h3>
            <p>Tria una línia de negoci per veure el resum de costos dels centres.</p>
          </div>
        )
      ) : !centreId ? (
        resum && !resum.buit ? (
          <CentreResumPresentacio
            periode={periodeLabel}
            lnNom={resum.lnNom}
            vistaLabel={vistaLabel}
            totals={resum.totals}
            cobertura={resum.cobertura}
            files={resum.files}
            evolucioMensual={resum.evolucioMensual}
          />
        ) : (
          <div className={styles.prompt}>
            <h3>Sense dades de cost</h3>
            <p>
              No hi ha cost personal ni compte per als centres de{" "}
              {arbre.find((l) => l.id === lnId)?.nom ?? "aquesta línia"} a {anyActual}.
            </p>
          </div>
        )
      ) : compte?.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades per {anyActual}</h3>
          <p>
            Aquest centre no té dades carregades per l&apos;any seleccionat. Puja i processa un
            compte de resultats a la secció Dades.
          </p>
        </div>
      ) : (
        <div key={vista}>
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
              rows={pivotRows ?? []}
              totalLabel="Any"
              firstColLabel="Concepte"
              canEdit={canEdit}
              editConfig={canEdit ? { onSave: ajustarImportConsultaAction } : undefined}
              drilldown={{
                any: anyActual,
                vista,
                colMap: Object.fromEntries(
                  Array.from({ length: 12 }, (_, i) => [
                    String(i),
                    { mes: i + 1, centreId: centreId ?? undefined },
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

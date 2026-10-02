"use client";

import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import type { PivotColumn } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import { EvolucioChart } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import type { CompteExplotacioCentresConsolidat, ConceptePivot } from "@/lib/consultes";
import { etiquetaCentre } from "@/lib/consultes-etiquetes";
import { slugFilename } from "@/lib/export/filename";
import { NODE_EBITDA, NODE_INGRESSOS, buildKpisInforme } from "@/lib/kpi-definitions";
import { OPSIA_CHART } from "@/lib/opsia-colors";
import { MESOS_CURTS } from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import { etiquetaVistaCompte } from "@/lib/vista-compte";
import { replaceVistaQuery } from "@/lib/vista-url";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConsolidatCentresSelectors } from "./ConsolidatCentresSelectors";
import { carregarConsolidatCapaAction, carregarConsolidatPivotAction } from "./actions";

type LnOpt = {
  id: string;
  codi: string;
  nom: string;
  centres: { id: string; codi: string; nom: string }[];
};

export function ConsolidatCentresBoard({
  arbre,
  anys,
  centreIds,
  anyActual,
  vistaInicial,
  vistesOpcions,
  capesInicials,
  potCarregarCapes = false,
}: {
  arbre: LnOpt[];
  anys: number[];
  centreIds: string[];
  anyActual: number;
  vistaInicial: VistaCompte;
  vistesOpcions?: readonly VistaCompte[] | null;
  capesInicials: Partial<Record<VistaCompte, CompteExplotacioCentresConsolidat>>;
  potCarregarCapes?: boolean;
}) {
  const [vista, setVista] = useState<VistaCompte>(vistaInicial);
  const [capes, setCapes] = useState(capesInicials);
  const scopeKey = `${centreIds.join(",")}:${anyActual}`;
  const [pivotScope, setPivotScope] = useState(scopeKey);
  const [pivotByVista, setPivotByVista] = useState<Partial<Record<VistaCompte, ConceptePivot[]>>>(
    {}
  );
  const [pivotLoading, setPivotLoading] = useState(false);
  const pivotRef = useRef(pivotByVista);
  pivotRef.current = pivotByVista;

  if (pivotScope !== scopeKey) {
    setPivotScope(scopeKey);
    setPivotByVista({});
  }

  useEffect(() => {
    setVista(vistaInicial);
  }, [vistaInicial]);

  useEffect(() => {
    const recarregarPivot = Object.values(pivotRef.current).some((rows) => !!rows?.length);
    setCapes(capesInicials);
    setPivotByVista({});
    if (!recarregarPivot || !centreIds.length) return;
    let cancelled = false;
    setPivotLoading(true);
    void carregarConsolidatPivotAction(centreIds, anyActual, vista).then((rows) => {
      if (cancelled) return;
      setPivotByVista({ [vista]: rows });
      setPivotLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [capesInicials, centreIds, anyActual, vista]);

  useEffect(() => {
    if (!potCarregarCapes || !centreIds.length) return;
    const pending = (["sap", "ajustos", "directe", "traspassos", "gestio"] as VistaCompte[]).filter(
      (v) => !capes[v]
    );
    if (!pending.length) return;
    let cancelled = false;
    void Promise.all(
      pending.map(async (v) => {
        const data = await carregarConsolidatCapaAction(centreIds, anyActual, v);
        if (!cancelled && data) {
          setCapes((prev) => (prev[v] ? prev : { ...prev, [v]: data }));
        }
      })
    );
    return () => {
      cancelled = true;
    };
  }, [potCarregarCapes, centreIds, anyActual, capes]);

  const compte = capes[vista] ?? capes.directe ?? null;
  const vistesCarregades = (Object.keys(capes) as VistaCompte[]).filter((k) => !!capes[k]);
  const columns: PivotColumn[] = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
  const periodeLabel = `Acumulat ${anyActual}`;
  const pivotRows = pivotByVista[vista] ?? null;
  const vistaLabel = etiquetaVistaCompte(vista);

  const centresLabel = useMemo(() => {
    const list = compte?.centres?.length
      ? compte.centres
      : arbre.flatMap((ln) => ln.centres).filter((c) => centreIds.includes(c.id));
    if (!list.length) return null;
    if (list.length <= 3) return list.map((c) => etiquetaCentre(c)).join(" · ");
    return `${list
      .slice(0, 2)
      .map((c) => etiquetaCentre(c))
      .join(" · ")} · +${list.length - 2}`;
  }, [arbre, centreIds, compte?.centres]);

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
    if (!centreIds.length || pivotRef.current[vista]?.length) return;
    setPivotLoading(true);
    try {
      const rows = await carregarConsolidatPivotAction(centreIds, anyActual, vista);
      setPivotByVista((prev) => ({ ...prev, [vista]: rows }));
    } finally {
      setPivotLoading(false);
    }
  }, [anyActual, centreIds, vista]);

  const onVistaLocal = (next: VistaCompte) => {
    if (!capes[next]) return false;
    setVista(next);
    replaceVistaQuery(next);
    return true;
  };

  const exportRows = pivotRows ?? [];
  const subtitle = !centreIds.length
    ? "Tria línia → centre → Afegir. Repeteix i prem OK per veure la suma del compte."
    : centresLabel
      ? `Suma simple · ${centresLabel} · ${etiquetaVistaCompte(vista).toLowerCase()}`
      : `Suma de ${centreIds.length} centres · ${etiquetaVistaCompte(vista).toLowerCase()}`;

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="Compte d'explotació · consolidat centres"
        subtitle={subtitle}
        actions={
          <>
            <ConsolidatCentresSelectors
              arbre={arbre}
              anys={anys}
              centreIds={centreIds}
              any={anyActual}
              vista={vista}
              vistesCarregades={vistesCarregades}
              onVistaLocal={onVistaLocal}
              vistesOpcions={vistesOpcions}
            />
            {centreIds.length ? (
              <span onPointerEnter={() => void ensurePivot()}>
                <ExportInformeButton
                  disabled={!compte || compte.buit || (!exportRows.length && pivotLoading)}
                  filename={slugFilename(
                    `compte-consolidat-centres-${centreIds.length}c-${anyActual}`
                  )}
                  title="Compte d'explotació · consolidat centres"
                  subtitle={`${centresLabel ?? `${centreIds.length} centres`} · ${periodeLabel} · ${vistaLabel}`}
                  columns={columns}
                  rows={exportRows}
                  totalLabel="Any"
                  sheetName="Consolidat"
                />
              </span>
            ) : null}
          </>
        }
      />

      {!centreIds.length ? (
        <div className={styles.prompt}>
          <h3>Selecciona centres</h3>
          <p>
            Tria una <strong>línia</strong>, després un <strong>centre</strong> i prem{" "}
            <strong>Afegir</strong>. Repeteix (canviant de línia si cal) i quan tinguis la llista
            prem <strong>OK</strong>. El resultat és la suma simple del compte d&apos;explotació.
          </p>
        </div>
      ) : compte?.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades per {anyActual}</h3>
          <p>
            Els centres seleccionats no tenen dades carregades per l&apos;any. Comprova importacions
            o canvia l&apos;any.
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
            onOpen={ensurePivot}
            loading={pivotLoading && !pivotRows?.length}
          >
            <PivotTableDrilldown
              columns={columns}
              rows={pivotRows ?? []}
              totalLabel="Any"
              firstColLabel="Concepte"
              canEdit={false}
              drilldown={{
                any: anyActual,
                vista,
                colMap: Object.fromEntries(
                  Array.from({ length: 12 }, (_, i) => [
                    String(i),
                    {
                      mes: i + 1,
                      ...(centreIds.length === 1 ? { centreId: centreIds[0] } : {}),
                    },
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

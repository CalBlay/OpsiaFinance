"use client";

import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import type { PivotColumn } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import { VendesPieChart } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import type { ComparativaLn, VistaCompte } from "@/lib/consultes";
import { etiquetaGrafic, indicesCentresOperatius, segmentsVendes } from "@/lib/consultes-grafics";
import { NODE_VENDES } from "@/lib/kpi-definitions";
import type { RangMesos } from "@/lib/periodes";
import { esUnMes } from "@/lib/periodes";
import { COL_REPARTIMENT_ID } from "@/lib/repartiment/gestio-consultes";
import { useEffect, useState, useTransition } from "react";
import { ajustarImportConsultaAction } from "../actions";
import { carregarComparativaLnAction } from "../actions-perf";

export function LiniaCentresLazy({
  lnId,
  anyActual,
  rang,
  vista,
  canEdit,
  periodeLabel,
}: {
  lnId: string;
  anyActual: number;
  rang: RangMesos;
  vista: VistaCompte;
  canEdit: boolean;
  periodeLabel: string;
}) {
  const currentKey = `${lnId}:${anyActual}:${rang.des}:${rang.fins}:${vista}`;
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [comp, setComp] = useState<ComparativaLn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const obert = openedKey === currentKey;
  const compActual = loadedKey === currentKey ? comp : null;
  const errorActual = loadedKey === currentKey ? error : null;

  useEffect(() => {
    if (!obert || compActual) return;
    let cancelled = false;
    startTransition(() => {
      void carregarComparativaLnAction(lnId, anyActual, rang, vista)
        .then((data) => {
          if (!cancelled) {
            setLoadedKey(currentKey);
            setError(null);
            setComp(data);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoadedKey(currentKey);
            setComp(null);
            setError("No s'ha pogut carregar el desglossament per centres.");
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [obert, compActual, currentKey, lnId, anyActual, rang, vista]);

  const centres = compActual?.centres ?? [];
  const idxOperatius = indicesCentresOperatius(centres).filter(
    (i) => centres[i]?.id !== COL_REPARTIMENT_ID
  );
  const findCentreRow = (node: number) => compActual?.concepts.find((c) => c.node === node);
  const columnsCentres: PivotColumn[] = centres.map((c) => ({
    key: c.id,
    label: c.codi,
    sublabel: c.nom,
  }));
  const vendesPieSegments = compActual
    ? segmentsVendes(
        centres.filter((_, i) => idxOperatius.includes(i)),
        idxOperatius.map((i) => findCentreRow(NODE_VENDES)?.valors[i] ?? 0)
      )
    : [];

  return (
    <div>
      {!obert ? (
        <div className={styles.prompt} style={{ marginTop: "1.25rem" }}>
          <h3>Desglossament per centres (opcional)</h3>
          <p>
            El compte total de la línia ja es mostra a dalt. Obre el detall per centre només si el
            necessites (consulta addicional).
          </p>
          <button
            type="button"
            className={styles.select}
            style={{ marginTop: "0.75rem", cursor: "pointer", minWidth: 200 }}
            onClick={() => setOpenedKey(currentKey)}
          >
            Carregar desglossament per centres
          </button>
        </div>
      ) : (
        <DetallCompteCollapsible
          defaultOpen
          title="Desglossament per centres"
          caption={
            vista === "gestio"
              ? "Detall per centre. Per analitzar un sol centre, ves a Consultes -> Per centre."
              : "Detall per centre de la línia. Per analitzar un sol centre, ves a Consultes -> Per centre."
          }
        >
          {pending && !compActual ? (
            <p className={styles.subtitle}>Carregant centres...</p>
          ) : errorActual ? (
            <p className={styles.subtitle}>{errorActual}</p>
          ) : !compActual || compActual.buit ? (
            <p className={styles.subtitle}>Sense dades per centres en aquest període.</p>
          ) : (
            <>
              {vendesPieSegments.length > 0 && (
                <div className={styles.chartCard} style={{ marginBottom: "1rem" }}>
                  <h3 className={styles.chartTitle}>Pes de vendes per centre · {periodeLabel}</h3>
                  <VendesPieChart
                    segments={vendesPieSegments.map((s, i) => {
                      const centre = centres[idxOperatius[i] ?? -1];
                      return {
                        ...s,
                        name: etiquetaGrafic(centre ?? { codi: s.name, nom: s.name }),
                      };
                    })}
                    height={300}
                  />
                </div>
              )}
              <PivotTableDrilldown
                columns={columnsCentres}
                rows={compActual.concepts}
                totalLabel="Total LN"
                firstColLabel="Concepte"
                canEdit={canEdit}
                editConfig={canEdit ? { onSave: ajustarImportConsultaAction } : undefined}
                drilldown={{
                  any: anyActual,
                  vista,
                  colMap: Object.fromEntries(
                    centres.map((c) => [
                      c.id,
                      c.id === COL_REPARTIMENT_ID
                        ? { rang, liniaNegociId: lnId }
                        : { rang, mes: esUnMes(rang) ? rang.des : undefined, centreId: c.id },
                    ])
                  ),
                }}
              />
            </>
          )}
        </DetallCompteCollapsible>
      )}
    </div>
  );
}

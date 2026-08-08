import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import type { PivotColumn, PivotRow } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import { EvolucioChart } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { auth } from "@/lib/auth";
import {
  MESOS_CURTS,
  type VistaCompte,
  etiquetaRangMesos,
  getAnysAmbDades,
  getArbreSeleccio,
  getEvolucioMensual,
  parseRangMesosFromSearchParams,
} from "@/lib/consultes";
import { etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { slugFilename } from "@/lib/export/filename";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import { NODE_EBITDA, NODE_INGRESSOS, buildKpisInforme } from "@/lib/kpi-definitions";
import { OPSIA_CHART } from "@/lib/opsia-colors";
import type { RangMesos } from "@/lib/periodes";
import { aplicarVistaGestioEvolucioLn } from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { ajustarImportConsultaAction } from "../actions";
import { LiniaCentresLazy } from "./LiniaCentresLazy";
import { LiniaSelectors } from "./LiniaSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consulta per línia de negoci — OpsiaFinance" };

function retallaRang(rows: PivotRow[], rang: RangMesos): PivotRow[] {
  return rows.map((r) => {
    const valors = r.valors.slice(rang.des - 1, rang.fins);
    return {
      ...r,
      valors,
      total: valors.reduce((a, b) => a + b, 0),
    };
  });
}

export default async function ConsultaLiniaPage({
  searchParams,
}: {
  searchParams: Promise<{
    ln?: string;
    any?: string;
    mes?: string;
    des?: string;
    fins?: string;
    vista?: string;
  }>;
}) {
  const sp = await searchParams;
  const [session, arbre, anys, grup] = await Promise.all([
    auth(),
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);

  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const rang = parseRangMesosFromSearchParams(sp);

  const lnId = sp.ln ?? null;
  const vista: VistaCompte = sp.vista === "gestio" ? "gestio" : "directe";
  const canEdit = session?.user?.role === "ADMIN" && vista === "directe";

  const linies = liniesPerConsultaDetall(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom })),
    grup
  );

  // Només evolució (+ gestió): el desglossament per centres es carrega sota demanda.
  const [evRaw, infoGestio] = lnId
    ? await Promise.all([
        getEvolucioMensual("linia", lnId, anyActual),
        vista === "gestio" ? getInfoGestioConsulta(anyActual, rang) : Promise.resolve(null),
      ])
    : [null, null];

  let ev = evRaw;
  if (ev && vista === "gestio" && lnId) {
    ev = {
      ...ev,
      concepts: await aplicarVistaGestioEvolucioLn(lnId, anyActual, ev.concepts),
    };
  }

  const periodeLabel = etiquetaRangMesos(rang, anyActual);
  const findEvRow = (node: number) => ev?.concepts.find((c) => c.node === node);

  const valorKpi = (node: number) => {
    const row = findEvRow(node);
    if (!row) return 0;
    return row.valors.slice(rang.des - 1, rang.fins).reduce((s, v) => s + v, 0);
  };
  const kpis = ev && !ev.buit ? buildKpisInforme(valorKpi) : [];

  const mesosCols = MESOS_CURTS.slice(rang.des - 1, rang.fins);
  const columnsMes: PivotColumn[] = mesosCols.map((m, i) => ({
    key: String(rang.des - 1 + i),
    label: m,
  }));
  const rowsMes = ev ? retallaRang(ev.concepts, rang) : [];

  const chartSeries = ev
    ? [
        {
          name: "Ingressos",
          type: "bar" as const,
          color: OPSIA_CHART.ingressos,
          data: (findEvRow(NODE_INGRESSOS)?.valors ?? []).slice(rang.des - 1, rang.fins),
        },
        {
          name: "EBITDA",
          type: "line" as const,
          color: OPSIA_CHART.ebitda,
          data: (findEvRow(NODE_EBITDA)?.valors ?? []).slice(rang.des - 1, rang.fins),
        },
      ]
    : [];

  const buit = !ev || ev.buit;
  const lnLabel = ev?.titol ?? (lnId ? linies.find((l) => l.id === lnId) : null);
  const lnEtiqueta =
    typeof lnLabel === "string" ? lnLabel : lnLabel ? etiquetaLiniaNegoci(lnLabel) : "";

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="Compte d'explotació · per línia de negoci"
        subtitle={
          lnId && (ev || lnEtiqueta)
            ? `${ev?.titol ?? lnEtiqueta} — total de la línia · ${periodeLabel}${vista === "gestio" ? " · gestió" : " · directe SAP"}`
            : "Selecciona una línia de negoci per veure el total del període."
        }
        actions={
          <>
            <LiniaSelectors
              linies={linies}
              anys={anys.length ? anys : [anyActual]}
              lnId={lnId}
              any={anyActual}
              rang={rang}
              vista={vista}
            />
            <ExportInformeButton
              disabled={buit}
              filename={slugFilename(
                `compte-linia-${ev?.titol ?? (lnEtiqueta || "linia")}-${periodeLabel}`
              )}
              title="Compte d'explotació · per línia de negoci"
              subtitle={
                ev
                  ? `${ev.titol} — ${periodeLabel} · ${vista === "gestio" ? "Gestió" : "Directe"}`
                  : periodeLabel
              }
              columns={columnsMes}
              rows={rowsMes}
              totalLabel="Període"
              sheetName="Línia"
            />
          </>
        }
      />

      {!lnId ? (
        <div className={styles.prompt}>
          <h3>Cap línia seleccionada</h3>
          <p>
            Tria una línia de negoci per veure el compte d&apos;explotació total (mes a mes). El
            detall per centre és opcional; per analitzar un centre concret fes servir Consultes →
            Per centre.
          </p>
        </div>
      ) : buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades</h3>
          <p>Aquesta línia no té dades per {periodeLabel.toLowerCase()}.</p>
        </div>
      ) : (
        <>
          <GestioAvis vista={vista} info={infoGestio} />
          <KpiInformeCards kpis={kpis} periodeLabel={periodeLabel} />

          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>
              Evolució de la línia · Ingressos i EBITDA · {periodeLabel}
            </h3>
            <EvolucioChart categories={mesosCols} series={chartSeries} height={360} />
          </div>

          <DetallCompteCollapsible defaultOpen title="Compte de la línia (total)">
            <PivotTableDrilldown
              columns={columnsMes}
              rows={rowsMes}
              totalLabel="Període"
              firstColLabel="Concepte"
              canEdit={canEdit}
              editConfig={canEdit ? { onSave: ajustarImportConsultaAction } : undefined}
              drilldown={{
                any: anyActual,
                vista,
                colMap: Object.fromEntries(
                  columnsMes.map((c, i) => [
                    c.key,
                    { mes: rang.des + i, liniaNegociId: lnId ?? undefined },
                  ])
                ),
              }}
            />
          </DetallCompteCollapsible>

          <LiniaCentresLazy
            lnId={lnId}
            anyActual={anyActual}
            rang={rang}
            vista={vista}
            canEdit={canEdit}
            periodeLabel={periodeLabel}
          />
        </>
      )}
    </div>
  );
}

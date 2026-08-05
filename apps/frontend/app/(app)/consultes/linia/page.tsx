import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import type { PivotColumn, PivotRow } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import { EvolucioChart, VendesPieChart } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import { auth } from "@/lib/auth";
import {
  MESOS_CURTS,
  type VistaCompte,
  esUnMes,
  etiquetaRangMesos,
  getAnysAmbDades,
  getArbreSeleccio,
  getComparativaLn,
  getEvolucioMensual,
  parseRangMesosFromSearchParams,
  rangToQuery,
} from "@/lib/consultes";
import { etiquetaLiniaNegoci } from "@/lib/consultes-etiquetes";
import { etiquetaGrafic, indicesCentresOperatius, segmentsVendes } from "@/lib/consultes-grafics";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import {
  esLiniaFdlc,
  exclouFdlcDeConsultaLinia,
  grupMostraConsultesLiniaCentre,
} from "@/lib/grups-empresa";
import { NODE_EBITDA, NODE_INGRESSOS, NODE_VENDES, buildKpisInforme } from "@/lib/kpi-definitions";
import type { RangMesos } from "@/lib/periodes";
import { COL_REPARTIMENT_ID, aplicarGestioEvolucioLn } from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { redirect } from "next/navigation";
import { ajustarImportConsultaAction } from "../actions";
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

  if (!grupMostraConsultesLiniaCentre(grup)) {
    redirect(`/consultes/empresa?any=${anyActual}${rangToQuery(rang)}`);
  }

  const lnId = sp.ln ?? null;
  const vista: VistaCompte = sp.vista === "gestio" ? "gestio" : "directe";
  const canEdit = session?.user?.role === "ADMIN" && vista === "directe";

  const linies = exclouFdlcDeConsultaLinia(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom }))
  );

  if (lnId) {
    const lnSeleccionada = arbre.find((l) => l.id === lnId);
    if (lnSeleccionada && esLiniaFdlc(lnSeleccionada.codi)) {
      redirect(`/consultes/empresa?any=${anyActual}${rangToQuery(rang)}`);
    }
  }

  const [comp, evRaw, infoGestio] = lnId
    ? await Promise.all([
        getComparativaLn(lnId, anyActual, rang, vista),
        getEvolucioMensual("linia", lnId, anyActual),
        vista === "gestio" ? getInfoGestioConsulta(anyActual, rang) : Promise.resolve(null),
      ])
    : [null, null, null];

  let ev = evRaw;
  if (ev && vista === "gestio" && lnId) {
    ev = {
      ...ev,
      concepts: await aplicarGestioEvolucioLn(lnId, anyActual, ev.concepts),
    };
  }

  const periodeLabel = etiquetaRangMesos(rang, anyActual);
  const findEvRow = (node: number) => ev?.concepts.find((c) => c.node === node);

  // KPI = total de la LN al període (suma dels mesos seleccionats)
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
          color: "#0ea5e9",
          data: (findEvRow(NODE_INGRESSOS)?.valors ?? []).slice(rang.des - 1, rang.fins),
        },
        {
          name: "EBITDA",
          type: "line" as const,
          color: "#16a34a",
          data: (findEvRow(NODE_EBITDA)?.valors ?? []).slice(rang.des - 1, rang.fins),
        },
      ]
    : [];

  // Desglossament opcional per centres
  const centres = comp?.centres ?? [];
  const idxOperatius = indicesCentresOperatius(centres).filter(
    (i) => centres[i]?.id !== COL_REPARTIMENT_ID
  );
  const findCentreRow = (node: number) => comp?.concepts.find((c) => c.node === node);
  const columnsCentres: PivotColumn[] = centres.map((c) => ({
    key: c.id,
    label: c.codi,
    sublabel: c.nom,
  }));
  const vendesPieSegments = comp
    ? segmentsVendes(
        centres.filter((_, i) => idxOperatius.includes(i)),
        idxOperatius.map((i) => findCentreRow(NODE_VENDES)?.valors[i] ?? 0)
      )
    : [];

  const buit = !ev || ev.buit;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Compte d&apos;explotació · per línia de negoci</h1>
          <p className={styles.subtitle}>
            {comp?.liniaNegoci || ev
              ? `${comp?.liniaNegoci ? etiquetaLiniaNegoci(comp.liniaNegoci) : (ev?.titol ?? "")} — total de la línia · ${periodeLabel}${vista === "gestio" ? " · compte de gestió" : " · directe SAP"}`
              : "Selecciona una línia de negoci per veure el total del període."}
          </p>
        </div>
        <LiniaSelectors
          linies={linies}
          anys={anys.length ? anys : [anyActual]}
          lnId={lnId}
          any={anyActual}
          rang={rang}
          vista={vista}
        />
      </div>

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

          <DetallCompteCollapsible
            defaultOpen
            title="Compte de la línia (total)"
            caption={
              canEdit
                ? "Clic a una casella per veure el detall i crear un ajust a la LN."
                : "Imports totals de la línia de negoci. Cada columna és un mes del període seleccionat."
            }
          >
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

          {comp && !comp.buit && (
            <DetallCompteCollapsible
              defaultOpen={false}
              title="Desglossament per centres (opcional)"
              caption={
                vista === "gestio"
                  ? "Detall per centre. Per analitzar un sol centre, ves a Consultes → Per centre."
                  : "Detall per centre de la línia. Per analitzar un sol centre, ves a Consultes → Per centre."
              }
            >
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
                rows={comp.concepts}
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
                        ? { rang, liniaNegociId: lnId ?? undefined }
                        : { rang, mes: esUnMes(rang) ? rang.des : undefined, centreId: c.id },
                    ])
                  ),
                }}
              />
            </DetallCompteCollapsible>
          )}
        </>
      )}
    </div>
  );
}

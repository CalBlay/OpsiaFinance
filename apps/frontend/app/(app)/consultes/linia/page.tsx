import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { EvolucioChart } from "@/components/consultes/EvolucioChart";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import { type PivotColumn, PivotTable } from "@/components/consultes/PivotTable";
import { VendesPieChart } from "@/components/consultes/VendesPieChart";
import styles from "@/components/consultes/report.module.css";
import {
  MESOS_CURTS,
  MESOS_LLARGS,
  type VistaCompte,
  getAnysAmbDades,
  getArbreSeleccio,
  getComparativaLn,
  getEvolucioMensual,
} from "@/lib/consultes";
import {
  etiquetaGrafic,
  filtraValors,
  indicesCentresOperatius,
  segmentsVendes,
} from "@/lib/consultes-grafics";
import { esLiniaFdlc, exclouFdlcDeConsultaLinia } from "@/lib/grups-empresa";
import { NODE_EBITDA, NODE_INGRESSOS, NODE_VENDES, buildKpisInforme } from "@/lib/kpi-definitions";
import { COL_REPARTIMENT_ID, aplicarGestioEvolucioLn } from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { redirect } from "next/navigation";
import { LiniaSelectors } from "./LiniaSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consulta per línia de negoci — OpsiaFinance" };

const NODE_VENDES_KPI = NODE_VENDES;
const NODE_EBITDA_KPI = NODE_EBITDA;
const NODE_INGRESSOS_KPI = NODE_INGRESSOS;

export default async function ConsultaLiniaPage({
  searchParams,
}: {
  searchParams: Promise<{ ln?: string; any?: string; mes?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [arbre, anys] = await Promise.all([getArbreSeleccio(), getAnysAmbDades()]);

  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const mesActual = sp.mes ? Number(sp.mes) : null;
  const lnId = sp.ln ?? null;
  const vista: VistaCompte = sp.vista === "gestio" ? "gestio" : "directe";

  const linies = exclouFdlcDeConsultaLinia(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom }))
  );

  if (lnId) {
    const lnSeleccionada = arbre.find((l) => l.id === lnId);
    if (lnSeleccionada && esLiniaFdlc(lnSeleccionada.codi)) {
      const mesPart = mesActual ? `&mes=${mesActual}` : "";
      redirect(`/consultes/empresa?grup=fdlc&any=${anyActual}${mesPart}`);
    }
  }
  const acumulatAnual = mesActual === null;
  const [comp, evRaw, infoGestio] = lnId
    ? await Promise.all([
        getComparativaLn(lnId, anyActual, mesActual, vista),
        acumulatAnual ? getEvolucioMensual("linia", lnId, anyActual) : Promise.resolve(null),
        vista === "gestio" ? getInfoGestioConsulta(anyActual, mesActual) : Promise.resolve(null),
      ])
    : [null, null, null];

  let ev = evRaw;
  if (ev && vista === "gestio" && lnId) {
    ev = {
      ...ev,
      concepts: await aplicarGestioEvolucioLn(lnId, anyActual, ev.concepts),
    };
  }

  const columns: PivotColumn[] = (comp?.centres ?? []).map((c) => ({
    key: c.id,
    label: c.codi,
    sublabel: c.nom,
  }));

  const findRow = (node: number) => comp?.concepts.find((c) => c.node === node);
  const findEvRow = (node: number) => ev?.concepts.find((c) => c.node === node);

  const centres = comp?.centres ?? [];
  const idxOperatius = indicesCentresOperatius(centres).filter(
    (i) => centres[i]?.id !== COL_REPARTIMENT_ID
  );
  const nomsOperatius = filtraValors(centres, idxOperatius).map(etiquetaGrafic);

  const chartSeries =
    acumulatAnual && ev
      ? [
          {
            name: "Vendes",
            type: "bar" as const,
            color: "#0ea5e9",
            data: findEvRow(NODE_VENDES_KPI)?.valors ?? [],
          },
          {
            name: "EBITDA",
            type: "line" as const,
            color: "#16a34a",
            data: findEvRow(NODE_EBITDA_KPI)?.valors ?? [],
          },
        ]
      : comp
        ? [
            {
              name: "Ingressos",
              type: "bar" as const,
              color: "#0ea5e9",
              data: filtraValors(findRow(NODE_INGRESSOS_KPI)?.valors ?? [], idxOperatius),
            },
            {
              name: "EBITDA",
              type: "bar" as const,
              color: "#16a34a",
              data: filtraValors(findRow(NODE_EBITDA_KPI)?.valors ?? [], idxOperatius),
            },
          ]
        : [];

  const chartCategories = acumulatAnual ? MESOS_CURTS : nomsOperatius;
  const vendesPieSegments = comp
    ? segmentsVendes(centres, findRow(NODE_VENDES_KPI)?.valors ?? [])
    : [];

  // KPI Gestió = total del C.Explotació de la LN (centres ± traspassos + columna Repart.).
  // Sense la columna Repart. només veuries el traspass i no el pool Central → LN.
  const idxCentres = centres.map((_, i) => i).filter((i) => centres[i]?.id !== COL_REPARTIMENT_ID);
  const valorKpi = (node: number) => {
    const row = findRow(node);
    if (!row) return 0;
    if (vista === "gestio") return row.total;
    return idxCentres.reduce((s, i) => s + (row.valors[i] ?? 0), 0);
  };
  const kpis = comp ? buildKpisInforme(valorKpi) : [];
  const periodeLabel = mesActual ? MESOS_LLARGS[mesActual - 1] : `Acumulat ${anyActual}`;

  const tableCaption =
    vista === "gestio"
      ? "Compte de gestió: centres = SAP ± traspassos; columna Repartiment = pool/imputacions Central → LN. Els KPI usen el total LN (centres + Repart.)."
      : "Imports en euros. Cada columna és un centre de la línia; l'última és el total de la línia.";

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Compte d&apos;explotació · per línia de negoci</h1>
          <p className={styles.subtitle}>
            {comp?.liniaNegoci
              ? `${comp.liniaNegoci.codi} · ${comp.liniaNegoci.nom} — ${periodeLabel} ${anyActual}${vista === "gestio" ? " · compte de gestió (traspassos + repartiment)" : " · directe SAP"}`
              : "Selecciona una línia de negoci per comparar els seus centres."}
          </p>
        </div>
        <LiniaSelectors
          linies={linies}
          anys={anys.length ? anys : [anyActual]}
          lnId={lnId}
          any={anyActual}
          mes={mesActual}
          vista={vista}
        />
      </div>

      {!lnId ? (
        <div className={styles.prompt}>
          <h3>Cap línia seleccionada</h3>
          <p>
            Tria una línia de negoci per veure el compte d&apos;explotació amb un centre per
            columna.
          </p>
        </div>
      ) : comp?.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades</h3>
          <p>
            Aquesta línia no té dades per {periodeLabel.toLowerCase()} de {anyActual}.
          </p>
        </div>
      ) : (
        <>
          <GestioAvis vista={vista} info={infoGestio} />
          <KpiInformeCards kpis={kpis} periodeLabel={periodeLabel} />

          <div className={`${styles.chartGrid} ${styles.chartGridBarPie}`}>
            <div className={styles.chartCard} style={{ marginBottom: 0 }}>
              <EvolucioChart
                categories={chartCategories}
                series={chartSeries}
                tickAngle={acumulatAnual ? undefined : -32}
                height={360}
              />
            </div>
            <div
              className={`${styles.chartCard} ${styles.chartCardPie}`}
              style={{ marginBottom: 0 }}
            >
              <VendesPieChart segments={vendesPieSegments} height={360} />
            </div>
          </div>

          <DetallCompteCollapsible caption={tableCaption}>
            <PivotTable
              columns={columns}
              rows={comp!.concepts}
              totalLabel="Total LN"
              firstColLabel="Concepte"
            />
          </DetallCompteCollapsible>
        </>
      )}
    </div>
  );
}

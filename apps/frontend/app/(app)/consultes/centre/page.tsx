import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { EvolucioChart } from "@/components/consultes/EvolucioChart";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import { type PivotColumn, PivotTable } from "@/components/consultes/PivotTable";
import styles from "@/components/consultes/report.module.css";
import { auth } from "@/lib/auth";
import {
  MESOS_CURTS,
  getAnysAmbDades,
  getArbreSeleccio,
  getCompteExplotacioCentre,
} from "@/lib/consultes";
import { exclouFdlcDeConsultaLinia } from "@/lib/grups-empresa";
import { NODE_EBITDA, NODE_INGRESSOS, buildKpisInforme } from "@/lib/kpi-definitions";
import { CentreSelectors } from "./CentreSelectors";
import { ajustarImportCentreAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consulta per centre — OpsiaFinance" };

export default async function ConsultaCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ centre?: string; any?: string; ln?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [session, arbre, anys] = await Promise.all([auth(), getArbreSeleccio(), getAnysAmbDades()]);

  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const vista = sp.vista === "gestio" ? "gestio" : "directe";
  let lnId = sp.ln ?? null;
  let centreId = sp.centre ?? null;
  const canEdit = session?.user?.role === "ADMIN" && vista === "directe";

  if (centreId && !lnId) {
    for (const ln of arbre) {
      if (ln.centres.some((c) => c.id === centreId)) {
        lnId = ln.id;
        break;
      }
    }
  }

  const arbreCalBlay = exclouFdlcDeConsultaLinia(arbre);

  if (lnId) {
    const lnSeleccionada = arbre.find((l) => l.id === lnId);
    if (lnSeleccionada && !arbreCalBlay.some((l) => l.id === lnId)) {
      lnId = null;
      centreId = null;
    }
  }

  if (centreId && lnId) {
    const ln = arbreCalBlay.find((l) => l.id === lnId);
    if (ln && !ln.centres.some((c) => c.id === centreId)) centreId = null;
  }

  const compte = centreId ? await getCompteExplotacioCentre(centreId, anyActual, vista) : null;

  const columns: PivotColumn[] = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));

  const findRow = (node: number) => compte?.concepts.find((c) => c.node === node);
  const kpis = compte ? buildKpisInforme((node) => findRow(node)?.total ?? 0) : [];
  const periodeLabel = `Acumulat ${anyActual}`;

  const chartSeries = compte
    ? [
        {
          name: "Ingressos",
          type: "bar" as const,
          color: "#0ea5e9",
          data: findRow(NODE_INGRESSOS)?.valors ?? [],
        },
        {
          name: "EBITDA",
          type: "line" as const,
          color: "var(--opsia-brand, #16a34a)",
          data: findRow(NODE_EBITDA)?.valors ?? [],
        },
      ]
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Compte d&apos;explotació · per centre</h1>
          <p className={styles.subtitle}>
            {compte?.centre
              ? `${compte.centre.codi} · ${compte.centre.nom} — ${compte.centre.liniaNegoci.nom}${vista === "gestio" ? " · compte de gestió (traspassos personal)" : " · directe SAP"}`
              : "Selecciona un centre per veure el seu compte d'explotació anual, mes a mes."}
          </p>
        </div>
        <CentreSelectors
          arbre={arbreCalBlay}
          anys={anys.length ? anys : [anyActual]}
          lnId={lnId}
          centreId={centreId}
          any={anyActual}
          vista={vista}
        />
      </div>

      {!lnId ? (
        <div className={styles.prompt}>
          <h3>Cap línia seleccionada</h3>
          <p>
            Tria primer una línia de negoci i després un centre per veure el compte
            d&apos;explotació de tot l&apos;any.
          </p>
        </div>
      ) : !centreId ? (
        <div className={styles.prompt}>
          <h3>Cap centre seleccionat</h3>
          <p>
            Tria un centre de {arbreCalBlay.find((l) => l.id === lnId)?.nom ?? "la línia"} per veure
            el compte d&apos;explotació de tot l&apos;any.
          </p>
        </div>
      ) : compte?.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades per {anyActual}</h3>
          <p>
            Aquest centre no té dades carregades per l&apos;any seleccionat. Puja i processa un
            compte de resultats a la secció Dades.
          </p>
        </div>
      ) : (
        <>
          <KpiInformeCards kpis={kpis} periodeLabel={periodeLabel} />

          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Evolució mensual · Ingressos i EBITDA</h3>
            <EvolucioChart categories={MESOS_CURTS} series={chartSeries} />
          </div>

          <DetallCompteCollapsible
            caption={
              canEdit
                ? "Imports en euros. ADMIN: clic a l'import d'una fila de detall per ajustar-lo (es crea un ajust amb motiu). Els subtotals no són editables."
                : "Imports en euros. Les files ressaltades són subtotals i totals del compte."
            }
          >
            {canEdit && (
              <p className={styles.editHint}>
                Fes clic a l&apos;import ✏ d&apos;una fila de detall per corregir el valor. Pots
                escriure una operació (p.ex. <code>122052,81 + 1000</code>). Es desarà com a ajust a
                Dades → Ajustos.
              </p>
            )}
            <PivotTable
              columns={columns}
              rows={compte?.concepts ?? []}
              totalLabel="Any"
              firstColLabel="Concepte"
              canEdit={canEdit}
              editConfig={
                canEdit && centreId
                  ? { centreId, any: anyActual, onSave: ajustarImportCentreAction }
                  : undefined
              }
            />
          </DetallCompteCollapsible>
        </>
      )}
    </div>
  );
}

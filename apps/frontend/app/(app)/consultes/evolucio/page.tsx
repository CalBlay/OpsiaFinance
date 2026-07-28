import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { EvolucioChart } from "@/components/consultes/EvolucioChart";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import { type PivotColumn, PivotTable } from "@/components/consultes/PivotTable";
import styles from "@/components/consultes/report.module.css";
import {
  type AmbitEvolucio,
  MESOS_CURTS,
  getAnysAmbDades,
  getArbreSeleccio,
  getEvolucioMensual,
} from "@/lib/consultes";
import { exclouFdlcDeConsultaLinia } from "@/lib/grups-empresa";
import {
  NODE_EBITDA,
  NODE_INGRESSOS,
  buildKpisEmpresa,
  buildKpisInforme,
} from "@/lib/kpi-definitions";
import { EvolucioSelectors } from "./EvolucioSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evolució mensual — OpsiaFinance" };

export default async function EvolucioPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; ln?: string; any?: string }>;
}) {
  const sp = await searchParams;
  const [arbre, anys] = await Promise.all([getArbreSeleccio(), getAnysAmbDades()]);

  const scope: AmbitEvolucio = sp.scope === "linia" ? "linia" : "empresa";
  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const lnId = sp.ln ?? null;
  const linies = exclouFdlcDeConsultaLinia(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom }))
  );

  const necessitaLn = scope === "linia" && !lnId;
  const ev = necessitaLn ? null : await getEvolucioMensual(scope, lnId, anyActual);

  const columns: PivotColumn[] = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
  const findRow = (node: number) => ev?.concepts.find((c) => c.node === node);

  const kpis = ev
    ? scope === "empresa"
      ? buildKpisEmpresa((node) => findRow(node)?.total ?? 0)
      : buildKpisInforme((node) => findRow(node)?.total ?? 0)
    : [];
  const periodeLabel = `Acumulat ${anyActual}`;

  const chartSeries = ev
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
          color: "#16a34a",
          data: findRow(NODE_EBITDA)?.valors ?? [],
        },
      ]
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Evolució mensual</h1>
          <p className={styles.subtitle}>
            {ev ? `${ev.titol} — ${anyActual}` : "Tria l'àmbit per veure l'evolució mes a mes."}
          </p>
        </div>
        <EvolucioSelectors
          linies={linies}
          anys={anys.length ? anys : [anyActual]}
          scope={scope}
          lnId={lnId}
          any={anyActual}
        />
      </div>

      {necessitaLn ? (
        <div className={styles.prompt}>
          <h3>Selecciona una línia de negoci</h3>
          <p>Tria la línia que vols analitzar mes a mes, o canvia l'àmbit a Empresa.</p>
        </div>
      ) : ev?.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades per {anyActual}</h3>
          <p>No hi ha dades carregades per aquest àmbit i any.</p>
        </div>
      ) : (
        <>
          <KpiInformeCards kpis={kpis} periodeLabel={periodeLabel} />

          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Evolució mensual · Ingressos i EBITDA</h3>
            <EvolucioChart categories={MESOS_CURTS} series={chartSeries} />
          </div>

          <DetallCompteCollapsible caption="Imports en euros. Les files ressaltades són subtotals i totals.">
            <PivotTable
              columns={columns}
              rows={ev?.concepts ?? []}
              totalLabel="Any"
              firstColLabel="Concepte"
            />
          </DetallCompteCollapsible>
        </>
      )}
    </div>
  );
}

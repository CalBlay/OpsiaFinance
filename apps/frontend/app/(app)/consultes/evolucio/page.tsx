import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import { KpiInformeCards } from "@/components/consultes/KpiCards";
import type { PivotColumn } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import { EvolucioChart } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
import { auth } from "@/lib/auth";
import {
  type AmbitEvolucio,
  MESOS_CURTS,
  type VistaCompte,
  getAnysAmbDades,
  getArbreSeleccio,
  getEvolucioMensual,
} from "@/lib/consultes";
import {
  aplicarBaseGestioPersonalEvolucioEmpresa,
  aplicarBaseGestioPersonalEvolucioLn,
} from "@/lib/cost-personal-centre/gestio-consultes";
import { slugFilename } from "@/lib/export/filename";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import {
  exclouFdlcDeConsultaLinia,
  filtraLiniesPerGrup,
  grupMostraConsultesLiniaCentre,
  grupPermetVistaGestio,
} from "@/lib/grups-empresa";
import {
  NODE_EBITDA,
  NODE_INGRESSOS,
  buildKpisEmpresa,
  buildKpisInforme,
} from "@/lib/kpi-definitions";
import {
  aplicarGestioEvolucioEmpresa,
  aplicarGestioEvolucioLn,
} from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { ajustarImportConsultaAction } from "../actions";
import { EvolucioSelectors } from "./EvolucioSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evolució mensual — OpsiaFinance" };

export default async function EvolucioPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; ln?: string; any?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [session, arbre, anys, grup] = await Promise.all([
    auth(),
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);

  const potLinia = grupMostraConsultesLiniaCentre(grup);
  const scope: AmbitEvolucio = potLinia && sp.scope === "linia" ? "linia" : "empresa";
  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const lnId = potLinia ? (sp.ln ?? null) : null;
  const vista: VistaCompte =
    grupPermetVistaGestio(grup) && sp.vista === "gestio" ? "gestio" : "directe";
  const canEdit = session?.user?.role === "ADMIN" && vista === "directe" && scope === "linia";
  const linies = exclouFdlcDeConsultaLinia(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom }))
  );
  const lnIdsEmpresa = filtraLiniesPerGrup(
    arbre.map((l) => ({ id: l.id, codi: l.codi, nom: l.nom })),
    grup
  ).map((l) => l.id);
  const rangAny = { des: 1, fins: 12 };

  const necessitaLn = scope === "linia" && !lnId;
  const [evRaw, infoGestio] = necessitaLn
    ? [null, null]
    : await Promise.all([
        getEvolucioMensual(scope, lnId, anyActual, grup),
        vista === "gestio" ? getInfoGestioConsulta(anyActual, rangAny) : Promise.resolve(null),
      ]);

  let ev = evRaw;
  if (ev && vista === "gestio") {
    if (scope === "linia" && lnId) {
      let concepts = await aplicarBaseGestioPersonalEvolucioLn(lnId, anyActual, ev.concepts);
      concepts = await aplicarGestioEvolucioLn(lnId, anyActual, concepts);
      ev = { ...ev, concepts };
    } else if (scope === "empresa") {
      let concepts = await aplicarBaseGestioPersonalEvolucioEmpresa(anyActual, ev.concepts);
      concepts = await aplicarGestioEvolucioEmpresa(anyActual, concepts);
      ev = { ...ev, concepts };
    }
  }

  const columns: PivotColumn[] = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
  const findRow = (node: number) => ev?.concepts.find((c) => c.node === node);

  const kpis = ev
    ? scope === "empresa"
      ? buildKpisEmpresa((node) => findRow(node)?.total ?? 0)
      : buildKpisInforme((node) => findRow(node)?.total ?? 0)
    : [];
  const periodeLabel = `Acumulat ${anyActual}`;
  const vistaLabel = vista === "gestio" ? "compte de gestió" : "directe SAP";

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
            {ev
              ? `${ev.titol} — ${anyActual} · ${vistaLabel}`
              : "Tria l'àmbit per veure l'evolució mes a mes."}
          </p>
        </div>
        <div className={styles.headerActions}>
          <EvolucioSelectors
            linies={linies}
            anys={anys.length ? anys : [anyActual]}
            scope={scope}
            lnId={lnId}
            any={anyActual}
            vista={vista}
            nomesEmpresa={!potLinia}
            mostraVistaGestio={grupPermetVistaGestio(grup)}
          />
          <ExportInformeButton
            disabled={!ev || ev.buit}
            filename={slugFilename(`evolucio-${ev?.titol ?? scope}-${anyActual}`)}
            title="Evolució mensual"
            subtitle={ev ? `${ev.titol} — ${anyActual} · ${vistaLabel}` : `Acumulat ${anyActual}`}
            columns={columns}
            rows={ev?.concepts ?? []}
            totalLabel="Any"
            sheetName="Evolució"
          />
        </div>
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
          <GestioAvis vista={vista} info={infoGestio} />
          <KpiInformeCards kpis={kpis} periodeLabel={periodeLabel} />

          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Evolució mensual · Ingressos i EBITDA</h3>
            <EvolucioChart categories={MESOS_CURTS} series={chartSeries} />
          </div>

          <DetallCompteCollapsible
            caption={
              canEdit
                ? "Clic a una casella per veure el detall i crear un ajust."
                : "Imports en euros. Fes clic a un import per veure el detall. Les files ressaltades són subtotals i totals."
            }
          >
            <PivotTableDrilldown
              columns={columns}
              rows={ev?.concepts ?? []}
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
        </>
      )}
    </div>
  );
}

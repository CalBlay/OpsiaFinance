import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { KpiComparatiuCards } from "@/components/consultes/KpiCards";
import { type PivotColumn, PivotTable } from "@/components/consultes/PivotTable";
import { EvolucioChart } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import {
  filtraConceptesPerMesos,
  inferDefaultMesos,
  labelMesos,
  parseMesosParam,
  sumMesos,
  valorsMesos,
} from "@/lib/comparativa-utils";
import {
  type AmbitTemporal,
  type GranularitatTemporal,
  MESOS_CURTS,
  getAnysAmbDades,
  getArbreSeleccio,
  getComparativaMensualEntreAnys,
  getComparativaTemporal,
} from "@/lib/consultes";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { exclouFdlcDeConsultaLinia, grupMostraConsultesLiniaCentre } from "@/lib/grups-empresa";
import {
  KPI_DEFINICIONS,
  type KpiComparatiuItem,
  NODE_EBITDA,
  NODE_VENDES,
} from "@/lib/kpi-definitions";
import { ComparativaSelectors } from "./ComparativaSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comparativa temporal — OpsiaFinance" };

const NODE_VENDES_KPI = NODE_VENDES;

const ANY_COLORS = ["#6366f1", "#0ea5e9", "#f59e0b", "#ec4899"];
const EBITDA_COLORS = ["#4ade80", "#16a34a", "#84cc16", "#059669"];

const KPI_COMPARATIU = KPI_DEFINICIONS;

export default async function ComparativaPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; id?: string; g?: string; mes?: string; mesos?: string }>;
}) {
  const sp = await searchParams;
  const [arbreRaw, anys, grup] = await Promise.all([
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);
  const potLiniaCentre = grupMostraConsultesLiniaCentre(grup);
  const arbre = exclouFdlcDeConsultaLinia(arbreRaw);

  const scope: AmbitTemporal = !potLiniaCentre
    ? "empresa"
    : sp.scope === "linia"
      ? "linia"
      : sp.scope === "centre"
        ? "centre"
        : "empresa";
  const id = potLiniaCentre ? (sp.id ?? null) : null;

  const granularitat: GranularitatTemporal =
    sp.g === "mensual" ? "mensual" : sp.g === "mes" ? "mes" : "anual";
  const mesActual = sp.mes ? Number(sp.mes) : new Date().getMonth() + 1;

  const necessitaId = (scope === "linia" || scope === "centre") && !id;

  const [comp, compMensual] =
    necessitaId || anys.length === 0
      ? [null, null]
      : await Promise.all([
          granularitat !== "mensual"
            ? getComparativaTemporal(
                scope,
                id,
                {
                  granularitat,
                  anys,
                  mes: granularitat === "mes" ? mesActual : undefined,
                },
                grup
              )
            : Promise.resolve(null),
          granularitat === "mensual"
            ? getComparativaMensualEntreAnys(scope, id, anys, grup)
            : Promise.resolve(null),
        ]);

  const anysComparats = compMensual?.anys ?? [];
  const anyTaula = anysComparats[anysComparats.length - 1];

  const mesosSeleccionats = (() => {
    if (granularitat !== "mensual" || !compMensual) return [];
    const parsed = parseMesosParam(sp.mesos);
    if (parsed) return parsed;
    return inferDefaultMesos(compMensual.perAny[anyTaula], NODE_VENDES_KPI);
  })();

  const periodeLabel = mesosSeleccionats.length ? labelMesos(mesosSeleccionats) : "";

  const conceptsTaula =
    anyTaula && compMensual
      ? filtraConceptesPerMesos(compMensual.perAny[anyTaula] ?? [], mesosSeleccionats)
      : [];

  const columns: PivotColumn[] =
    granularitat === "mensual"
      ? [...mesosSeleccionats.map((m) => ({ key: String(m), label: MESOS_CURTS[m - 1] }))]
      : (comp?.columnes ?? []);

  const lastIdx = columns.length - 1;
  const prevIdx = lastIdx - 1;

  const findRow = (node: number) => {
    if (granularitat === "mensual") return conceptsTaula.find((c) => c.node === node);
    return comp?.concepts.find((c) => c.node === node);
  };

  const findRowAny = (year: number, node: number) =>
    compMensual?.perAny[year]?.find((c) => c.node === node);

  const compLabel =
    granularitat === "mensual"
      ? anyTaula
        ? `${periodeLabel} ${anyTaula}`
        : ""
      : (columns[lastIdx]?.label ?? "");

  function kpiComparatiu(node: number) {
    const pctSVendes = (kpiVal: number, vendesVal: number) =>
      vendesVal !== 0 ? (kpiVal / vendesVal) * 100 : null;

    if (granularitat === "mensual" && compMensual) {
      const anyActual = anysComparats[anysComparats.length - 1];
      const anyAnterior = anysComparats[anysComparats.length - 2];
      const rowActual = anyActual ? findRowAny(anyActual, node) : undefined;
      const rowAnterior = anyAnterior ? findRowAny(anyAnterior, node) : undefined;
      const vendesActual = anyActual ? findRowAny(anyActual, NODE_VENDES) : undefined;
      const vendesAnterior = anyAnterior ? findRowAny(anyAnterior, NODE_VENDES) : undefined;

      const totalitat = rowActual ? sumMesos(rowActual.valors, mesosSeleccionats) : 0;
      const vendesActualSum = vendesActual ? sumMesos(vendesActual.valors, mesosSeleccionats) : 0;
      const pctActual = pctSVendes(totalitat, vendesActualSum);

      if (!anyAnterior || !rowAnterior) {
        return {
          totalitat,
          totalitatAnterior: null,
          pctAnterior: null,
          pctActual,
          diferencia: null,
          refLabel: null,
          actualLabel: anyActual ? String(anyActual) : null,
        };
      }

      const anteriorSum = sumMesos(rowAnterior.valors, mesosSeleccionats);
      const vendesAnteriorSum = vendesAnterior
        ? sumMesos(vendesAnterior.valors, mesosSeleccionats)
        : 0;

      return {
        totalitat,
        totalitatAnterior: anteriorSum,
        pctAnterior: pctSVendes(anteriorSum, vendesAnteriorSum),
        pctActual,
        diferencia: totalitat - anteriorSum,
        refLabel: String(anyAnterior),
        actualLabel: String(anyActual),
      };
    }

    const row = findRow(node);
    const vendesRow = findRow(NODE_VENDES);
    if (!row || !vendesRow || !comp) {
      return {
        totalitat: 0,
        totalitatAnterior: null,
        pctAnterior: null,
        pctActual: null,
        diferencia: null,
        refLabel: null,
        actualLabel: null,
      };
    }

    const actualLabel = columns[lastIdx]?.label ?? null;
    const refLabel = prevIdx >= 0 ? (columns[prevIdx]?.label ?? null) : null;
    const actual = row.valors[lastIdx] ?? 0;
    const pctActual = pctSVendes(actual, vendesRow.valors[lastIdx] ?? 0);

    if (prevIdx < 0) {
      return {
        totalitat: row.valors[lastIdx] ?? row.total,
        totalitatAnterior: null,
        pctAnterior: null,
        pctActual,
        diferencia: null,
        refLabel: null,
        actualLabel,
      };
    }

    const anterior = row.valors[prevIdx] ?? 0;
    return {
      totalitat: row.valors[lastIdx] ?? row.total,
      totalitatAnterior: anterior,
      pctAnterior: pctSVendes(anterior, vendesRow.valors[prevIdx] ?? 0),
      pctActual,
      diferencia: actual - anterior,
      refLabel,
      actualLabel,
    };
  }

  const kpisRaw =
    comp || compMensual
      ? KPI_COMPARATIU.map((k) => ({ label: k.label, tipus: k.tipus, ...kpiComparatiu(k.node) }))
      : ([] as Array<{
          label: string;
          tipus: KpiComparatiuItem["tipus"];
          totalitat: number;
          totalitatAnterior: number | null;
          pctAnterior: number | null;
          pctActual: number | null;
          diferencia: number | null;
          refLabel: string | null;
          actualLabel: string | null;
        }>);

  const kpis: KpiComparatiuItem[] = kpisRaw.map((k) => ({
    label: k.label,
    tipus: k.tipus,
    totalitat: k.totalitat,
    totalitatAnterior:
      k.totalitatAnterior ?? (k.diferencia !== null ? k.totalitat - k.diferencia : null),
    diferencia: k.diferencia,
    refLabel: k.refLabel,
    actualLabel: k.actualLabel,
    pctActual: k.pctActual,
    pctAnterior: k.pctAnterior,
  }));

  const chartCategories =
    granularitat === "mensual" ? KPI_COMPARATIU.map((k) => k.label) : columns.map((c) => c.label);

  const mesChartCategories = mesosSeleccionats.map((m) => MESOS_CURTS[m - 1]);

  const periodChartSeries =
    granularitat === "mensual" && compMensual
      ? anysComparats.map((year, i) => ({
          name: String(year),
          type: "bar" as const,
          color: ANY_COLORS[i % ANY_COLORS.length],
          data: KPI_COMPARATIU.map((k) => {
            const row = findRowAny(year, k.node);
            return row ? sumMesos(row.valors, mesosSeleccionats) : 0;
          }),
        }))
      : [];

  const mesChartSeries =
    granularitat === "mensual" && compMensual
      ? anysComparats.flatMap((year, i) => {
          const vendesRow = findRowAny(year, NODE_VENDES);
          const ebitdaRow = findRowAny(year, NODE_EBITDA);
          return [
            {
              name: `Vendes ${year}`,
              type: "bar" as const,
              color: ANY_COLORS[i % ANY_COLORS.length],
              data: vendesRow
                ? valorsMesos(vendesRow.valors, mesosSeleccionats)
                : mesosSeleccionats.map(() => 0),
            },
            {
              name: `EBITDA ${year}`,
              type: "line" as const,
              color: EBITDA_COLORS[i % EBITDA_COLORS.length],
              data: ebitdaRow
                ? valorsMesos(ebitdaRow.valors, mesosSeleccionats)
                : mesosSeleccionats.map(() => 0),
            },
          ];
        })
      : [];

  const chartSeries =
    granularitat === "mensual"
      ? periodChartSeries
      : comp
        ? [
            {
              name: "Vendes",
              type: "bar" as const,
              color: "#0ea5e9",
              data: findRow(NODE_VENDES)?.valors ?? [],
            },
            {
              name: "EBITDA",
              type: "line" as const,
              color: "#16a34a",
              data: findRow(NODE_EBITDA)?.valors ?? [],
            },
          ]
        : [];

  const periodChartTitle = `Totals del període · ${periodeLabel} · ${anysComparats.join(" vs ")}`;
  const mesChartTitle = `Vendes i EBITDA mes a mes · ${anysComparats.join(" vs ")}`;

  const chartTitle =
    granularitat === "mensual"
      ? periodChartTitle
      : comp?.granularitat === "mes"
        ? "Vendes i EBITDA · mateix mes entre anys"
        : "Vendes i EBITDA per any";

  const periodeDesc =
    granularitat === "mensual" && compMensual
      ? `${periodeLabel} · ${anysComparats.join(" vs ")}`
      : comp?.periodeDesc;

  const titol = granularitat === "mensual" ? compMensual?.titol : comp?.titol;
  const buit = granularitat === "mensual" ? compMensual?.buit : comp?.buit;

  const tableCaption =
    granularitat === "mensual"
      ? `Imports en euros del període seleccionat (taula de ${anyTaula ?? "—"}). El gràfic compara ${anysComparats.join(" i ")} per als mateixos mesos.`
      : comp?.granularitat === "mes"
        ? "Imports en euros d'un mateix mes per any. Les files ressaltades són subtotals."
        : "Imports en euros (acumulat anual de cada exercici). Les files ressaltades són subtotals.";

  const pivotRows = granularitat === "mensual" ? conceptsTaula : (comp?.concepts ?? []);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Comparativa temporal</h1>
          <p className={styles.subtitle}>
            {titol && periodeDesc
              ? `${titol} — ${periodeDesc}`
              : "Tria un àmbit per comparar-lo al llarg del temps."}
          </p>
        </div>
        <ComparativaSelectors
          arbre={arbre}
          scope={scope}
          id={id}
          granularitat={granularitat}
          mes={mesActual}
          mesosSeleccionats={mesosSeleccionats}
          nomesEmpresa={!potLiniaCentre}
        />
      </div>

      {necessitaId ? (
        <div className={styles.prompt}>
          <h3>Selecciona {scope === "linia" ? "una línia" : "un centre"}</h3>
          <p>Tria l'element que vols comparar al llarg del temps.</p>
        </div>
      ) : buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades</h3>
          <p>Encara no hi ha prou dades carregades per comparar períodes.</p>
        </div>
      ) : (
        <>
          {granularitat === "anual" && columns.length === 1 && (
            <p className={styles.tableCaption} style={{ marginBottom: "1rem" }}>
              Només hi ha dades d'un any ({columns[0].label}). Carrega més exercicis o canvia a
              granularitat per període.
            </p>
          )}

          <KpiComparatiuCards
            kpis={kpis}
            periodeLabel={granularitat === "mensual" ? periodeLabel : compLabel}
          />

          {granularitat === "mensual" ? (
            <div className={styles.chartGrid}>
              <div className={styles.chartCard} style={{ marginBottom: 0 }}>
                <h3 className={styles.chartTitle}>{mesChartTitle}</h3>
                <EvolucioChart
                  categories={mesChartCategories}
                  series={mesChartSeries}
                  height={320}
                />
              </div>
              <div className={styles.chartCard} style={{ marginBottom: 0 }}>
                <h3 className={styles.chartTitle}>{periodChartTitle}</h3>
                <EvolucioChart
                  categories={chartCategories}
                  series={periodChartSeries}
                  height={320}
                />
              </div>
            </div>
          ) : (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{chartTitle}</h3>
              <EvolucioChart categories={chartCategories} series={chartSeries} />
            </div>
          )}

          {granularitat === "mensual" ? (
            <DetallCompteCollapsible caption={tableCaption}>
              <PivotTable
                columns={columns}
                rows={pivotRows}
                showTotal
                totalLabel="Període"
                firstColLabel="Concepte"
              />
            </DetallCompteCollapsible>
          ) : (
            <DetallCompteCollapsible caption={tableCaption}>
              <PivotTable columns={columns} rows={pivotRows} firstColLabel="Concepte" />
            </DetallCompteCollapsible>
          )}
        </>
      )}
    </div>
  );
}

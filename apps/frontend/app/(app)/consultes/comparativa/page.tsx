import { ConsultaHeader } from "@/components/consultes/ConsultaHeader";
import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { type PivotColumn, PivotTable } from "@/components/consultes/PivotTable";
import {
  type KpiPesEmpresa,
  type PesLnComparativa,
  PresentacioComparativa,
  type SerieComparativaAny,
  type SerieComparativaMes,
} from "@/components/consultes/PresentacioComparativa";
import styles from "@/components/consultes/report.module.css";
import { ExportInformeButton } from "@/components/export/ExportInformeButton";
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
  MAX_ANYS_COMPARATIVA,
  MESOS_CURTS,
  getAnysAmbDades,
  getArbreSeleccio,
  getComparativaEmpresa,
  getComparativaMensualEntreAnys,
  getComparativaTemporal,
} from "@/lib/consultes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import { slugFilename } from "@/lib/export/filename";
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { liniesPerConsultaDetall } from "@/lib/grups-empresa";
import {
  KPI_DEFINICIONS,
  type KpiComparatiuItem,
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_VENDES,
} from "@/lib/kpi-definitions";
import { ComparativaSelectors } from "./ComparativaSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comparativa temporal — OpsiaFinance" };

const NODE_VENDES_KPI = NODE_VENDES;
const KPI_COMPARATIU = KPI_DEFINICIONS;

function valorNode(
  find: (node: number) => { valors: number[] } | undefined,
  node: number,
  idx: number
): number {
  return find(node)?.valors[idx] ?? 0;
}

function pesPct(vendesLn: number, vendesEmp: number): number | null {
  if (vendesEmp === 0) return null;
  return (vendesLn / vendesEmp) * 100;
}

export default async function ComparativaPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; id?: string; g?: string; mes?: string; mesos?: string }>;
}) {
  const sp = await searchParams;
  const [arbreRaw, anysTots, grup] = await Promise.all([
    getArbreSeleccio(),
    getAnysAmbDades(),
    getGrupEmpresaActual(),
  ]);
  const anys = anysTots.slice(0, MAX_ANYS_COMPARATIVA);
  const arbre = liniesPerConsultaDetall(arbreRaw, grup);

  const scope: AmbitTemporal =
    sp.scope === "linia" ? "linia" : sp.scope === "centre" ? "centre" : "empresa";
  const id = sp.id ?? null;
  const esLn = scope === "linia";

  const granularitat: GranularitatTemporal =
    sp.g === "mensual" ? "mensual" : sp.g === "mes" ? "mes" : "anual";
  const mesActual = sp.mes ? Number(sp.mes) : new Date().getMonth() + 1;

  const necessitaId = (scope === "linia" || scope === "centre") && !id;

  const [comp, compMensual, compEmp, compMensualEmp] =
    necessitaId || anys.length === 0
      ? [null, null, null, null]
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
          esLn && granularitat !== "mensual"
            ? getComparativaTemporal(
                "empresa",
                null,
                {
                  granularitat,
                  anys,
                  mes: granularitat === "mes" ? mesActual : undefined,
                },
                grup
              )
            : Promise.resolve(null),
          esLn && granularitat === "mensual"
            ? getComparativaMensualEntreAnys("empresa", null, anys, grup)
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

  const findRowEmp = (node: number) => compEmp?.concepts.find((c) => c.node === node);

  const findRowAnyEmp = (year: number, node: number) =>
    compMensualEmp?.perAny[year]?.find((c) => c.node === node);

  const vendesEmpresaPerColumna = (idx: number): number => {
    if (granularitat === "mensual") return 0;
    return valorNode(findRowEmp, NODE_VENDES, idx);
  };

  const vendesEmpresaPerAny = (year: number): number => {
    const row = findRowAnyEmp(year, NODE_VENDES);
    return row ? sumMesos(row.valors, mesosSeleccionats) : 0;
  };

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

  const kpisDefs = esLn ? KPI_COMPARATIU.filter((k) => k.tipus === "vendes") : KPI_COMPARATIU;

  const kpisRaw =
    comp || compMensual
      ? kpisDefs.map((k) => ({ label: k.label, tipus: k.tipus, ...kpiComparatiu(k.node) }))
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

  const perAny: SerieComparativaAny[] =
    granularitat === "mensual" && compMensual
      ? anysComparats.map((year) => {
          const vendes = (() => {
            const row = findRowAny(year, NODE_VENDES);
            return row ? sumMesos(row.valors, mesosSeleccionats) : 0;
          })();
          const vendesEmpresa = esLn ? vendesEmpresaPerAny(year) : 0;
          return {
            label: String(year),
            vendes,
            ebitda: (() => {
              const row = findRowAny(year, NODE_EBITDA);
              return row ? sumMesos(row.valors, mesosSeleccionats) : 0;
            })(),
            personal: (() => {
              const row = findRowAny(year, NODE_COST_SALARIAL);
              return row ? sumMesos(row.valors, mesosSeleccionats) : 0;
            })(),
            compres: (() => {
              const row = findRowAny(year, NODE_COMPRES);
              return row ? sumMesos(row.valors, mesosSeleccionats) : 0;
            })(),
            gestio: (() => {
              const row = findRowAny(year, NODE_COST_GESTIO);
              return row ? sumMesos(row.valors, mesosSeleccionats) : 0;
            })(),
            vendesEmpresa: esLn ? vendesEmpresa : undefined,
            pesEmpresa: esLn ? pesPct(vendes, vendesEmpresa) : undefined,
          };
        })
      : (comp?.columnes ?? []).map((col, idx) => {
          const vendes = valorNode(findRow, NODE_VENDES, idx);
          const vendesEmpresa = esLn ? vendesEmpresaPerColumna(idx) : 0;
          return {
            label: col.label,
            vendes,
            ebitda: valorNode(findRow, NODE_EBITDA, idx),
            personal: valorNode(findRow, NODE_COST_SALARIAL, idx),
            compres: valorNode(findRow, NODE_COMPRES, idx),
            gestio: valorNode(findRow, NODE_COST_GESTIO, idx),
            vendesEmpresa: esLn ? vendesEmpresa : undefined,
            pesEmpresa: esLn ? pesPct(vendes, vendesEmpresa) : undefined,
          };
        });

  const mensual: SerieComparativaMes[] | null =
    granularitat === "mensual" && compMensual
      ? mesosSeleccionats.map((m, i) => {
          const row: SerieComparativaMes = { mes: MESOS_CURTS[m - 1] };
          for (const year of anysComparats) {
            const vendesRow = findRowAny(year, NODE_VENDES);
            const ebitdaRow = findRowAny(year, NODE_EBITDA);
            const vv = vendesRow ? valorsMesos(vendesRow.valors, mesosSeleccionats) : [];
            const ee = ebitdaRow ? valorsMesos(ebitdaRow.valors, mesosSeleccionats) : [];
            row[`v_${year}`] = vv[i] ?? 0;
            if (!esLn) row[`e_${year}`] = ee[i] ?? 0;
          }
          return row;
        })
      : null;

  const vendesKpi = kpis.find((k) => k.tipus === "vendes");
  let pesEmpresa: KpiPesEmpresa | null = null;
  if (esLn && vendesKpi) {
    const empActual =
      granularitat === "mensual" && anyTaula
        ? vendesEmpresaPerAny(anyTaula)
        : lastIdx >= 0
          ? vendesEmpresaPerColumna(lastIdx)
          : 0;
    const anyAnterior =
      granularitat === "mensual" && anysComparats.length >= 2
        ? anysComparats[anysComparats.length - 2]
        : undefined;
    const empAnterior =
      granularitat === "mensual" && anyAnterior !== undefined
        ? vendesEmpresaPerAny(anyAnterior)
        : prevIdx >= 0
          ? vendesEmpresaPerColumna(prevIdx)
          : null;

    pesEmpresa = {
      pesActual: pesPct(vendesKpi.totalitat, empActual),
      pesAnterior:
        empAnterior !== null && vendesKpi.totalitatAnterior !== null
          ? pesPct(vendesKpi.totalitatAnterior, empAnterior)
          : null,
      vendesEmpresa: empActual,
      vendesEmpresaAnterior: empAnterior,
      refLabel: vendesKpi.refLabel,
      actualLabel: vendesKpi.actualLabel,
    };
  }

  const periodeDesc =
    granularitat === "mensual" && compMensual
      ? `${periodeLabel} · ${anysComparats.join(" vs ")}`
      : comp?.periodeDesc;

  const titol = granularitat === "mensual" ? compMensual?.titol : comp?.titol;
  const buit = granularitat === "mensual" ? compMensual?.buit : comp?.buit;

  const pivotRows = granularitat === "mensual" ? conceptsTaula : (comp?.concepts ?? []);

  let pesLn: PesLnComparativa | null = null;
  if (scope === "empresa" && !buit) {
    const anysPesLn =
      granularitat === "mensual"
        ? anysComparats
        : (comp?.columnes ?? []).map((c) => Number(c.label)).filter((y) => Number.isFinite(y));

    const rangPesLn =
      granularitat === "mensual" && mesosSeleccionats.length > 0
        ? {
            des: Math.min(...mesosSeleccionats),
            fins: Math.max(...mesosSeleccionats),
          }
        : granularitat === "mes"
          ? { des: mesActual, fins: mesActual }
          : { des: 1, fins: 12 };

    if (anysPesLn.length > 0) {
      const cmpLnAnys = await Promise.all(
        anysPesLn.map((y) => getComparativaEmpresa(y, rangPesLn, "directe", grup))
      );
      const ref = cmpLnAnys.find((c) => !c.buit && c.linies.length > 0) ?? cmpLnAnys[0];
      if (ref && ref.linies.length > 0) {
        const linies = ref.linies.map((l) => ({
          key: l.id,
          name: etiquetaGrafic(l),
        }));
        const perAny: PesLnComparativa["perAny"] = [];

        for (const cmpY of cmpLnAnys) {
          const vendesRow = cmpY.concepts.find((c) => c.node === NODE_VENDES);
          if (!vendesRow) continue;
          const segments: PesLnComparativa["perAny"][number]["segments"] = [];
          cmpY.linies.forEach((ln, i) => {
            const v = vendesRow.valors[i] ?? 0;
            if (v !== 0) {
              segments.push({ key: ln.id, name: etiquetaGrafic(ln), value: v });
            }
          });
          perAny.push({ label: String(cmpY.any), segments });
        }

        if (perAny.some((p) => p.segments.length > 0)) {
          pesLn = {
            linies,
            perAny,
          };
        }
      }
    }
  }

  return (
    <div className={styles.page}>
      <ConsultaHeader
        title="Comparativa temporal"
        subtitle={
          titol && periodeDesc
            ? `${titol} — ${periodeDesc}`
            : "Tria un àmbit per comparar-lo al llarg del temps."
        }
        actions={
          <>
            <ComparativaSelectors
              arbre={arbre}
              scope={scope}
              id={id}
              granularitat={granularitat}
              mes={mesActual}
              mesosSeleccionats={mesosSeleccionats}
              nomesEmpresa={false}
            />
            <ExportInformeButton
              disabled={!!necessitaId || !!buit}
              filename={slugFilename(
                `comparativa-${titol ?? scope}-${periodeDesc ?? granularitat}`
              )}
              title="Comparativa temporal"
              subtitle={titol && periodeDesc ? `${titol} — ${periodeDesc}` : undefined}
              columns={columns}
              rows={pivotRows}
              showTotal={granularitat === "mensual"}
              totalLabel="Període"
              sheetName="Comparativa"
            />
          </>
        }
      />

      {necessitaId ? (
        <div className={styles.prompt}>
          <h3>Selecciona {scope === "linia" ? "una línia" : "un centre"}</h3>
          <p>Tria l&apos;element que vols comparar al llarg del temps.</p>
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
              Només hi ha dades d&apos;un any ({columns[0].label}). Carrega més exercicis o canvia a
              granularitat per període.
            </p>
          )}

          <PresentacioComparativa
            titol={titol ?? "Comparativa"}
            periode={periodeDesc ?? ""}
            kpis={kpis}
            periodeLabelKpi={granularitat === "mensual" ? periodeLabel : compLabel}
            perAny={perAny}
            mensual={mensual}
            anysMensual={anysComparats}
            mode={granularitat}
            ambit={esLn ? "linia" : "general"}
            pesEmpresa={pesEmpresa}
            pesLn={pesLn}
          />

          <DetallCompteCollapsible title="Obrir compte d'explotació detallat">
            <PivotTable
              columns={columns}
              rows={pivotRows}
              showTotal={granularitat === "mensual"}
              totalLabel="Període"
              firstColLabel="Concepte"
            />
          </DetallCompteCollapsible>
        </>
      )}
    </div>
  );
}

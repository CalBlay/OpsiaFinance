import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { EvolucioChart } from "@/components/consultes/EvolucioChart";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import type { PivotColumn } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import { type KpiComite, PresentacioComite } from "@/components/consultes/PresentacioComite";
import styles from "@/components/consultes/report.module.css";
import {
  MESOS_CURTS,
  MESOS_LLARGS,
  type VistaCompte,
  esAnyComplet,
  esUnMes,
  etiquetaRangMesos,
  etiquetaRangMesosLlarga,
  getAnysAmbDades,
  getComparativaEmpresa,
  getEvolucioMensual,
  parseRangMesosFromSearchParams,
} from "@/lib/consultes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import { etiquetaGrupEmpresa, parseGrupEmpresa } from "@/lib/grups-empresa";
import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_INGRESSOS,
  NODE_VENDES,
  buildKpisEmpresa,
} from "@/lib/kpi-definitions";
import { aplicarGestioEvolucioEmpresa } from "@/lib/repartiment/gestio-consultes";
import { getInfoGestioConsulta } from "@/lib/repartiment/service";
import { formatNum } from "@/lib/utils";
import { EmpresaSelectors } from "./EmpresaSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consulta d'empresa — OpsiaFinance" };

function pctSobreIngressos(cost: number, ingressos: number): string | undefined {
  if (!ingressos) return undefined;
  return `${formatNum((Math.abs(cost) / Math.abs(ingressos)) * 100, 1)}% s/ ingressos`;
}

export default async function ConsultaEmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{
    any?: string;
    mes?: string;
    des?: string;
    fins?: string;
    vista?: string;
    grup?: string;
  }>;
}) {
  const sp = await searchParams;
  const grup = parseGrupEmpresa(sp.grup);
  const anys = await getAnysAmbDades();
  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const rang = parseRangMesosFromSearchParams(sp);
  const vista: VistaCompte =
    grup === "fdlc" ? "directe" : sp.vista === "gestio" ? "gestio" : "directe";
  const acumulatAnual = esAnyComplet(rang);
  const unMes = esUnMes(rang);
  const esPresentacioCalblay = grup === "calblay";

  const comp = await getComparativaEmpresa(anyActual, rang, vista, grup);
  const fdlcLnId = grup === "fdlc" ? (comp.linies[0]?.id ?? null) : null;

  const [evFdlc, evEmpresaRaw, infoGestio] = await Promise.all([
    grup === "fdlc" && acumulatAnual
      ? getEvolucioMensual("empresa", null, anyActual, "fdlc")
      : Promise.resolve(null),
    esPresentacioCalblay ? getEvolucioMensual("empresa", null, anyActual) : Promise.resolve(null),
    vista === "gestio" && grup === "calblay"
      ? getInfoGestioConsulta(anyActual, rang)
      : Promise.resolve(null),
  ]);

  let evEmpresa = evEmpresaRaw;
  if (evEmpresa && vista === "gestio") {
    evEmpresa = {
      ...evEmpresa,
      concepts: await aplicarGestioEvolucioEmpresa(anyActual, evEmpresa.concepts),
    };
  }

  const findRow = (node: number) => comp.concepts.find((c) => c.node === node);
  const findEvRow = (node: number) => evFdlc?.concepts.find((c) => c.node === node);
  const findEvEmpresa = (node: number) => evEmpresa?.concepts.find((c) => c.node === node);

  // KPIs i taula han de sortir de la mateixa font quan mostrem evolució mensual FDLC.
  const kpis = buildKpisEmpresa((node) =>
    grup === "fdlc" && acumulatAnual && evFdlc
      ? (findEvRow(node)?.total ?? 0)
      : (findRow(node)?.total ?? 0)
  );

  let columns: PivotColumn[];
  let pivotRows = comp.concepts;
  let totalLabel: string;
  let chartCategories: string[];
  let chartSeries: { name: string; type: "bar" | "line"; color: string; data: number[] }[];
  let chartTickAngle: number | undefined;

  if (grup === "fdlc" && acumulatAnual && evFdlc) {
    columns = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
    pivotRows = evFdlc.concepts;
    totalLabel = "Any";
    chartCategories = MESOS_CURTS;
    chartSeries = [
      { name: "Vendes", type: "bar", color: "#0ea5e9", data: findEvRow(NODE_VENDES)?.valors ?? [] },
      {
        name: "EBITDA",
        type: "line",
        color: "#16a34a",
        data: findEvRow(NODE_EBITDA)?.valors ?? [],
      },
    ];
    chartTickAngle = 0;
  } else if (grup === "fdlc" && !acumulatAnual) {
    const periodeNom = unMes
      ? (MESOS_LLARGS[rang.des - 1] ?? "")
      : etiquetaRangMesos(rang, anyActual);
    columns = [{ key: "fdlc", label: periodeNom, sublabel: String(anyActual) }];
    pivotRows = comp.concepts.map((c) => ({ ...c, valors: [c.total], total: c.total }));
    totalLabel = "FDLC";
    chartCategories = [periodeNom];
    chartSeries = [
      { name: "Vendes", type: "bar", color: "#0ea5e9", data: [findRow(NODE_VENDES)?.total ?? 0] },
      { name: "EBITDA", type: "bar", color: "#16a34a", data: [findRow(NODE_EBITDA)?.total ?? 0] },
    ];
    chartTickAngle = 0;
  } else {
    columns = comp.linies.map((l) => ({ key: l.id, label: l.codi, sublabel: l.nom }));
    totalLabel = "Empresa";
    chartCategories = comp.linies.map(etiquetaGrafic);
    chartSeries = [
      { name: "Vendes", type: "bar", color: "#0ea5e9", data: findRow(NODE_VENDES)?.valors ?? [] },
      { name: "EBITDA", type: "bar", color: "#16a34a", data: findRow(NODE_EBITDA)?.valors ?? [] },
    ];
    chartTickAngle = -28;
  }

  // Drill-down config: depèn del tipus de columnes
  type DrilldownColumnMap = {
    [colKey: string]: {
      mes?: number;
      rang?: { des: number; fins: number };
      liniaNegociId?: string;
    };
  };
  const drilldownColMap: DrilldownColumnMap = {};
  const lnIdsGrup = comp.linies.map((l) => l.id);
  if (grup === "fdlc" && acumulatAnual) {
    // Columnes = mesos; mateix filtre de grup que la taula (sense LN individual).
    for (let i = 0; i < 12; i++) drilldownColMap[String(i)] = { mes: i + 1 };
  } else if (grup === "fdlc" && !acumulatAnual) {
    drilldownColMap.fdlc = { rang, liniaNegociId: fdlcLnId ?? undefined };
  } else {
    // Columnes = línies de negoci (key = lnId)
    for (const l of comp.linies) drilldownColMap[l.id] = { rang, liniaNegociId: l.id };
  }

  const periodeLabel = etiquetaRangMesos(rang, anyActual);
  const periodePresentacio = etiquetaRangMesosLlarga(rang, anyActual);
  const nomEmpresa = etiquetaGrupEmpresa(grup);

  const ingressosTotal = findRow(NODE_INGRESSOS)?.total ?? 0;
  const personalTotal = findRow(NODE_COST_SALARIAL)?.total ?? 0;
  const compresTotal = findRow(NODE_COMPRES)?.total ?? 0;
  const gestioTotal = findRow(NODE_COST_GESTIO)?.total ?? 0;
  const ebitdaTotal = findRow(NODE_EBITDA)?.total ?? 0;

  const kpisComite: KpiComite[] = [
    {
      label: "Ingressos",
      import_: ingressosTotal,
      hint: "Explotació",
      accent: "ingressos",
    },
    {
      label: "Personal",
      import_: personalTotal,
      hint: pctSobreIngressos(personalTotal, ingressosTotal),
      accent: "cost",
    },
    {
      label: "Compres",
      import_: compresTotal,
      hint: pctSobreIngressos(compresTotal, ingressosTotal),
      accent: "cost",
    },
    {
      label: "Gestió",
      import_: gestioTotal,
      hint: pctSobreIngressos(gestioTotal, ingressosTotal),
      accent: "cost",
    },
    {
      label: "EBITDA",
      import_: ebitdaTotal,
      hint: pctSobreIngressos(ebitdaTotal, ingressosTotal),
      accent: "ebitda",
    },
  ];

  const tableCaption =
    grup === "fdlc" && acumulatAnual
      ? "Compte d'explotació FDLC — vista general amb desglossament mensual (columnes = mesos)."
      : grup === "fdlc"
        ? `Compte d'explotació FDLC — ${periodeLabel}.`
        : vista === "gestio"
          ? "Cada columna és una LN (mateix criteri que Evolució/Per línia). El total Empresa elimina dobles còmputs interns (consolidació)."
          : "Cada columna és una LN (mateix criteri que Evolució/Per línia). El total Empresa elimina dobles còmputs interns (consolidació).";

  const chartTitle =
    grup === "fdlc" && acumulatAnual
      ? "Evolució mensual · Vendes i EBITDA"
      : grup === "fdlc"
        ? `${periodeLabel} · Vendes i EBITDA`
        : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>
            {esPresentacioCalblay
              ? `Resultats · ${nomEmpresa}`
              : `Compte d'explotació · ${nomEmpresa}`}
          </h1>
          <p className={styles.subtitle}>
            {grup === "fdlc"
              ? acumulatAnual
                ? `Empresa FDLC — general (acumulat ${anyActual}) · evolució per mesos`
                : `Empresa FDLC — ${periodeLabel}`
              : vista === "gestio"
                ? `Gestió: mateix total que Directe, costos repartits entre LN — ${periodePresentacio}`
                : `Directe: costos tal com venen (sovint concentrats a Central) — ${periodePresentacio}`}
          </p>
        </div>
        <EmpresaSelectors
          anys={anys.length ? anys : [anyActual]}
          any={anyActual}
          rang={rang}
          vista={vista}
          grup={grup}
        />
      </div>

      {comp.buit ? (
        <div className={styles.prompt}>
          <h3>Sense dades</h3>
          <p>
            No hi ha dades de {nomEmpresa} per {periodeLabel.toLowerCase()}.
          </p>
        </div>
      ) : (
        <>
          {esPresentacioCalblay ? (
            <>
              <GestioAvis vista={vista} info={infoGestio} />
              <PresentacioComite
                titol={
                  vista === "gestio"
                    ? "Com va el grup (gestió · costos repartits)"
                    : "Com va el grup (directe)"
                }
                periode={periodePresentacio}
                kpis={kpisComite}
                mensual={{
                  mesos: [...MESOS_CURTS],
                  ingressos: findEvEmpresa(NODE_INGRESSOS)?.valors ?? [],
                  ebitda: findEvEmpresa(NODE_EBITDA)?.valors ?? [],
                  personal: findEvEmpresa(NODE_COST_SALARIAL)?.valors ?? [],
                  compres: findEvEmpresa(NODE_COMPRES)?.valors ?? [],
                  gestio: findEvEmpresa(NODE_COST_GESTIO)?.valors ?? [],
                }}
                perLn={{
                  etiquetes: comp.linies.map(etiquetaGrafic),
                  ingressos: findRow(NODE_INGRESSOS)?.valors ?? [],
                  ebitda: findRow(NODE_EBITDA)?.valors ?? [],
                  personal: findRow(NODE_COST_SALARIAL)?.valors ?? [],
                  compres: findRow(NODE_COMPRES)?.valors ?? [],
                  gestio: findRow(NODE_COST_GESTIO)?.valors ?? [],
                }}
              />
            </>
          ) : (
            <>
              <KpiInformeCardsFallback kpis={kpis} periodeLabel={periodeLabel} />
              <div className={styles.chartCard}>
                {chartTitle && <h3 className={styles.chartTitle}>{chartTitle}</h3>}
                <EvolucioChart
                  categories={chartCategories}
                  series={chartSeries}
                  tickAngle={chartTickAngle}
                  height={360}
                />
              </div>
            </>
          )}

          <DetallCompteCollapsible caption={tableCaption} defaultOpen={false}>
            <PivotTableDrilldown
              columns={columns}
              rows={pivotRows}
              totalLabel={totalLabel}
              firstColLabel="Concepte"
              drilldown={{
                any: anyActual,
                colMap: drilldownColMap,
                // Sempre passar el grup de LN de la vista (Cal Blay o FDLC) per excloure l'altra empresa.
                lnIdsGrup,
              }}
            />
          </DetallCompteCollapsible>
        </>
      )}
    </div>
  );
}

/** Evita import circular / manté FDLC amb les targetes clàssiques. */
async function KpiInformeCardsFallback({
  kpis,
  periodeLabel,
}: {
  kpis: ReturnType<typeof buildKpisEmpresa>;
  periodeLabel: string;
}) {
  const { KpiInformeCards } = await import("@/components/consultes/KpiCards");
  return <KpiInformeCards kpis={kpis} periodeLabel={periodeLabel} />;
}

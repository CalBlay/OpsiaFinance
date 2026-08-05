import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import type { PivotColumn } from "@/components/consultes/PivotTable";
import { PivotTableDrilldown } from "@/components/consultes/PivotTableDrilldown";
import type { KpiComite } from "@/components/consultes/PresentacioComite";
import { EvolucioChart, PresentacioComite } from "@/components/consultes/charts-dynamic";
import styles from "@/components/consultes/report.module.css";
import { auth } from "@/lib/auth";
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
import { getGrupEmpresaActual } from "@/lib/grup-cookie";
import { etiquetaGrupEmpresa, grupPermetVistaGestio } from "@/lib/grups-empresa";
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
import { ajustarImportConsultaAction } from "../actions";
import { EmpresaSelectors } from "./EmpresaSelectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resultats d'empresa — OpsiaFinance" };

function pctSobreIngressos(
  valor: number,
  ingressos: number,
  opts?: { signed?: boolean }
): string | undefined {
  if (!ingressos) return undefined;
  const pct = opts?.signed
    ? (valor / Math.abs(ingressos)) * 100
    : (Math.abs(valor) / Math.abs(ingressos)) * 100;
  return `${formatNum(pct, 1)}% s/ ingressos`;
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
  const [session, grup, anys] = await Promise.all([
    auth(),
    getGrupEmpresaActual(),
    getAnysAmbDades(),
  ]);
  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const rang = parseRangMesosFromSearchParams(sp);
  const vista: VistaCompte =
    grupPermetVistaGestio(grup) && sp.vista === "gestio" ? "gestio" : "directe";
  const acumulatAnual = esAnyComplet(rang);
  const unMes = esUnMes(rang);
  const esPresentacioCalblay = grup === "calblay";
  const canEdit = session?.user?.role === "ADMIN" && vista === "directe";

  const comp = await getComparativaEmpresa(anyActual, rang, vista, grup);
  const fdlcLnId = grup === "fdlc" ? (comp.linies[0]?.id ?? null) : null;

  const [evFdlc, evEmpresaRaw, infoGestio] = await Promise.all([
    grup === "fdlc" && acumulatAnual
      ? getEvolucioMensual("empresa", null, anyActual, "fdlc")
      : Promise.resolve(null),
    esPresentacioCalblay ? getEvolucioMensual("empresa", null, anyActual) : Promise.resolve(null),
    vista === "gestio" && grupPermetVistaGestio(grup)
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
    totalLabel = grup === "consolidat" ? "Consolidat" : "Empresa";
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
    // Columnes = mesos; mateix filtre de grup que la taula.
    for (let i = 0; i < 12; i++) {
      drilldownColMap[String(i)] = { mes: i + 1, liniaNegociId: fdlcLnId ?? undefined };
    }
  } else if (grup === "fdlc" && !acumulatAnual) {
    drilldownColMap.fdlc = {
      rang,
      mes: unMes ? rang.des : undefined,
      liniaNegociId: fdlcLnId ?? undefined,
    };
  } else {
    // Columnes = línies de negoci (key = lnId)
    for (const l of comp.linies) {
      drilldownColMap[l.id] = {
        rang,
        mes: unMes ? rang.des : undefined,
        liniaNegociId: l.id,
      };
    }
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
      hint: pctSobreIngressos(ebitdaTotal, ingressosTotal, { signed: true }),
      accent: "ebitda",
    },
  ];

  const tableCaption =
    grup === "fdlc" && acumulatAnual
      ? "Compte d'explotació FDLC — vista general amb desglossament mensual (columnes = mesos)."
      : grup === "fdlc"
        ? `Compte d'explotació FDLC — ${periodeLabel}.`
        : grup === "consolidat"
          ? vista === "gestio"
            ? "Consolidat · Gestió: repartiment LN Cal Blay i Prestació FDLC (restaurant) reclassificada a Vendes LN00001. El total elimina dobles còmputs."
            : "Consolidat · Directe: dades SAP per LN (Prestació FDLC queda a FDLC). El total elimina dobles còmputs interns."
          : "Cada columna és una LN (mateix criteri que Evolució/Per línia). El total Empresa elimina dobles còmputs interns (consolidació).";

  const chartTitle =
    grup === "fdlc" && acumulatAnual
      ? "Evolució mensual · Vendes i EBITDA"
      : grup === "fdlc"
        ? `${periodeLabel} · Vendes i EBITDA`
        : grup === "consolidat"
          ? "Vendes i EBITDA per línia · Consolidat"
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
              : grup === "consolidat"
                ? vista === "gestio"
                  ? `Cal Blay + FDLC · gestió (repartiment LN Cal Blay + Prestació FDLC→LN00001) — ${periodePresentacio}`
                  : `Cal Blay + FDLC · directe (SAP sense reclassificar Prestació) — ${periodePresentacio}`
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
              {grup === "consolidat" && <GestioAvis vista={vista} info={infoGestio} />}
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

          <DetallCompteCollapsible
            caption={
              canEdit
                ? `${tableCaption} Clic a una casella per veure el detall i crear un ajust.`
                : tableCaption
            }
            defaultOpen={false}
          >
            <PivotTableDrilldown
              columns={columns}
              rows={pivotRows}
              totalLabel={totalLabel}
              firstColLabel="Concepte"
              canEdit={canEdit}
              editConfig={canEdit ? { onSave: ajustarImportConsultaAction } : undefined}
              drilldown={{
                any: anyActual,
                colMap: drilldownColMap,
                lnIdsGrup,
                vista,
                grup,
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

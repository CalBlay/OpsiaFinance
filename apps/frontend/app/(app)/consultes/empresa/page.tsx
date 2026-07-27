import { DetallCompteCollapsible } from "@/components/consultes/DetallCompteCollapsible";
import { EvolucioChart } from "@/components/consultes/EvolucioChart";
import { GestioAvis } from "@/components/consultes/GestioAvis";
import { type PivotColumn, PivotTable } from "@/components/consultes/PivotTable";
import { type KpiComite, PresentacioComite } from "@/components/consultes/PresentacioComite";
import styles from "@/components/consultes/report.module.css";
import {
  MESOS_CURTS,
  MESOS_LLARGS,
  type VistaCompte,
  getAnysAmbDades,
  getComparativaEmpresa,
  getEvolucioMensual,
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
  searchParams: Promise<{ any?: string; mes?: string; vista?: string; grup?: string }>;
}) {
  const sp = await searchParams;
  const grup = parseGrupEmpresa(sp.grup);
  const anys = await getAnysAmbDades();
  const anyActual = sp.any ? Number(sp.any) : (anys[0] ?? new Date().getFullYear());
  const mesActual = sp.mes ? Number(sp.mes) : null;
  const vista: VistaCompte =
    grup === "fdlc" ? "directe" : sp.vista === "gestio" ? "gestio" : "directe";
  const acumulatAnual = mesActual === null;
  const esPresentacioCalblay = grup === "calblay";

  const comp = await getComparativaEmpresa(anyActual, mesActual, vista, grup);
  const fdlcLnId = grup === "fdlc" ? (comp.linies[0]?.id ?? null) : null;

  const [evFdlc, evEmpresaRaw, infoGestio] = await Promise.all([
    grup === "fdlc" && fdlcLnId && acumulatAnual
      ? getEvolucioMensual("linia", fdlcLnId, anyActual)
      : Promise.resolve(null),
    esPresentacioCalblay ? getEvolucioMensual("empresa", null, anyActual) : Promise.resolve(null),
    vista === "gestio" && grup === "calblay"
      ? getInfoGestioConsulta(anyActual, mesActual)
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

  const kpis = buildKpisEmpresa((node) => findRow(node)?.total ?? 0);

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
  } else if (grup === "fdlc" && mesActual) {
    const mesNom = MESOS_LLARGS[mesActual - 1] ?? "";
    columns = [{ key: "fdlc", label: mesNom, sublabel: String(anyActual) }];
    pivotRows = comp.concepts.map((c) => ({ ...c, valors: [c.total], total: c.total }));
    totalLabel = "FDLC";
    chartCategories = [mesNom];
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

  const periodeLabel = mesActual ? MESOS_LLARGS[mesActual - 1] : `Acumulat ${anyActual}`;
  const periodePresentacio = mesActual
    ? `${MESOS_LLARGS[mesActual - 1]} ${anyActual}`
    : `Any ${anyActual}`;
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
        ? `Compte d'explotació FDLC — ${periodeLabel} ${anyActual}.`
        : vista === "gestio"
          ? "Detall numèric opcional. Cada columna és una línia de negoci; l'última és el total empresa."
          : "Detall numèric opcional. Imports directes; cada columna és una línia de negoci.";

  const chartTitle =
    grup === "fdlc" && acumulatAnual
      ? "Evolució mensual · Vendes i EBITDA"
      : grup === "fdlc"
        ? `${periodeLabel} ${anyActual} · Vendes i EBITDA`
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
                : `Empresa FDLC — ${periodeLabel} ${anyActual}`
              : vista === "gestio"
                ? `Gestió: mateix total que Directe, costos repartits entre LN — ${periodePresentacio}`
                : `Directe: costos tal com venen (sovint concentrats a Central) — ${periodePresentacio}`}
          </p>
        </div>
        <EmpresaSelectors
          anys={anys.length ? anys : [anyActual]}
          any={anyActual}
          mes={mesActual}
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
            <PivotTable
              columns={columns}
              rows={pivotRows}
              totalLabel={totalLabel}
              firstColLabel="Concepte"
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

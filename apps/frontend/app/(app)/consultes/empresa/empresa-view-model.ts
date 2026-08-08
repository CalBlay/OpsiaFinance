import type { PivotColumn } from "@/components/consultes/PivotTable";
import type { KpiComite } from "@/components/consultes/PresentacioComite";
import type { ComparativaEmpresa, EvolucioMensual } from "@/lib/consultes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import type { GrupEmpresa } from "@/lib/grups-empresa";
import { etiquetaGrupEmpresa } from "@/lib/grups-empresa";
import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_INGRESSOS,
  NODE_VENDES,
  buildKpisEmpresa,
} from "@/lib/kpi-definitions";
import { OPSIA_CHART } from "@/lib/opsia-colors";
import {
  MESOS_CURTS,
  MESOS_LLARGS,
  type RangMesos,
  esAnyComplet,
  esUnMes,
  etiquetaRangMesos,
  etiquetaRangMesosLlarga,
} from "@/lib/periodes";
import type { InfoGestioConsulta } from "@/lib/repartiment/info-gestio";
import type { VistaCompte } from "@/lib/vista-compte";
import type { EmpresaVistaData } from "./empresa-vista-data";

export type { EmpresaVistaData } from "./empresa-vista-data";

function pctSobreIngressos(
  valor: number,
  ingressos: number,
  opts?: { signed?: boolean }
): number | null {
  if (!ingressos) return null;
  return opts?.signed
    ? (valor / Math.abs(ingressos)) * 100
    : (Math.abs(valor) / Math.abs(ingressos)) * 100;
}

export function buildEmpresaVistaData(opts: {
  vista: VistaCompte;
  grup: GrupEmpresa;
  anyActual: number;
  rang: RangMesos;
  isAdmin: boolean;
  comp: ComparativaEmpresa;
  evFdlc: EvolucioMensual | null;
  evEmpresa: EvolucioMensual | null;
  infoGestio: InfoGestioConsulta | null;
}): EmpresaVistaData {
  const { vista, grup, anyActual, rang, isAdmin, comp, evFdlc, evEmpresa, infoGestio } = opts;
  const acumulatAnual = esAnyComplet(rang);
  const unMes = esUnMes(rang);
  const esPresentacioCalblay = grup === "calblay";
  const canEdit = isAdmin && vista === "directe";
  const fdlcLnId = grup === "fdlc" ? (comp.linies[0]?.id ?? null) : null;

  const findRow = (node: number) => comp.concepts.find((c) => c.node === node);
  const findEvRow = (node: number) => evFdlc?.concepts.find((c) => c.node === node);
  const findEvEmpresa = (node: number) => evEmpresa?.concepts.find((c) => c.node === node);

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

  const periodeLabel = etiquetaRangMesos(rang, anyActual);
  const periodePresentacio = etiquetaRangMesosLlarga(rang, anyActual);

  if (grup === "fdlc" && acumulatAnual && evFdlc) {
    columns = MESOS_CURTS.map((m, i) => ({ key: String(i), label: m }));
    pivotRows = evFdlc.concepts;
    totalLabel = "Any";
    chartCategories = [...MESOS_CURTS];
    chartSeries = [
      {
        name: "Vendes",
        type: "bar",
        color: OPSIA_CHART.vendes,
        data: findEvRow(NODE_VENDES)?.valors ?? [],
      },
      {
        name: "EBITDA",
        type: "line",
        color: OPSIA_CHART.ebitda,
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
      {
        name: "Vendes",
        type: "bar",
        color: OPSIA_CHART.vendes,
        data: [findRow(NODE_VENDES)?.total ?? 0],
      },
      {
        name: "EBITDA",
        type: "bar",
        color: OPSIA_CHART.ebitda,
        data: [findRow(NODE_EBITDA)?.total ?? 0],
      },
    ];
    chartTickAngle = 0;
  } else {
    columns = comp.linies.map((l) => ({ key: l.id, label: l.codi, sublabel: l.nom }));
    totalLabel = grup === "consolidat" ? "Consolidat" : "Empresa";
    chartCategories = comp.linies.map(etiquetaGrafic);
    chartSeries = [
      {
        name: "Vendes",
        type: "bar",
        color: OPSIA_CHART.vendes,
        data: findRow(NODE_VENDES)?.valors ?? [],
      },
      {
        name: "EBITDA",
        type: "bar",
        color: OPSIA_CHART.ebitda,
        data: findRow(NODE_EBITDA)?.valors ?? [],
      },
    ];
    chartTickAngle = -28;
  }

  const drilldownColMap: EmpresaVistaData["drilldownColMap"] = {};
  const lnIdsGrup = comp.linies.map((l) => l.id);
  if (grup === "fdlc" && acumulatAnual) {
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
    for (const l of comp.linies) {
      drilldownColMap[l.id] = {
        rang,
        mes: unMes ? rang.des : undefined,
        liniaNegociId: l.id,
      };
    }
  }

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
      pct: pctSobreIngressos(personalTotal, ingressosTotal),
      pctHint: "s/ ingressos",
      accent: "cost",
    },
    {
      label: "Compres",
      import_: compresTotal,
      pct: pctSobreIngressos(compresTotal, ingressosTotal),
      pctHint: "s/ ingressos",
      accent: "cost",
    },
    {
      label: "Gestió",
      import_: gestioTotal,
      pct: pctSobreIngressos(gestioTotal, ingressosTotal),
      pctHint: "s/ ingressos",
      accent: "cost",
    },
    {
      label: "EBITDA",
      import_: ebitdaTotal,
      pct: pctSobreIngressos(ebitdaTotal, ingressosTotal, { signed: true }),
      pctHint: "s/ ingressos",
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

  const subtitle =
    grup === "fdlc"
      ? acumulatAnual
        ? `Empresa FDLC — general (acumulat ${anyActual}) · evolució per mesos`
        : `Empresa FDLC — ${periodeLabel}`
      : grup === "consolidat"
        ? vista === "gestio"
          ? `Cal Blay + FDLC · gestió (repartiment LN Cal Blay + Prestació FDLC→LN00001) — ${periodePresentacio}`
          : `Cal Blay + FDLC · directe (SAP sense reclassificar Prestació) — ${periodePresentacio}`
        : vista === "gestio"
          ? `Gestió: mateix total que Directe, costos repartits entre LN — ${periodePresentacio}`
          : `Directe: costos tal com venen (sovint concentrats a Central) — ${periodePresentacio}`;

  return {
    vista,
    subtitle,
    periodePresentacio,
    tableCaption,
    chartTitle,
    kpisComite,
    kpis,
    columns,
    pivotRows,
    totalLabel,
    chartCategories,
    chartSeries,
    chartTickAngle,
    drilldownColMap,
    lnIdsGrup,
    mensual: esPresentacioCalblay
      ? {
          mesos: [...MESOS_CURTS],
          ingressos: findEvEmpresa(NODE_INGRESSOS)?.valors ?? [],
          ebitda: findEvEmpresa(NODE_EBITDA)?.valors ?? [],
          personal: findEvEmpresa(NODE_COST_SALARIAL)?.valors ?? [],
          compres: findEvEmpresa(NODE_COMPRES)?.valors ?? [],
          gestio: findEvEmpresa(NODE_COST_GESTIO)?.valors ?? [],
        }
      : null,
    perLn: esPresentacioCalblay
      ? {
          etiquetes: comp.linies.map(etiquetaGrafic),
          ingressos: findRow(NODE_INGRESSOS)?.valors ?? [],
          ebitda: findRow(NODE_EBITDA)?.valors ?? [],
          personal: findRow(NODE_COST_SALARIAL)?.valors ?? [],
          compres: findRow(NODE_COMPRES)?.valors ?? [],
          gestio: findRow(NODE_COST_GESTIO)?.valors ?? [],
        }
      : null,
    buit: comp.buit,
    canEdit,
    exportSubtitle: `${periodePresentacio} · ${vista === "gestio" ? "Gestió" : "Directe"}`,
    infoGestio: vista === "gestio" ? infoGestio : null,
  };
}

export function etiquetaTitolEmpresa(grup: GrupEmpresa): string {
  const nom = etiquetaGrupEmpresa(grup);
  return grup === "calblay" ? `Resultats · ${nom}` : `Compte d'explotació · ${nom}`;
}

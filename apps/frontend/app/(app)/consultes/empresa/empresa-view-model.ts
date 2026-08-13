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
  type RangMesos,
  esAnyComplet,
  esUnMes,
  etiquetaRangMesos,
  etiquetaRangMesosLlarga,
} from "@/lib/periodes";
import type { InfoGestioConsulta } from "@/lib/repartiment/info-gestio";
import type { VistaCompte } from "@/lib/vista-compte";
import { etiquetaVistaCompte, vistaInclouRepartiment } from "@/lib/vista-compte";
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

/**
 * Vista d'empresa: mateixa presentació (Comitè + pivot per LN) per a tots els grups.
 * El grup només canvia les dades (quines LN / números).
 */
export function buildEmpresaVistaData(opts: {
  vista: VistaCompte;
  grup: GrupEmpresa;
  anyActual: number;
  rang: RangMesos;
  isAdmin: boolean;
  comp: ComparativaEmpresa;
  /** @deprecated Ja no s'usa; la presentació unificada usa sempre evEmpresa. */
  evFdlc: EvolucioMensual | null;
  evEmpresa: EvolucioMensual | null;
  infoGestio: InfoGestioConsulta | null;
}): EmpresaVistaData {
  const { vista, grup, anyActual, rang, isAdmin, comp, evEmpresa, infoGestio } = opts;
  const unMes = esUnMes(rang);
  const canEdit = isAdmin && vista === "directe";

  const findRow = (node: number) => comp.concepts.find((c) => c.node === node);
  const findEvEmpresa = (node: number) => evEmpresa?.concepts.find((c) => c.node === node);

  const kpis = buildKpisEmpresa((node) => findRow(node)?.total ?? 0);

  const columns: PivotColumn[] = comp.linies.map((l) => ({
    key: l.id,
    label: l.codi,
    sublabel: l.nom,
  }));
  const pivotRows = comp.concepts;
  const totalLabel = grup === "consolidat" ? "Consolidat" : grup === "fdlc" ? "FDLC" : "Empresa";
  const chartCategories = comp.linies.map(etiquetaGrafic);
  const chartSeries = [
    {
      name: "Vendes",
      type: "bar" as const,
      color: OPSIA_CHART.vendes,
      data: findRow(NODE_VENDES)?.valors ?? [],
    },
    {
      name: "EBITDA",
      type: "bar" as const,
      color: OPSIA_CHART.ebitda,
      data: findRow(NODE_EBITDA)?.valors ?? [],
    },
  ];
  const chartTickAngle = -28;

  const periodeLabel = etiquetaRangMesos(rang, anyActual);
  const periodePresentacio = etiquetaRangMesosLlarga(rang, anyActual);

  const drilldownColMap: EmpresaVistaData["drilldownColMap"] = {};
  const lnIdsGrup = comp.linies.map((l) => l.id);
  for (const l of comp.linies) {
    drilldownColMap[l.id] = {
      rang,
      mes: unMes ? rang.des : undefined,
      liniaNegociId: l.id,
    };
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
      label: "Compres",
      import_: compresTotal,
      pct: pctSobreIngressos(compresTotal, ingressosTotal),
      pctHint: "s/ ingressos",
      accent: "cost",
    },
    {
      label: "Personal",
      import_: personalTotal,
      pct: pctSobreIngressos(personalTotal, ingressosTotal),
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
    grup === "fdlc"
      ? `Compte d'explotació FDLC — ${periodeLabel}`
      : grup === "consolidat"
        ? `Consolidat · ${etiquetaVistaCompte(vista)} — ${periodeLabel}`
        : `Empresa — ${periodeLabel}`;

  const chartTitle =
    grup === "consolidat"
      ? "Vendes i EBITDA per línia · Consolidat"
      : grup === "fdlc"
        ? "Vendes i EBITDA · FDLC"
        : undefined;

  const subtitle =
    grup === "fdlc"
      ? `Empresa FDLC — ${periodePresentacio}`
      : grup === "consolidat"
        ? `Cal Blay + FDLC · ${etiquetaVistaCompte(vista)} — ${periodePresentacio}`
        : `${etiquetaVistaCompte(vista)} — ${periodePresentacio}`;

  const mesIni = rang.des - 1;
  const mesFi = rang.fins;
  const sliceMes = <T>(arr: T[]): T[] => (esAnyComplet(rang) ? arr : arr.slice(mesIni, mesFi));

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
    mensual: {
      mesos: sliceMes([...MESOS_CURTS]),
      ingressos: sliceMes(findEvEmpresa(NODE_INGRESSOS)?.valors ?? []),
      ebitda: sliceMes(findEvEmpresa(NODE_EBITDA)?.valors ?? []),
      personal: sliceMes(findEvEmpresa(NODE_COST_SALARIAL)?.valors ?? []),
      compres: sliceMes(findEvEmpresa(NODE_COMPRES)?.valors ?? []),
      gestio: sliceMes(findEvEmpresa(NODE_COST_GESTIO)?.valors ?? []),
    },
    perLn: {
      etiquetes: comp.linies.map(etiquetaGrafic),
      ingressos: findRow(NODE_INGRESSOS)?.valors ?? [],
      ebitda: findRow(NODE_EBITDA)?.valors ?? [],
      personal: findRow(NODE_COST_SALARIAL)?.valors ?? [],
      compres: findRow(NODE_COMPRES)?.valors ?? [],
      gestio: findRow(NODE_COST_GESTIO)?.valors ?? [],
    },
    buit: comp.buit,
    canEdit,
    exportSubtitle: `${periodePresentacio} · ${etiquetaVistaCompte(vista)}`,
    infoGestio: vistaInclouRepartiment(vista) ? infoGestio : null,
  };
}

export function etiquetaTitolEmpresa(grup: GrupEmpresa): string {
  return `Resultats · ${etiquetaGrupEmpresa(grup)}`;
}

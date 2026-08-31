import type { KpiComite } from "@/components/consultes/PresentacioComite";
import type {
  SerieMensualComite,
  SeriePerLnComite,
} from "@/components/consultes/PresentacioComite";
import { MESOS_CURTS } from "@/lib/consultes";
import type { ComparativaEmpresa } from "@/lib/consultes";
import type { EvolucioMensual } from "@/lib/consultes";
import { etiquetaGrafic } from "@/lib/consultes-grafics";
import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_INGRESSOS,
} from "@/lib/kpi-definitions";
import { type RangMesos, esAnyComplet, rangToQuery } from "@/lib/periodes";
import type { VistaCompte } from "@/lib/vista-compte";
import type { FilaResumLinia } from "./LiniaResumPresentacio";

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

export type LiniaResumCapa = {
  vista: VistaCompte;
  buit: boolean;
  kpis: KpiComite[];
  mensual: SerieMensualComite;
  perLn: SeriePerLnComite;
  files: FilaResumLinia[];
};

export function buildLiniaResumCapa(
  comp: ComparativaEmpresa,
  evEmpresa: EvolucioMensual | null,
  opts: { anyActual: number; rang: RangMesos; vista: VistaCompte }
): LiniaResumCapa {
  const { anyActual, rang, vista } = opts;
  const findRow = (node: number) => comp.concepts.find((c) => c.node === node);
  const findEv = (node: number) => evEmpresa?.concepts.find((c) => c.node === node);

  const ingressosTotal = findRow(NODE_INGRESSOS)?.total ?? 0;
  const personalTotal = findRow(NODE_COST_SALARIAL)?.total ?? 0;
  const compresTotal = findRow(NODE_COMPRES)?.total ?? 0;
  const gestioTotal = findRow(NODE_COST_GESTIO)?.total ?? 0;
  const ebitdaTotal = findRow(NODE_EBITDA)?.total ?? 0;

  const kpis: KpiComite[] = [
    { label: "Ingressos", import_: ingressosTotal, hint: "Explotació", accent: "ingressos" },
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

  const mesIni = rang.des - 1;
  const mesFi = rang.fins;
  const sliceMes = <T>(arr: T[]): T[] => (esAnyComplet(rang) ? arr : arr.slice(mesIni, mesFi));

  const perLn: SeriePerLnComite = {
    etiquetes: comp.linies.map(etiquetaGrafic),
    ingressos: findRow(NODE_INGRESSOS)?.valors ?? [],
    ebitda: findRow(NODE_EBITDA)?.valors ?? [],
    personal: findRow(NODE_COST_SALARIAL)?.valors ?? [],
    compres: findRow(NODE_COMPRES)?.valors ?? [],
    gestio: findRow(NODE_COST_GESTIO)?.valors ?? [],
  };

  const mensual: SerieMensualComite = {
    mesos: sliceMes([...MESOS_CURTS]),
    ingressos: sliceMes(findEv(NODE_INGRESSOS)?.valors ?? []),
    ebitda: sliceMes(findEv(NODE_EBITDA)?.valors ?? []),
    personal: sliceMes(findEv(NODE_COST_SALARIAL)?.valors ?? []),
    compres: sliceMes(findEv(NODE_COMPRES)?.valors ?? []),
    gestio: sliceMes(findEv(NODE_COST_GESTIO)?.valors ?? []),
  };

  const totalIngAbs = Math.abs(ingressosTotal) || 0;
  const files: FilaResumLinia[] = comp.linies.map((l, i) => {
    const ingressos = perLn.ingressos[i] ?? 0;
    const ebitda = perLn.ebitda[i] ?? 0;
    return {
      id: l.id,
      name: etiquetaGrafic(l),
      ingressos,
      pctSobreTotal: totalIngAbs ? (Math.abs(ingressos) / totalIngAbs) * 100 : null,
      ebitda,
      ebitdaPct: ingressos ? (ebitda / Math.abs(ingressos)) * 100 : null,
      href: `/consultes/linia?ln=${l.id}&any=${anyActual}${rangToQuery(rang)}&vista=${vista}`,
    };
  });

  return { vista, buit: comp.buit, kpis, mensual, perLn, files };
}

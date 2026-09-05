import type { KpiComite } from "@/components/consultes/PresentacioComite";
import type { KpiInformeItem } from "@/lib/kpi-definitions";
import { NODE_INGRESSOS } from "@/lib/kpi-definitions";
import { type NaturaConcepte, fraccioFix, fraccioVariable } from "@/lib/natura-concepte";

export type NaturaNodeMeta = {
  natura: NaturaConcepte | null;
  pctVariable: number | null;
};

/** Mapa node → natura (serialitzable per props / actions). */
export type NaturaByNodeRecord = Record<string, NaturaNodeMeta>;

export type ConceptePeInput = {
  node: number;
  total: number;
  esSubtotal?: boolean;
};

export type PuntEquilibriResult = {
  ingressos: number;
  variables: number;
  fixos: number;
  margeContribucio: number;
  /** MC / Ingressos × 100. */
  margeContribucioPct: number | null;
  /** PE en € d'ingressos. Null si no es pot calcular. */
  pe: number | null;
  /** Ingressos / PE. */
  cobertura: number | null;
};

export function naturaRecordToMap(record: NaturaByNodeRecord): Map<number, NaturaNodeMeta> {
  const map = new Map<number, NaturaNodeMeta>();
  for (const [key, meta] of Object.entries(record)) {
    map.set(Number(key), meta);
  }
  return map;
}

/**
 * Punt d'equilibri (PE) en € d'ingressos del període.
 *
 * Variables = |cost VARIABLE| + |MIXTE| × (%var/100)
 * Fixos     = |cost FIX| + |MIXTE| × (1 − %var/100)
 * MC        = Ingressos (node 6) − Variables
 * PE (€)    = Fixos ÷ (MC / Ingressos)
 *
 * INGRES i ALIE no entren al PE operatiu; els subtotals s'ignoren.
 */
export function calcularPuntEquilibri(
  concepts: ConceptePeInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord
): PuntEquilibriResult {
  const map = naturaByNode instanceof Map ? naturaByNode : naturaRecordToMap(naturaByNode);

  const ingressos = concepts.find((c) => c.node === NODE_INGRESSOS)?.total ?? 0;

  let variables = 0;
  let fixos = 0;

  for (const c of concepts) {
    if (c.esSubtotal) continue;
    const meta = map.get(c.node);
    if (!meta?.natura) continue;
    if (meta.natura === "INGRES" || meta.natura === "ALIE") continue;

    const abs = Math.abs(c.total);
    variables += abs * fraccioVariable(meta.natura, meta.pctVariable);
    fixos += abs * fraccioFix(meta.natura, meta.pctVariable);
  }

  const margeContribucio = ingressos - variables;
  const margeContribucioPct = ingressos > 0 ? (margeContribucio / ingressos) * 100 : null;

  const pe = ingressos > 0 && margeContribucio > 0 ? fixos / (margeContribucio / ingressos) : null;
  const cobertura = pe != null && pe > 0 ? ingressos / pe : null;

  return {
    ingressos,
    variables,
    fixos,
    margeContribucio,
    margeContribucioPct,
    pe,
    cobertura,
  };
}

export type ConceptePeMensualInput = {
  node: number;
  valors: number[];
  esSubtotal?: boolean;
};

/**
 * PE de cada mes (mateixa fórmula, scoped al mes).
 * Null als mesos sense ingressos o amb MC ≤ 0.
 */
export function calcularPePerMes(
  concepts: ConceptePeMensualInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord
): (number | null)[] {
  const len = Math.max(12, ...concepts.map((c) => c.valors.length), 0);
  const out: (number | null)[] = [];
  for (let i = 0; i < len; i++) {
    const monthConcepts: ConceptePeInput[] = concepts.map((c) => ({
      node: c.node,
      total: c.valors[i] ?? 0,
      esSubtotal: c.esSubtotal,
    }));
    out.push(calcularPuntEquilibri(monthConcepts, naturaByNode).pe);
  }
  return out;
}

/** Mesos del rang amb ingressos ≠ 0 (mínim 1). */
export function nMesosAmbIngressos(ingressosMensuals: number[], desMes = 1, finsMes = 12): number {
  let n = 0;
  for (let m = desMes; m <= finsMes; m++) {
    if (Math.abs(ingressosMensuals[m - 1] ?? 0) > 0) n += 1;
  }
  return Math.max(n, 1);
}

/** PE mensual teòric = PE període ÷ n mesos amb activitat. */
export function peMensualTeoric(pePeriod: number, nMesos: number): number | null {
  if (!(pePeriod > 0) || !(nMesos > 0)) return null;
  return pePeriod / nMesos;
}

function formatFactor(n: number): string {
  return new Intl.NumberFormat("ca-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** KPIs d'informe: PE període + PE mensual (si nMesos>1) + Cobertura. */
export function kpisPuntEquilibri(
  concepts: ConceptePeInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord,
  opts?: { nMesos?: number }
): KpiInformeItem[] {
  const r = calcularPuntEquilibri(concepts, naturaByNode);
  if (r.pe == null || r.cobertura == null) return [];

  const items: KpiInformeItem[] = [
    {
      label: "PE",
      tipus: "pe",
      import_: r.pe,
      pctVendes: r.margeContribucioPct,
      nota: "PE del període",
    },
  ];

  const nMesos = opts?.nMesos ?? 1;
  const peMes = peMensualTeoric(r.pe, nMesos);
  if (nMesos > 1 && peMes != null) {
    items.push({
      label: "PE mensual",
      tipus: "pe",
      import_: peMes,
      pctVendes: r.margeContribucioPct,
      nota: "Vendes / mes per equilibri",
    });
  }

  items.push({
    label: "Cobertura",
    tipus: "cobertura",
    import_: r.cobertura,
    pctVendes: null,
  });

  return items;
}

/** Mateixos indicadors per a la presentació Comitè. */
export function kpisComitePuntEquilibri(
  concepts: ConceptePeInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord,
  opts?: { nMesos?: number }
): KpiComite[] {
  const r = calcularPuntEquilibri(concepts, naturaByNode);
  if (r.pe == null || r.cobertura == null) return [];

  const items: KpiComite[] = [
    {
      label: "PE",
      import_: r.pe,
      pct: r.margeContribucioPct,
      pctHint: "MC s/ ingressos",
      hint: "PE del període",
      accent: "neutral",
    },
  ];

  const nMesos = opts?.nMesos ?? 1;
  const peMes = peMensualTeoric(r.pe, nMesos);
  if (nMesos > 1 && peMes != null) {
    items.push({
      label: "PE mensual",
      import_: peMes,
      pct: r.margeContribucioPct,
      pctHint: "MC s/ ingressos",
      hint: "Vendes / mes per equilibri",
      accent: "neutral",
    });
  }

  items.push({
    label: "Cobertura",
    valueText: `${formatFactor(r.cobertura)}×`,
    hint: "Ingressos / PE",
    accent: "neutral",
  });

  return items;
}

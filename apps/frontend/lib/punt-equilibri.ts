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

function formatFactor(n: number): string {
  return new Intl.NumberFormat("ca-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** KPIs d'informe: PE (€) + Cobertura (×). Buits si no calculable. */
export function kpisPuntEquilibri(
  concepts: ConceptePeInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord
): KpiInformeItem[] {
  const r = calcularPuntEquilibri(concepts, naturaByNode);
  if (r.pe == null || r.cobertura == null) return [];

  return [
    {
      label: "PE",
      tipus: "pe",
      import_: r.pe,
      pctVendes: r.margeContribucioPct,
      nota: "Punt d'equilibri",
    },
    {
      label: "Cobertura",
      tipus: "cobertura",
      import_: r.cobertura,
      pctVendes: null,
    },
  ];
}

/** Mateixos indicadors per a la presentació Comitè. */
export function kpisComitePuntEquilibri(
  concepts: ConceptePeInput[],
  naturaByNode: Map<number, NaturaNodeMeta> | NaturaByNodeRecord
): KpiComite[] {
  const r = calcularPuntEquilibri(concepts, naturaByNode);
  if (r.pe == null || r.cobertura == null) return [];

  return [
    {
      label: "PE",
      import_: r.pe,
      pct: r.margeContribucioPct,
      pctHint: "MC s/ ingressos",
      hint: "Punt d'equilibri",
      accent: "neutral",
    },
    {
      label: "Cobertura",
      valueText: `${formatFactor(r.cobertura)}×`,
      hint: "Ingressos / PE",
      accent: "neutral",
    },
  ];
}

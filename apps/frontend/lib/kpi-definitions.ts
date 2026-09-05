export type KpiTipus = "vendes" | "cost" | "ebitda" | "pe" | "cobertura";

export const NODE_VENDES = 2;
export const NODE_COMPRES = 11;
export const NODE_COST_SALARIAL = 17;
export const NODE_COST_GESTIO = 30;
export const NODE_EBITDA = 32;
export const NODE_INGRESSOS = 6;

/**
 * Primer KPI de totes les consultes (Empresa, Per línia, Evolució, Comparativa):
 * total ingressos d'explotació (node 6), no la fila VENDES (node 2).
 * A FDLC (i altres LN amb prestació/altres) vendes ≠ ingressos; el compte i l'EBITDA
 * tanquen sobre ingressos.
 */
export const KPI_DEFINICIONS = [
  { label: "Ingressos", node: NODE_INGRESSOS, tipus: "vendes" as const },
  { label: "Compres", node: NODE_COMPRES, tipus: "cost" as const },
  { label: "Personal", node: NODE_COST_SALARIAL, tipus: "cost" as const },
  { label: "Gestió", node: NODE_COST_GESTIO, tipus: "cost" as const },
  { label: "EBITDA", node: NODE_EBITDA, tipus: "ebitda" as const },
] as const;

export interface KpiInformeItem {
  label: string;
  tipus: KpiTipus;
  import_: number;
  pctVendes: number | null;
  /** Text secundari sota l'import (p.ex. vendes netes quan el KPI principal són ingressos). */
  nota?: string;
  importSecundari?: number;
}

export function buildKpisInforme(findVal: (node: number) => number): KpiInformeItem[] {
  const ingressos = findVal(NODE_INGRESSOS);
  return KPI_DEFINICIONS.map((k) => {
    const import_ = findVal(k.node);
    const pctVendes = k.tipus === "vendes" ? null : ingressos ? (import_ / ingressos) * 100 : null;
    return { label: k.label, tipus: k.tipus, import_, pctVendes };
  });
}

/** Mateixos KPIs que l'informe (ingressos explotació com a primer indicador). */
export function buildKpisEmpresa(findVal: (node: number) => number): KpiInformeItem[] {
  return buildKpisInforme(findVal);
}

export interface KpiComparatiuItem {
  label: string;
  tipus: KpiTipus;
  totalitat: number;
  totalitatAnterior: number | null;
  diferencia: number | null;
  refLabel: string | null;
  actualLabel: string | null;
  pctActual: number | null;
  pctAnterior: number | null;
}

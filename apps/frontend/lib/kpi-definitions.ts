export type KpiTipus = "vendes" | "cost" | "ebitda";

export const NODE_VENDES = 2;
export const NODE_COMPRES = 11;
export const NODE_COST_SALARIAL = 17;
export const NODE_COST_GESTIO = 30;
export const NODE_EBITDA = 32;
export const NODE_INGRESSOS = 6;

export const KPI_DEFINICIONS = [
  { label: "Vendes", node: NODE_VENDES, tipus: "vendes" as const },
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
  const vendes = findVal(NODE_VENDES);
  return KPI_DEFINICIONS.map((k) => {
    const import_ = findVal(k.node);
    const pctVendes = k.tipus === "vendes" ? null : vendes ? (import_ / vendes) * 100 : null;
    return { label: k.label, tipus: k.tipus, import_, pctVendes };
  });
}

/** KPIs de la vista empresa: el primer indicador és ingressos explotació (coincideix amb la fila de la taula). */
export function buildKpisEmpresa(findVal: (node: number) => number): KpiInformeItem[] {
  const vendes = findVal(NODE_VENDES);
  const ingressos = findVal(NODE_INGRESSOS);
  return buildKpisInforme(findVal).map((k) =>
    k.tipus === "vendes"
      ? {
          ...k,
          label: "Ingressos explotació",
          import_: ingressos,
          nota: "Vendes netes",
          importSecundari: vendes,
        }
      : k
  );
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

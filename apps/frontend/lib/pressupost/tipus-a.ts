import {
  NODE_COMPRES,
  NODE_COST_GESTIO,
  NODE_COST_SALARIAL,
  NODE_EBITDA,
  NODE_VENDES,
} from "@/lib/repartiment/nodes";

/** Partides Tipus A (pressupost vendes / explotació resum). */
export const NODES_TIPUS_A = [
  NODE_VENDES,
  NODE_COMPRES,
  NODE_COST_SALARIAL,
  NODE_COST_GESTIO,
  NODE_EBITDA,
] as const;

export type NodeTipusA = (typeof NODES_TIPUS_A)[number];

export const PARTIDES_TIPUS_A: {
  node: NodeTipusA;
  label: string;
  esCost: boolean;
  esCalculat: boolean;
}[] = [
  { node: NODE_VENDES, label: "Vendes", esCost: false, esCalculat: false },
  { node: NODE_COMPRES, label: "Compres", esCost: true, esCalculat: false },
  { node: NODE_COST_SALARIAL, label: "Personal", esCost: true, esCalculat: false },
  { node: NODE_COST_GESTIO, label: "Gestió", esCost: true, esCalculat: false },
  { node: NODE_EBITDA, label: "EBITDA", esCost: false, esCalculat: true },
];

export type ModeEntradaTipusA = "eur" | "pct_vendes" | "pct_any_ant";

export type ConcepteTipusA = {
  id: string;
  node: number;
  descripcio: string;
};

/** EBITDA = vendes + costos (si costos van amb signe negatiu). */
export function calcularEbitdaTipusA(
  vendes: number,
  compres: number,
  personal: number,
  gestio: number
): number {
  return Math.round((vendes + compres + personal + gestio) * 100) / 100;
}

/** Converteix input UI → import a desar (costos → negatiu). */
export function importUiADesar(valorUi: number, esCost: boolean): number {
  const v = Math.round(valorUi * 100) / 100;
  if (esCost) return v === 0 ? 0 : -Math.abs(v);
  return v;
}

/** Import desat → valor positiu per a l’input. */
export function importDesatAUi(import_: number, esCost: boolean): number {
  if (esCost) return Math.abs(import_);
  return import_;
}

/**
 * Calcula l’import UI (€ positiu per costos) segons el mode d’entrada.
 * `input` és el que escriu l’usuari (€ o % segons mode).
 */
export function calcularValorDesDeMode(args: {
  mode: ModeEntradaTipusA;
  input: number;
  esCost: boolean;
  vendesMes: number;
  vendesAnyAntMes: number;
}): number | null {
  const { mode, input, vendesMes, vendesAnyAntMes } = args;
  if (!Number.isFinite(input)) return null;

  if (mode === "eur") return Math.round(input * 100) / 100;

  if (mode === "pct_vendes") {
    if (Math.abs(vendesMes) < 0.005) return null;
    return Math.round(((Math.abs(vendesMes) * input) / 100) * 100) / 100;
  }

  // pct_any_ant → % sobre vendes de l’any anterior (mateix mes)
  if (Math.abs(vendesAnyAntMes) < 0.005) return null;
  return Math.round(((Math.abs(vendesAnyAntMes) * input) / 100) * 100) / 100;
}

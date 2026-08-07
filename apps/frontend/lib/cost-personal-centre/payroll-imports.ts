/**
 * Descomposició d’una fila payroll → imports de compte (magnituds positives).
 *
 * Columnes (nòmina i millores):
 *   J = import brut
 *   K = provisió pagues (0 a millores)
 *   L = seguretat social
 *   M = ignorada (el fitxer porta un total; nosaltres calculem J+K+L)
 *
 * Sous = J+K ; SS = L ; Cost = J+K+L.
 */

export type OrigenPayroll = "NOMINA" | "MILLORES";

export type FilaPayrollImports = {
  origen?: OrigenPayroll | string | null;
  importBrut: number | { toString(): string };
  /** Columna K — provisió pagues extres. */
  segSocialEmpresa: number | { toString(): string };
  /** Columna L — seguretat social. */
  totalSegSocial: number | { toString(): string };
  /** Columna M — ignorada al càlcul. */
  costPersonal?: number | { toString(): string };
};

export type ImportsPayrollDesglossats = {
  /** Col. J */
  brut: number;
  /** Col. K (provisió). 0 a millores. */
  provisio: number;
  /** Col. L (SS). */
  seguretatSocial: number;
  /** Sempre J+K+L (M ignorada). */
  cost: number;
  /** Presentació a Sous i salaris: J + K. */
  sous: number;
};

function absNum(v: number | { toString(): string } | undefined): number {
  if (v === undefined || v === null) return 0;
  return Math.abs(Number(v));
}

export function esOrigenMillores(origen: OrigenPayroll | string | null | undefined): boolean {
  return origen === "MILLORES";
}

/**
 * Desglossa una fila CostPersonalCentre.
 * Sous = J+K · SS = L · Cost = J+K+L (mai la columna M).
 */
export function desglossarFilaPayroll(f: FilaPayrollImports): ImportsPayrollDesglossats {
  const millores = esOrigenMillores(f.origen);
  const brut = absNum(f.importBrut);
  const provisio = millores ? 0 : absNum(f.segSocialEmpresa);
  const seguretatSocial = absNum(f.totalSegSocial); // L
  const cost = Math.round((brut + provisio + seguretatSocial) * 100) / 100;

  return {
    brut,
    provisio,
    seguretatSocial,
    cost,
    sous: Math.round((brut + provisio) * 100) / 100,
  };
}

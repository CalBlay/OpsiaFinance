import { NODES_PERSONAL_DETALL } from "@/lib/cost-personal-centre/nodes";

/** Nodes SAP del compte de resultats (repartiment). */
export const NODE_VENDES = 2;
export const NODE_INGRESSOS = 6;
/** Detall: línia COMPRES (abans del subtotal TOTAL COMPRES). */
export const NODE_COMPRES_DETALL = 7;
export const NODE_ALTRES_APROVISIONAMENTS = 8;
export const NODE_COMPRES = 11;
export const NODE_SOUS_SALARIS = 13;
export const NODE_INDEMNITZACIONS = 14;
export const NODE_SEGURETAT_SOCIAL = 15;
export const NODE_ALTRES_DESPESES_SOCIALS = 16;
export const NODE_COST_SALARIAL = 17;
/** Contractes ETT (detall dins TOTAL COST SALARIAL). */
export { NODE_CONTRACTES_ETT } from "@/lib/cost-personal-centre/nodes";
/** Detalls de despeses de gestió (abans del subtotal 30). */
export const NODES_GESTIO_DETALL = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29] as const;
/** Detall on històricament es mostraven reclassificacions de gestió. */
export const NODE_MOVIMENTS_INTERNS = 29;
export const NODE_COST_GESTIO = 30;
export const NODE_EBITDA = 32;

export const CODI_LN_CENTRAL = "LN00000";
const FIRST_NODE_GESTIO_DETALL = NODES_GESTIO_DETALL[0] ?? NODE_MOVIMENTS_INTERNS;

/**
 * Els deltas de repartiment es calculen sobre els totals (11/17/30),
 * però a la vista Gestió es reparteixen entre les línies de detall perquè
 * el compte quadri (detall → subtotal) i sous/SS (i compres/altres) restin lligats.
 *
 * Cost salarial (17) → partides de personal (13–16 + 44 ETT)
 * Compres (11) → mercaderies (7) + altres aprovisionaments (8)
 * Gestió (30) → cada línia de detall 18–29 (proporcional a |base|;
 *   així Central al X% escala cada partida, no només moviments interns)
 */
export const NODE_REPARTIMENT_A_DETALLS: Readonly<Record<number, readonly number[]>> = {
  [NODE_COMPRES]: [NODE_COMPRES_DETALL, NODE_ALTRES_APROVISIONAMENTS],
  [NODE_COST_SALARIAL]: NODES_PERSONAL_DETALL,
  [NODE_COST_GESTIO]: NODES_GESTIO_DETALL,
};

/** @deprecated Preferiu `nodesPresentacioGestio` (pot haver-hi més d'un detall). */
export const NODE_REPARTIMENT_A_DETALL: Readonly<Record<number, number>> = {
  [NODE_COMPRES]: NODE_COMPRES_DETALL,
  [NODE_COST_SALARIAL]: NODE_SOUS_SALARIS,
  [NODE_COST_GESTIO]: FIRST_NODE_GESTIO_DETALL,
};

/** Nodes de detall on es presenta un delta calculat sobre un total. */
export function nodesPresentacioGestio(node: number): readonly number[] {
  return NODE_REPARTIMENT_A_DETALLS[node] ?? [node];
}

/** Primer detall (compatibilitat). Preferiu `nodesPresentacioGestio`. */
export function nodePresentacioGestio(node: number): number {
  return nodesPresentacioGestio(node)[0] ?? node;
}

/** Total de repartiment del qual aquest detall hereta el delta (si n'hi ha). */
export function nodeTotalDesDeDetall(nodeDetall: number): number | null {
  for (const [total, detalls] of Object.entries(NODE_REPARTIMENT_A_DETALLS)) {
    if ((detalls as readonly number[]).includes(Number(nodeDetall))) {
      return Number(total);
    }
  }
  return null;
}

/** Fraccions 0..1 per repartir un delta entre detalls (pes = |base|). */
export function fraccionsRepartimentDetall(bases: readonly number[]): number[] {
  const n = bases.length;
  if (n === 0) return [];
  const pesos = bases.map((b) => Math.abs(b));
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (suma < 1e-9) return bases.map(() => 1 / n);
  return pesos.map((p) => p / suma);
}

/**
 * Parts del `delta` per cada línia de detall.
 * Amb `evitaPositius` (per defecte): un delta positiu sobre un cost no pot deixar la casella > 0.
 */
export function partsDeltaDetall(
  delta: number,
  bases: readonly number[],
  evitaPositius = true
): number[] {
  const n = bases.length;
  if (n === 0) return [];
  const fracs = fraccionsRepartimentDetall(bases);
  const parts = fracs.map((f) => delta * f);

  if (!evitaPositius || !(delta > 0)) return parts;

  let leftover = 0;
  for (let i = 0; i < n; i++) {
    // Costos van en negatiu: “room” fins a 0 = −base (si base < 0).
    const base = bases[i] ?? 0;
    const part = parts[i] ?? 0;
    const room = Math.max(0, -base);
    if (part > room) {
      leftover += part - room;
      parts[i] = room;
    }
  }
  if (leftover > 1e-9) {
    for (let i = 0; i < n && leftover > 1e-9; i++) {
      const base = bases[i] ?? 0;
      const part = parts[i] ?? 0;
      const room = Math.max(0, -base - part);
      const take = Math.min(room, leftover);
      parts[i] = part + take;
      leftover -= take;
    }
  }
  return parts;
}

/** Fracció del total que correspon a un detall concret (0..1). */
export function fraccioDetallDinsTotal(
  nodeDetall: number,
  nodeTotal: number,
  basesPerDetall: ReadonlyMap<number, number>
): number {
  const detalls = nodesPresentacioGestio(nodeTotal);
  if (!detalls.includes(nodeDetall)) return nodeDetall === nodeTotal ? 1 : 0;
  if (detalls.length === 1) return 1;
  const bases = detalls.map((d) => basesPerDetall.get(d) ?? 0);
  const fracs = fraccionsRepartimentDetall(bases);
  const idx = detalls.indexOf(nodeDetall);
  return idx >= 0 ? (fracs[idx] ?? 0) : 0;
}

export const CONCEPTE_NODE_LABEL: Record<number, string> = {
  [NODE_VENDES]: "VENDES",
  [NODE_INGRESSOS]: "TOTAL INGRESSOS EXPLOTACIO",
  [NODE_COMPRES]: "TOTAL COMPRES",
  [NODE_SOUS_SALARIS]: "SOUS I SALARIS",
  [NODE_SEGURETAT_SOCIAL]: "SEGURETAT SOCIAL",
  44: "CONTRACTES ETT",
  [NODE_COST_SALARIAL]: "TOTAL COST SALARIAL",
  [NODE_COST_GESTIO]: "TOTAL DESPESES GESTIO",
  [NODE_EBITDA]: "EBITDA",
};

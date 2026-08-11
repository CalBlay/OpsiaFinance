/** Tipus d'avís gestió (segur per client; sense db). */
export type InfoGestioConsulta = {
  mesosAmbDades: number;
  mesosConfirmats: number;
  teGestio: boolean;
  nomsConfirmats: string[];
  nomsPendents: string[];
  /** Repartiment desactivat mentre es redefineix. */
  enReconstruccio?: boolean;
  /** Node 30 (despeses de gestió) actiu. */
  faseGestioDespeses?: boolean;
  /** Node 11 (compres) actiu. */
  faseCompres?: boolean;
  /** Compres i/o gestió actius (compat). */
  faseCompresGestio?: boolean;
  /** Node 17 (personal SC) actiu. */
  fasePersonalSc?: boolean;
};

/** Tipus d'avís gestió (segur per client; sense db). */
export type InfoGestioConsulta = {
  mesosAmbDades: number;
  mesosConfirmats: number;
  teGestio: boolean;
  nomsConfirmats: string[];
  nomsPendents: string[];
};

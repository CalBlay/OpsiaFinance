import type { ConceptePivot } from "@/lib/consultes";
import { esLiniaFdlc } from "@/lib/grups-empresa";

/**
 * Separa la matriu consolidada (columnes = LN) en cares Cal Blay / FDLC
 * per a les normes ELIMINAR_PARELL_INTER.
 */
export function construirParellsInterEmpresaLn(
  conceptRows: ConceptePivot[],
  linies: { codi: string }[]
): Map<string, ConceptePivot[]> {
  const idxCb: number[] = [];
  const idxFdlc: number[] = [];
  linies.forEach((l, i) => {
    if (esLiniaFdlc(l.codi)) idxFdlc.push(i);
    else idxCb.push(i);
  });

  const mask = (idxs: number[]): ConceptePivot[] =>
    conceptRows.map((r) => {
      const valors = r.valors.map((v, i) => (idxs.includes(i) ? v : 0));
      return {
        ...r,
        valors,
        total: valors.reduce((a, b) => a + b, 0),
      };
    });

  return new Map([
    ["calblay", mask(idxCb)],
    ["fdlc", mask(idxFdlc)],
  ]);
}

/**
 * @deprecated Importeu des de `@/lib/consolidacio/*`. Es manté per compatibilitat.
 */
export {
  NODE_CONSUMS_INTERNS,
  NODE_MOVIMENTS_INTERNS,
  NODE_ALTRES_INGRESSOS,
  NODE_COMPRES_DETALL,
} from "@/lib/consolidacio/normes-seed";

export { aplicarNormesConsolidacio } from "@/lib/consolidacio/motor";
export { aplicarConsolidacio, getNormesConsolidacio } from "@/lib/consolidacio/service";

import { aplicarNormesConsolidacio } from "@/lib/consolidacio/motor";
import { NORMES_CONSOLIDACIO_SEED } from "@/lib/consolidacio/normes-seed";
import type { ConceptePivot } from "@/lib/consultes";

const NORMES_CALBLAY_INTRA_FALLBACK = NORMES_CONSOLIDACIO_SEED.filter(
  (n) => n.grup === "CALBLAY_INTRA" && n.actiu
);

/** Fallback síncron si encara no hi ha normes a BD (tests / primera arrencada). */
export function consolidarConceptesEmpresa(concepts: ConceptePivot[]): ConceptePivot[] {
  return aplicarNormesConsolidacio(concepts, NORMES_CALBLAY_INTRA_FALLBACK, "columnes-ln");
}

export function consolidarConceptesEmpresaTemporal(concepts: ConceptePivot[]): ConceptePivot[] {
  return aplicarNormesConsolidacio(concepts, NORMES_CALBLAY_INTRA_FALLBACK, "temporal");
}

export type AmbitConsolidacio = "empresa" | "linia" | "centre";

export function consolidarSiEmpresa(
  scope: AmbitConsolidacio,
  concepts: ConceptePivot[],
  mode: "columnes-ln" | "temporal"
): ConceptePivot[] {
  if (scope !== "empresa") return concepts;
  return mode === "columnes-ln"
    ? consolidarConceptesEmpresa(concepts)
    : consolidarConceptesEmpresaTemporal(concepts);
}

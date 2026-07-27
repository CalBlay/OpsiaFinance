import { aplicarNormesConsolidacio } from "@/lib/consolidacio/motor";
import type { ConceptePivot } from "@/lib/consultes";
import { db } from "@/lib/db";
import type { GrupConsolidacio } from "@prisma/client";
import { cache } from "react";

export const getNormesConsolidacio = cache(async (grup: GrupConsolidacio) => {
  return db.normaConsolidacio.findMany({
    where: { grup },
    orderBy: { ordre: "asc" },
  });
});

export async function aplicarConsolidacio(
  concepts: ConceptePivot[],
  grup: GrupConsolidacio,
  mode: "columnes-ln" | "temporal",
  parellsInterEmpresa?: Map<string, ConceptePivot[]>
): Promise<ConceptePivot[]> {
  const normes = await getNormesConsolidacio(grup);
  if (normes.length === 0) return concepts;
  return aplicarNormesConsolidacio(concepts, normes, mode, parellsInterEmpresa);
}

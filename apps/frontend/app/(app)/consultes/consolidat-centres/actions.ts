"use server";

import {
  type CompteExplotacioCentresConsolidat,
  type ConceptePivot,
  getCompteExplotacioCentresConsolidat,
  normalitzaCentreIds,
} from "@/lib/consultes";
import { slimConceptsForPaint } from "@/lib/consultes-slim";
import { type VistaCompte, parseVistaCompte } from "@/lib/vista-compte";

/** Capa consolidada en diferit (KPIs slim). */
export async function carregarConsolidatCapaAction(
  centreIds: string[],
  any: number,
  vista: VistaCompte
): Promise<CompteExplotacioCentresConsolidat | null> {
  const ids = normalitzaCentreIds(centreIds);
  if (!ids.length) return null;
  const full = await getCompteExplotacioCentresConsolidat(ids, any, parseVistaCompte(vista));
  return { ...full, concepts: slimConceptsForPaint(full.concepts) };
}

/** Compte detallat consolidat (pivot). */
export async function carregarConsolidatPivotAction(
  centreIds: string[],
  any: number,
  vista: VistaCompte
): Promise<ConceptePivot[]> {
  const ids = normalitzaCentreIds(centreIds);
  if (!ids.length) return [];
  const compte = await getCompteExplotacioCentresConsolidat(ids, any, parseVistaCompte(vista));
  return compte.concepts;
}

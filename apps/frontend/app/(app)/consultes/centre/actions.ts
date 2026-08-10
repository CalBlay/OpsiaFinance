"use server";

/**
 * Compatibilitat: l'ajust des de consultes viu a `../actions`.
 * Aquest fitxer manté revalidatePath usat per altres fluxos del centre.
 */

import { type ConceptePivot, getCompteExplotacioCentre } from "@/lib/consultes";
import { slimConceptsForPaint } from "@/lib/consultes-slim";
import type { VistaCompte } from "@/lib/vista-compte";
import { type AjustarImportConsultaInput, ajustarImportConsultaAction } from "../actions";

export async function ajustarImportCentreAction(input: AjustarImportConsultaInput) {
  return ajustarImportConsultaAction(input);
}

/** Capa Gestió del centre en diferit (KPIs slim; pivot en obrir el compte). */
export async function carregarCentreGestioAction(centreId: string, any: number) {
  const full = await getCompteExplotacioCentre(centreId, any, "gestio");
  return { ...full, concepts: slimConceptsForPaint(full.concepts) };
}

/** Compte detallat complet del centre en diferit. */
export async function carregarCentrePivotAction(
  centreId: string,
  any: number,
  vista: VistaCompte
): Promise<ConceptePivot[]> {
  const compte = await getCompteExplotacioCentre(
    centreId,
    any,
    vista === "gestio" ? "gestio" : "directe"
  );
  return compte.concepts;
}

"use server";

/**
 * Compatibilitat: l'ajust des de consultes viu a `../actions`.
 * Aquest fitxer manté revalidatePath usat per altres fluxos del centre.
 */

import { getCompteExplotacioCentre } from "@/lib/consultes";
import { type AjustarImportConsultaInput, ajustarImportConsultaAction } from "../actions";

export async function ajustarImportCentreAction(input: AjustarImportConsultaInput) {
  return ajustarImportConsultaAction(input);
}

/** Capa Gestió del centre en diferit (després del paint Directe). */
export async function carregarCentreGestioAction(centreId: string, any: number) {
  return getCompteExplotacioCentre(centreId, any, "gestio");
}

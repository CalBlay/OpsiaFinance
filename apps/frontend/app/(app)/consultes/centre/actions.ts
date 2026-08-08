"use server";

/**
 * Compatibilitat: l'ajust des de consultes viu a `../actions`.
 * Aquest fitxer manté revalidatePath usat per altres fluxos del centre.
 */

import { getCompteExplotacioCentre } from "@/lib/consultes";

export { ajustarImportConsultaAction as ajustarImportCentreAction } from "../actions";

/** Capa Gestió del centre en diferit (després del paint Directe). */
export async function carregarCentreGestioAction(centreId: string, any: number) {
  return getCompteExplotacioCentre(centreId, any, "gestio");
}

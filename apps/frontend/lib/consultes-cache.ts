import { revalidateTag } from "next/cache";

/** Tag compartit per agregats de consultes (`unstable_cache`). */
export const CONSULTES_CACHE_TAG = "consultes-dades";

/** Invalida la cache d'agregats de consultes (imports, ajustos, repartiment, …). */
export function revalidateConsultesDades() {
  revalidateTag(CONSULTES_CACHE_TAG);
}

import { unstable_expireTag } from "next/cache";

/** Tag compartit per agregats de consultes (`unstable_cache`). */
export const CONSULTES_CACHE_TAG = "consultes-dades";

/**
 * Epoch local al procés. `revalidateTag` / `unstable_expireTag` només marquen
 * l'entrada com a stale i Next.js continua servint el valor vell (SWR) a la
 * primera petició. Canviar la clau força un miss i dades immediates.
 */
let cacheEpoch = 0;

export function consultesCacheEpoch(): string {
  return String(cacheEpoch);
}

export function consultesCacheKey(...parts: string[]): string[] {
  return [...parts, consultesCacheEpoch()];
}

/** Invalida la cache d'agregats de consultes (imports, ajustos, repartiment, …). */
export function revalidateConsultesDades() {
  cacheEpoch += 1;
  unstable_expireTag(CONSULTES_CACHE_TAG);
}

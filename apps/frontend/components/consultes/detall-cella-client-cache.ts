import type { DetallCellaParams, DetallCellaResult } from "@/lib/consultes";

const cache = new Map<string, DetallCellaResult>();
const inflight = new Map<string, Promise<DetallCellaResult>>();

export function detallCellaCacheKey(params: DetallCellaParams): string {
  return [
    params.concepteResultatId,
    params.any,
    params.mes ?? "",
    params.rang ? `${params.rang.des}-${params.rang.fins}` : "",
    params.centreId ?? "",
    params.liniaNegociId ?? "",
    (params.lnIdsGrup ?? []).slice().sort().join(","),
    params.vista ?? "directe",
    params.grup ?? "",
  ].join("|");
}

export function getDetallCellaCached(key: string): DetallCellaResult | undefined {
  return cache.get(key);
}

export function setDetallCellaCached(key: string, data: DetallCellaResult): void {
  cache.set(key, data);
}

export function clearDetallCellaCached(key?: string): void {
  if (key) {
    cache.delete(key);
    inflight.delete(key);
    return;
  }
  cache.clear();
  inflight.clear();
}

export function loadDetallCellaCached(
  key: string,
  fetcher: () => Promise<DetallCellaResult>
): Promise<DetallCellaResult> {
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = fetcher()
    .then((data) => {
      cache.set(key, data);
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, promise);
  return promise;
}

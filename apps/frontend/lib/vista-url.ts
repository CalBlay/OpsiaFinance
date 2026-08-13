/** Actualitza un search param a l'URL sense disparar navegació RSC. */
export function replaceSearchParam(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value == null || value === "") url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

/** Actualitza ?vista= a l'URL sense disparar navegació RSC. */
export function replaceVistaQuery(vista: string): void {
  replaceSearchParam("vista", vista === "directe" ? null : vista);
}

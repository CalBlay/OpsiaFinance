/**
 * Etiquetes unificades de centre i línia de negoci per a filtres i llistes
 * de consultes. Totes les pestanyes han d'usar aquestes funcions.
 *
 * Format: «CODI · Nom» — ordre per codi.
 */

export type DimensioEtiqueta = {
  codi?: string | null;
  nom?: string | null;
  /** Si existeix (p.ex. restaurant), té preferència sobre `nom`. */
  etiqueta?: string | null;
};

/** Comparador per ordenar filtres per codi (numèric quan escau). */
export function comparaPerCodi(a: { codi?: string | null }, b: { codi?: string | null }): number {
  return (a.codi ?? "").localeCompare(b.codi ?? "", "ca", {
    sensitivity: "base",
    numeric: true,
  });
}

/** Ordena una llista de centres / LN per codi. */
export function ordenaPerCodi<T extends { codi?: string | null }>(items: T[]): T[] {
  return [...items].sort(comparaPerCodi);
}

/** Etiqueta unificada: «CODI · Nom». */
export function etiquetaDimensio(item: DimensioEtiqueta): string {
  const codi = (item.codi ?? "").trim();
  const nom = (item.etiqueta ?? item.nom ?? "").trim();
  if (codi && nom) return `${codi} · ${nom}`;
  return nom || codi || "—";
}

/** Línia de negoci als selectors de Resultats. */
export function etiquetaLiniaNegoci(ln: DimensioEtiqueta): string {
  return etiquetaDimensio(ln);
}

/** Centre / restaurant als selectors de Resultats. */
export function etiquetaCentre(centre: DimensioEtiqueta): string {
  return etiquetaDimensio(centre);
}

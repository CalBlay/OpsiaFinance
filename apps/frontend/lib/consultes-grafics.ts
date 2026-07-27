/** Centre d'administració / overhead — s'exclou dels gràfics de vendes operatives. */
export function esCentreAdministracio(item: { codi: string; nom: string }): boolean {
  const n = item.nom.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  const c = item.codi.toUpperCase();
  return (
    n.includes("ADMINISTRAC") ||
    n.includes("ADMINISTR") ||
    n.startsWith("ADMIN ") ||
    c.includes("ADMIN")
  );
}

export interface DimensioGrafic {
  id: string;
  codi: string;
  nom: string;
}

export function indicesCentresOperatius(centres: DimensioGrafic[]): number[] {
  return centres.flatMap((c, i) => (esCentreAdministracio(c) ? [] : [i]));
}

export function filtraValors<T>(valors: T[], indices: number[]): T[] {
  return indices.map((i) => valors[i]);
}

const PREFIXOS_NOM = [/^RESTAURANT\s+/i, /^L[ÍI]NIA\s+DE\s+NEGOCI\s+/i];

function netejaPrefixNom(nom: string): string {
  let s = nom.trim();
  for (const re of PREFIXOS_NOM) {
    s = s.replace(re, "");
  }
  return s.trim() || nom.trim();
}

export function etiquetaGrafic(item: { nom: string; codi?: string }): string {
  const raw = item.nom.trim() || item.codi || "—";
  return netejaPrefixNom(raw);
}

export interface VendesSegment {
  name: string;
  value: number;
}

/** Segments de vendes per centre/LN, exclou administració i valors zero. */
export function segmentsVendes(
  dimensions: DimensioGrafic[],
  valors: number[],
  exclouAdmin = true
): VendesSegment[] {
  return dimensions
    .map((d, i) => ({ dim: d, value: valors[i] ?? 0 }))
    .filter(({ dim, value }) => value !== 0 && (!exclouAdmin || !esCentreAdministracio(dim)))
    .map(({ dim, value }) => ({ name: etiquetaGrafic(dim), value }));
}

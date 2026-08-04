/**
 * Categoria comercial a partir de la taxonomia TPV (Grup / Família / Subfamília).
 * Regla: si cap dels tres conté «begud» (beguda/begudes) → BEGUDA; altrament MENJAR.
 * Si no hi ha taxonomia → null.
 */

export type CategoriaVenda = "MENJAR" | "BEGUDA";

export function categoriaDesDeTaxonomia(
  grup: string | null | undefined,
  familia?: string | null,
  subfamilia?: string | null
): CategoriaVenda | null {
  const blob = [grup, familia, subfamilia]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  if (!blob) return null;
  if (blob.includes("begud")) return "BEGUDA";
  return "MENJAR";
}

export function etiquetaCategoria(c: CategoriaVenda): string {
  return c === "BEGUDA" ? "Beguda" : "Menjar";
}

/** Pack: només subfamília menús (ex. «MENUS RESTAURANTS») entra al rànquing. */
export function esSubfamiliaMenus(subfamilia: string | null | undefined): boolean {
  const s = (subfamilia ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  return s.includes("menus");
}

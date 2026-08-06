/** Normalitza un títol a un nom de fitxer segur (sense accents ni espais). */
export function slugFilename(input: string, maxLen = 80): string {
  const slug = input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "informe").slice(0, maxLen);
}

export function withExtension(filename: string, ext: "xlsx" | "pdf"): string {
  const base = filename.replace(/\.(xlsx|pdf)$/i, "");
  return `${base}.${ext}`;
}

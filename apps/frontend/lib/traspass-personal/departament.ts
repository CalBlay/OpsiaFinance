import type { DepartamentSalarial } from "@prisma/client";

/**
 * Inferèix SALA/CUINA del text d'Organizaciones/Proyecto.
 * Cuina/Cuiner → CUINA; Sala/Serveis/Cambrer → SALA.
 */
export function inferDepartamentSalarial(text: string): DepartamentSalarial | null {
  const t = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  if (/\bcuina\b/.test(t) || /\bcuiner/.test(t) || /\bcocin/.test(t)) return "CUINA";
  if (/\bsala\b/.test(t) || /\bserveis?\b/.test(t) || /\bcambrer/.test(t)) return "SALA";
  return null;
}

/** Parseja una etiqueta explícita (columna Excel o UI). */
export function parseDepartamentSalarialLabel(raw: string): DepartamentSalarial | null {
  const t = raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  if (!t) return null;
  if (t === "cuina" || t === "cocina" || t.startsWith("cuin") || t.startsWith("cocin")) {
    return "CUINA";
  }
  if (t === "sala" || t.startsWith("servei") || t.startsWith("servic") || t.startsWith("cambr")) {
    return "SALA";
  }
  return null;
}

export function etiquetaDepartamentSalarial(d: DepartamentSalarial): string {
  return d === "CUINA" ? "Cuina" : "Sala";
}

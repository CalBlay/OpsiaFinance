/**
 * Mapeig Configuració → Traspassos personal.
 *
 * Una fila de configuració: text → LN → centre (+ departament de l'arbre).
 * Una cel·la Excel es resol així (per ordre):
 *   1) text sencer == text del mapeig
 *   2) part abans de la coma == text del mapeig
 *       (Excel «Orígens cuina, Responsable…» ↔ mapeig «Orígens cuina»)
 */

import type { DepartamentSalarial } from "@prisma/client";

export type MapeigCentre = {
  text: string;
  centreId: string;
  centreCodi: string;
  centreNom: string;
  departament: DepartamentSalarial;
  /** Departament de l'arbre (dimensió 3). Null = tot el centre. */
  departamentId: string | null;
  departamentCodi: string | null;
  departamentNom: string | null;
};

/** Clau comparable: minúscules, sense accents, un sol espai. */
export function clauMapeig(text: string): string {
  return text
    .trim()
    .replace(/^\d+\s+/, "")
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** «Orígens cuina, Responsable cuina Orígens» → «Orígens cuina». */
export function textAbansDeComa(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  const i = t.indexOf(",");
  return (i >= 0 ? t.slice(0, i) : t).trim();
}

export type IndexMapeig = {
  /** clau → mapeig (text complet de configuració). */
  perClau: Map<string, MapeigCentre>;
  avisos: string[];
};

/** Construeix l'índex a partir de la taula de configuració. */
export function indexarMapeigs(mapeigs: MapeigCentre[]): IndexMapeig {
  const perClau = new Map<string, MapeigCentre>();
  const avisos: string[] = [];

  for (const m of mapeigs) {
    const text = m.text.trim();
    if (!text) continue;
    const k = clauMapeig(text);
    const prev = perClau.get(k);
    if (
      prev &&
      (prev.centreId !== m.centreId ||
        prev.departament !== m.departament ||
        (prev.departamentId ?? "") !== (m.departamentId ?? ""))
    ) {
      avisos.push(
        `Mapeig duplicat «${text}»: ja hi ha «${prev.text}» → ${prev.centreCodi}. Es manté el primer.`
      );
      continue;
    }
    if (!prev) perClau.set(k, m);
  }

  return { perClau, avisos };
}

/** Resol un text Excel (Organizaciones o Proyecto) contra la configuració. */
export function resoldreMapeig(textExcel: string, index: IndexMapeig): MapeigCentre | null {
  const raw = textExcel.trim();
  if (!raw) return null;

  const full = index.perClau.get(clauMapeig(raw));
  if (full) return full;

  const cap = textAbansDeComa(raw);
  if (cap) {
    const perCap = index.perClau.get(clauMapeig(cap));
    if (perCap) return perCap;
  }

  return null;
}

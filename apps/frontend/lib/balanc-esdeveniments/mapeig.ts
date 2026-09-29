import { db } from "@/lib/db";

/** Text de mapeig per al fitxer residual (A2 buit; es reconeix pel nom del fitxer). */
export const TEXT_MAPEIG_BALANC_TOTAL = "Balanç total";

export function normalitzarTextMapeigEsdeveniments(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toUpperCase();
}

/** True si el nom del fitxer indica el document «Balanç total» (A2 va en blanc). */
export function esNomFitxerBalancTotal(nomFitxer: string): boolean {
  const base = nomFitxer.replace(/\.[^.]+$/, "");
  const n = base
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /\bbalanc\s*total\b/.test(n);
}

export async function resolCentreBalancEsdeveniments(textRaw: string): Promise<{
  centreId: string;
  liniaNegociId: string;
  centreCodi: string;
  centreNom: string;
  textMapeig: string;
} | null> {
  const text = textRaw.trim();
  if (!text) return null;

  const exact = await db.mapeigCentreBalancEsdeveniments.findFirst({
    where: { isActive: true, text: { equals: text, mode: "insensitive" } },
    include: {
      centre: {
        select: {
          id: true,
          codi: true,
          nom: true,
          liniaNegociId: true,
          isActive: true,
        },
      },
    },
  });

  if (exact?.centre.isActive) {
    return {
      centreId: exact.centre.id,
      liniaNegociId: exact.centre.liniaNegociId,
      centreCodi: exact.centre.codi,
      centreNom: exact.centre.nom,
      textMapeig: exact.text,
    };
  }

  const tots = await db.mapeigCentreBalancEsdeveniments.findMany({
    where: { isActive: true },
    include: {
      centre: {
        select: {
          id: true,
          codi: true,
          nom: true,
          liniaNegociId: true,
          isActive: true,
        },
      },
    },
  });
  const target = normalitzarTextMapeigEsdeveniments(text);
  const hit = tots.find(
    (m) => m.centre.isActive && normalitzarTextMapeigEsdeveniments(m.text) === target
  );
  if (!hit) return null;

  return {
    centreId: hit.centre.id,
    liniaNegociId: hit.centre.liniaNegociId,
    centreCodi: hit.centre.codi,
    centreNom: hit.centre.nom,
    textMapeig: hit.text,
  };
}

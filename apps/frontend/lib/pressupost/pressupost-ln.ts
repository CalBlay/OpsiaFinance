import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { cache } from "react";

export type PressupostConcepte = {
  id: string;
  node: number;
  descripcio: string;
  esSubtotal: boolean;
  ordre: number;
};

export type PressupostLnCapcalera = {
  id: string;
  any: number;
  liniaNegociId: string;
  estat: "ESBORRANY" | "CONFIRMAT";
  notes: string | null;
  generalDesDeCentres: boolean;
  updatedAt: string;
};

export type PressupostCel = {
  mes: number;
  concepteResultatId: string;
  import_: number;
};

export type LiniaNegociOption = {
  id: string;
  codi: string;
  nom: string;
};

export const getConceptesPressupost = cache(async (): Promise<PressupostConcepte[]> => {
  return unstable_cache(
    async () =>
      db.concepteResultat.findMany({
        where: { isActive: true },
        orderBy: { ordre: "asc" },
        select: {
          id: true,
          node: true,
          descripcio: true,
          esSubtotal: true,
          ordre: true,
        },
      }),
    consultesCacheKey("pressupost-conceptes"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
});

export const getLiniesNegociPressupost = cache(async (): Promise<LiniaNegociOption[]> => {
  return unstable_cache(
    async () =>
      db.liniaNegoci.findMany({
        where: { isActive: true },
        orderBy: { ordre: "asc" },
        select: { id: true, codi: true, nom: true },
      }),
    consultesCacheKey("pressupost-linies"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
});

export async function getPressupostLn(
  any: number,
  liniaNegociId: string
): Promise<{ capcalera: PressupostLnCapcalera | null; cels: PressupostCel[] }> {
  const row = await db.pressupostLn.findUnique({
    where: { any_liniaNegociId: { any, liniaNegociId } },
    select: {
      id: true,
      any: true,
      liniaNegociId: true,
      estat: true,
      notes: true,
      generalDesDeCentres: true,
      updatedAt: true,
      cels: {
        select: {
          mes: true,
          concepteResultatId: true,
          import_: true,
        },
      },
    },
  });

  if (!row) return { capcalera: null, cels: [] };

  return {
    capcalera: {
      id: row.id,
      any: row.any,
      liniaNegociId: row.liniaNegociId,
      estat: row.estat,
      notes: row.notes,
      generalDesDeCentres: row.generalDesDeCentres,
      updatedAt: row.updatedAt.toISOString(),
    },
    cels: row.cels.map((c) => ({
      mes: c.mes,
      concepteResultatId: c.concepteResultatId,
      import_: Number(c.import_),
    })),
  };
}

export async function listAnysPressupost(): Promise<number[]> {
  const rows = await db.pressupostLn.findMany({
    select: { any: true },
    distinct: ["any"],
    orderBy: { any: "desc" },
  });
  return rows.map((r) => r.any);
}

import { getArbreSeleccio } from "@/lib/consultes";
import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { cache } from "react";

export type AjustLlistaItem = {
  id: string;
  import_: number;
  motiu: string;
  createdAt: string;
  periodAny: number;
  periodMes: number;
  periodNom: string;
  concepteResultatId: string;
  centreId: string | null;
  liniaNegociId: string | null;
  concepte: string;
  centre: string | null;
  liniaNegoci: string | null;
  autor: string;
};

/** Conceptes actius per als selectors d'ajustos. */
export const getConceptesAjustOptions = cache(async () => {
  return unstable_cache(
    async () =>
      db.concepteResultat.findMany({
        orderBy: { ordre: "asc" },
        select: { id: true, node: true, descripcio: true },
        where: { isActive: true },
      }),
    consultesCacheKey("dades-ajustos-conceptes"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 300 }
  )();
});

/** Llista d'ajustos per a /dades/ajustos (invalidada amb revalidateConsultesDades). */
export const getAjustosLlista = cache(async (): Promise<AjustLlistaItem[]> => {
  return unstable_cache(
    async () => {
      const ajustos = await db.ajust.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          import_: true,
          motiu: true,
          createdAt: true,
          concepteResultatId: true,
          centreId: true,
          liniaNegociId: true,
          period: { select: { any: true, mes: true, nom: true } },
          concepteResultat: { select: { descripcio: true } },
          centre: { select: { codi: true, nom: true } },
          liniaNegoci: { select: { codi: true, nom: true } },
          creatPerUser: { select: { name: true } },
        },
      });

      return ajustos.map((a) => ({
        id: a.id,
        import_: Number(a.import_),
        motiu: a.motiu,
        createdAt: a.createdAt.toISOString(),
        periodAny: a.period.any,
        periodMes: a.period.mes,
        periodNom: a.period.nom,
        concepteResultatId: a.concepteResultatId,
        centreId: a.centreId,
        liniaNegociId: a.liniaNegociId,
        concepte: a.concepteResultat.descripcio,
        centre: a.centre ? `${a.centre.codi} · ${a.centre.nom}` : null,
        liniaNegoci: a.liniaNegoci ? `${a.liniaNegoci.codi} · ${a.liniaNegoci.nom}` : null,
        autor: a.creatPerUser.name || "Usuari desconegut",
      }));
    },
    consultesCacheKey("dades-ajustos-llista"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 60 }
  )();
});

/** Dades principals de la pàgina d'ajustos (paral·lel + cache). */
export async function getAjustosPageData() {
  const [arbre, concepts, ajustos] = await Promise.all([
    getArbreSeleccio(),
    getConceptesAjustOptions(),
    getAjustosLlista(),
  ]);
  return { arbre, concepts, ajustos };
}

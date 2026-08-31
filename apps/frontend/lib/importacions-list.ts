import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { cache } from "react";

const IMPORTS_LIST_LIMIT = 200;

/** Llista d'importacions per a /dades (cache compartit amb consultes). */
export const getImportacionsLlista = cache(async () => {
  return unstable_cache(
    async () =>
      db.importacio.findMany({
        orderBy: { createdAt: "desc" },
        take: IMPORTS_LIST_LIMIT,
        include: {
          formatInforme: { select: { nom: true, tipusInforme: true } },
          period: { select: { any: true, mes: true, nom: true } },
          liniaNegoci: { select: { codi: true, nom: true } },
          creatPerUser: { select: { name: true } },
        },
      }),
    consultesCacheKey("dades-importacions-llista"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 60 }
  )();
});

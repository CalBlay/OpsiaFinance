import type { CarregaFitxerLlistaItem, TipusCarregaFitxer } from "@/lib/carrega-fitxer";
import { llistaCarreguesFitxerUncached } from "@/lib/carrega-fitxer";
import { CONSULTES_CACHE_TAG, consultesCacheKey } from "@/lib/consultes-cache";
import { db } from "@/lib/db";
import { personalSobrantAlDia } from "@/lib/repartiment/personal-departaments-constants";
import { carregarConfigPersonalUncached } from "@/lib/repartiment/personal-departaments-data";
import { unstable_cache } from "next/cache";
import { cache } from "react";

export type RepartimentPeriodItem = {
  id: string;
  nom: string;
  any: number;
  mes: number;
  estat: "CONFIRMAT" | "BORRADOR" | null;
  personalReglaAplicada: boolean;
};

/** Historial de càrregues Excel (cost salarial, personal, vendes…). */
export const getCarreguesFitxerLlista = cache(
  async (tipus: TipusCarregaFitxer | TipusCarregaFitxer[]): Promise<CarregaFitxerLlistaItem[]> => {
    const key = Array.isArray(tipus) ? tipus.join(",") : tipus;
    return unstable_cache(
      () => llistaCarreguesFitxerUncached(tipus),
      consultesCacheKey("dades-carregues-fitxer", key),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 60 }
    )();
  }
);

/** Períodes amb dades SAP per al repartiment mensual. */
export const getRepartimentPeriodsLlista = cache(async (): Promise<RepartimentPeriodItem[]> => {
  return unstable_cache(
    async () => {
      const [periods, configPersonal] = await Promise.all([
        db.period.findMany({
          where: { dadesResultat: { some: {} } },
          orderBy: [{ any: "desc" }, { mes: "desc" }],
          include: {
            execucioRepartiment: {
              select: {
                id: true,
                estat: true,
                moviments: {
                  where: { detallCalcul: { contains: "sobrant" } },
                  select: { detallCalcul: true },
                  take: 1,
                },
              },
            },
          },
        }),
        carregarConfigPersonalUncached(),
      ]);

      const fraccioVigent = configPersonal.fraccioSobrantIguals;

      return periods.map((p) => ({
        id: p.id,
        nom: p.nom,
        any: p.any,
        mes: p.mes,
        estat: (p.execucioRepartiment?.estat as "CONFIRMAT" | "BORRADOR" | null) ?? null,
        personalReglaAplicada: personalSobrantAlDia(
          p.execucioRepartiment?.moviments[0]?.detallCalcul,
          fraccioVigent
        ),
      }));
    },
    consultesCacheKey("dades-repartiment-periods"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 60 }
  )();
});

/** Períodes amb traspass de personal importat. */
export const getTraspassPersonalPeriodsLlista = cache(async () => {
  return unstable_cache(
    async () =>
      db.period.findMany({
        where: { execucioTraspassPersonal: { isNot: null } },
        orderBy: [{ any: "desc" }, { mes: "desc" }],
        include: {
          execucioTraspassPersonal: {
            select: {
              id: true,
              estat: true,
              nomFitxer: true,
              createdAt: true,
              updatedAt: true,
              importacio: {
                select: {
                  id: true,
                  nomFitxer: true,
                  createdAt: true,
                  creatPerUser: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    consultesCacheKey("dades-traspass-periods"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 60 }
  )();
});

/** Anys amb cost personal per centre (nòmina / millores). */
export const getAnysAmbCostPersonalCentre = cache(async (): Promise<number[]> => {
  return unstable_cache(
    async () => {
      const rows = await db.period.findMany({
        where: { costsPersonalsCentre: { some: {} } },
        select: { any: true },
        distinct: ["any"],
        orderBy: { any: "desc" },
      });
      const anys = rows.map((a) => a.any);
      return anys.length ? anys : [new Date().getFullYear()];
    },
    consultesCacheKey("dades-cost-personal-anys"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
});

/** Anys amb vendes restaurants (diàries o articles). */
export const getAnysAmbVendesRestaurants = cache(async (): Promise<number[]> => {
  return unstable_cache(
    async () => {
      const rows = await db.period.findMany({
        where: {
          OR: [{ vendesDiaries: { some: {} } }, { vendesArticles: { some: {} } }],
        },
        select: { any: true },
        distinct: ["any"],
        orderBy: { any: "desc" },
      });
      const anys = rows.map((a) => a.any);
      return anys.length ? anys : [new Date().getFullYear()];
    },
    consultesCacheKey("dades-vendes-anys"),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
});

/** Darrer mes amb dades per a un any (cost personal centre). */
export async function getDarrerMesCostPersonalCentre(any: number): Promise<number | null> {
  return unstable_cache(
    async () => {
      const p = await db.period.findFirst({
        where: { any, costsPersonalsCentre: { some: {} } },
        orderBy: { mes: "desc" },
        select: { mes: true },
      });
      return p?.mes ?? null;
    },
    consultesCacheKey("dades-cost-personal-darrer-mes", String(any)),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
}

/** Darrer mes amb dades per a un any (cost salarial). */
export async function getDarrerMesCostSalarial(any: number): Promise<number | null> {
  return unstable_cache(
    async () => {
      const p = await db.period.findFirst({
        where: { any, costsSalarials: { some: {} } },
        orderBy: { mes: "desc" },
        select: { mes: true },
      });
      return p?.mes ?? null;
    },
    consultesCacheKey("dades-cost-salarial-darrer-mes", String(any)),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
}

/** Darrer mes amb dades per a un any (vendes restaurants). */
export async function getDarrerMesVendesRestaurants(any: number): Promise<number | null> {
  return unstable_cache(
    async () => {
      const p = await db.period.findFirst({
        where: {
          any,
          OR: [{ vendesDiaries: { some: {} } }, { vendesArticles: { some: {} } }],
        },
        orderBy: { mes: "desc" },
        select: { mes: true },
      });
      return p?.mes ?? null;
    },
    consultesCacheKey("dades-vendes-darrer-mes", String(any)),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
}

export type VendesResumItem = {
  centreId: string;
  periodNom: string;
  periodAny: number;
  periodMes: number;
  centreCodi: string;
  centreNom: string;
  dies: number;
  baseDies: number;
  productes: number;
  packs: number;
  baseProductes: number;
  basePacks: number;
};

/** Resums agregats vendes per any/mes (cachejat). */
export const getVendesRestaurantsResums = cache(
  async (any: number, mes: number | null): Promise<VendesResumItem[]> => {
    return unstable_cache(
      async () => {
        const periodFilter = {
          period: {
            any,
            ...(mes != null ? { mes } : {}),
          },
        };

        const [diaries, articles] = await Promise.all([
          db.vendaDiariaRestaurant.findMany({
            where: periodFilter,
            select: {
              centreId: true,
              dia: true,
              base: true,
              period: { select: { any: true, mes: true, nom: true } },
              centre: { select: { codi: true, nom: true } },
            },
          }),
          db.vendaArticleRestaurant.findMany({
            where: periodFilter,
            select: {
              centreId: true,
              origen: true,
              base: true,
              period: { select: { any: true, mes: true, nom: true } },
              centre: { select: { codi: true, nom: true } },
            },
          }),
        ]);

        type Acc = VendesResumItem & { diesSet: Set<number> };
        const map = new Map<string, Acc>();

        for (const d of diaries) {
          const key = `${d.period.any}-${d.period.mes}-${d.centreId}`;
          const cur = map.get(key) ?? {
            centreId: d.centreId,
            periodNom: d.period.nom,
            periodAny: d.period.any,
            periodMes: d.period.mes,
            centreCodi: d.centre.codi,
            centreNom: d.centre.nom,
            dies: 0,
            diesSet: new Set<number>(),
            baseDies: 0,
            productes: 0,
            packs: 0,
            baseProductes: 0,
            basePacks: 0,
          };
          cur.diesSet.add(d.dia);
          cur.dies = cur.diesSet.size;
          cur.baseDies += Number(d.base);
          map.set(key, cur);
        }

        for (const a of articles) {
          const key = `${a.period.any}-${a.period.mes}-${a.centreId}`;
          const cur = map.get(key) ?? {
            centreId: a.centreId,
            periodNom: a.period.nom,
            periodAny: a.period.any,
            periodMes: a.period.mes,
            centreCodi: a.centre.codi,
            centreNom: a.centre.nom,
            dies: 0,
            diesSet: new Set<number>(),
            baseDies: 0,
            productes: 0,
            packs: 0,
            baseProductes: 0,
            basePacks: 0,
          };
          if (a.origen === "PACK") {
            cur.packs += 1;
            cur.basePacks += Number(a.base);
          } else {
            cur.productes += 1;
            cur.baseProductes += Number(a.base);
          }
          map.set(key, cur);
        }

        return [...map.values()]
          .map(({ diesSet: _diesSet, ...r }) => r)
          .sort((a, b) => {
            if (a.periodAny !== b.periodAny) return b.periodAny - a.periodAny;
            if (a.periodMes !== b.periodMes) return b.periodMes - a.periodMes;
            return a.centreCodi.localeCompare(b.centreCodi);
          });
      },
      consultesCacheKey("dades-vendes-resums", String(any), mes == null ? "all" : String(mes)),
      { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
    )();
  }
);

/** Registres cost personal centre per any/mes (cachejat). */
export const getCostPersonalCentreRegistres = cache(async (any: number, mes: number | null) => {
  return unstable_cache(
    async () =>
      db.costPersonalCentre.findMany({
        where: {
          period: {
            any,
            ...(mes != null ? { mes } : {}),
          },
        },
        orderBy: [
          { period: { mes: "desc" } },
          { origen: "asc" },
          { centre: { codi: "asc" } },
          { departamentSalarial: "asc" },
        ],
        select: {
          id: true,
          origen: true,
          importBrut: true,
          segSocialEmpresa: true,
          totalSegSocial: true,
          costPersonal: true,
          textOrigen: true,
          departamentSalarial: true,
          period: { select: { nom: true, any: true, mes: true } },
          centre: { select: { codi: true, nom: true } },
          departament: { select: { codi: true, nom: true } },
        },
        take: 5000,
      }),
    consultesCacheKey(
      "dades-cost-personal-registres",
      String(any),
      mes == null ? "all" : String(mes)
    ),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
});

/** Registres cost salarial per any/mes (cachejat). */
export const getCostSalarialRegistres = cache(async (any: number, mes: number | null) => {
  return unstable_cache(
    async () =>
      db.costSalarialRestaurant.findMany({
        where: {
          period: {
            any,
            ...(mes != null ? { mes } : {}),
          },
        },
        orderBy: [
          { period: { any: "desc" } },
          { period: { mes: "desc" } },
          { centre: { codi: "asc" } },
          { departament: "asc" },
        ],
        select: {
          id: true,
          departament: true,
          totalSalari: true,
          incentiusMensual: true,
          incentiuTrimestral: true,
          horesExtres: true,
          altres: true,
          baixes: true,
          indemnitzacions: true,
          foraCentre: true,
          notes: true,
          updatedAt: true,
          period: { select: { any: true, mes: true, nom: true } },
          centre: { select: { id: true, codi: true, nom: true } },
        },
      }),
    consultesCacheKey(
      "dades-cost-salarial-registres",
      String(any),
      mes == null ? "all" : String(mes)
    ),
    { tags: [CONSULTES_CACHE_TAG], revalidate: 120 }
  )();
});

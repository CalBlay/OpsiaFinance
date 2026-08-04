import { Prisma } from "@prisma/client";

/** True quan el client Prisma ja coneix grup/familia/categoria (després de `prisma generate`). */
export function teTaxonomiaVendesArticle(): boolean {
  const fields = (
    Prisma as unknown as {
      VendaArticleRestaurantScalarFieldEnum?: Record<string, string>;
    }
  ).VendaArticleRestaurantScalarFieldEnum;
  return !!fields && "categoria" in fields && "grup" in fields;
}

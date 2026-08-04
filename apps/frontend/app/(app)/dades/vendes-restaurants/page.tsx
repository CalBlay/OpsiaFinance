import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { VendesRestaurantsManager } from "./VendesRestaurantsManager";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendes restaurants — OpsiaFinance" };

export default async function VendesRestaurantsDadesPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const anyFiltre = sp.any ? Number(sp.any) : null;
  const mesFiltre = sp.mes ? Number(sp.mes) : null;

  const periodFilter =
    anyFiltre || mesFiltre
      ? {
          period: {
            ...(anyFiltre ? { any: anyFiltre } : {}),
            ...(mesFiltre ? { mes: mesFiltre } : {}),
          },
        }
      : {};

  const [session, anysRaw, diaries, articles] = await Promise.all([
    auth(),
    db.period.findMany({
      where: {
        OR: [{ vendesDiaries: { some: {} } }, { vendesArticles: { some: {} } }],
      },
      select: { any: true },
      distinct: ["any"],
      orderBy: { any: "desc" },
    }),
    db.vendaDiariaRestaurant.findMany({
      where: periodFilter,
      select: {
        centreId: true,
        unitats: true,
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

  type Acc = {
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
      baseDies: 0,
      productes: 0,
      packs: 0,
      baseProductes: 0,
      basePacks: 0,
    };
    cur.dies += 1;
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

  const resums = [...map.values()].sort((a, b) => {
    if (a.periodAny !== b.periodAny) return b.periodAny - a.periodAny;
    if (a.periodMes !== b.periodMes) return b.periodMes - a.periodMes;
    return a.centreCodi.localeCompare(b.centreCodi);
  });

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";
  const anys = anysRaw.map((a) => a.any);
  if (!anys.length) anys.push(new Date().getFullYear());

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.subtitle}>
          Vendes TPV per restaurant (LN00001). Tres fitxers mensuals: totals diaris (V), productes
          (Detall) i packs/menús (Pack). {resums.length} període
          {resums.length !== 1 ? "s" : ""}/centre
          {anyFiltre || mesFiltre ? " (filtre actiu)" : ""}.
        </p>
      </div>

      <VendesRestaurantsManager
        resums={resums}
        anys={anys}
        canEdit={canEdit}
        filtreAny={anyFiltre}
        filtreMes={mesFiltre}
      />
    </div>
  );
}

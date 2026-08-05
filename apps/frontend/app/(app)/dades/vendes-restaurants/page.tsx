import { DadesPageShell } from "@/components/dades/DadesPageShell";
import { getDadesTabById } from "@/components/dades/dades-tabs";
import { auth } from "@/lib/auth";
import { llistaCarreguesFitxer } from "@/lib/carrega-fitxer";
import { db } from "@/lib/db";
import { HistorialVendes } from "./HistorialVendes";
import { VendesRestaurantsManager } from "./VendesRestaurantsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendes restaurants — OpsiaFinance" };

const tab = getDadesTabById("vendes-restaurants");

export default async function VendesRestaurantsDadesPage({
  searchParams,
}: {
  searchParams: Promise<{ any?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const mesFiltre = sp.mes ? Number(sp.mes) : null;

  const [session, anysRaw, carregues] = await Promise.all([
    auth(),
    db.period.findMany({
      where: {
        OR: [{ vendesDiaries: { some: {} } }, { vendesArticles: { some: {} } }],
      },
      select: { any: true },
      distinct: ["any"],
      orderBy: { any: "desc" },
    }),
    llistaCarreguesFitxer(["VENDES_V", "VENDES_DETALL", "VENDES_PACK"]),
  ]);

  const anys = anysRaw.map((a) => a.any);
  if (!anys.length) anys.push(new Date().getFullYear());
  // Per defecte: darrer any amb dades (evita carregar tota l'historial).
  const anyFiltre = sp.any ? Number(sp.any) : anys[0];

  const periodFilter = {
    period: {
      any: anyFiltre,
      ...(mesFiltre ? { mes: mesFiltre } : {}),
    },
  };

  const [diaries, articles] = await Promise.all([
    db.vendaDiariaRestaurant.findMany({
      where: periodFilter,
      select: {
        centreId: true,
        dia: true,
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
    diesSet: Set<number>;
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

  const resums = [...map.values()]
    .map(({ diesSet: _diesSet, ...r }) => r)
    .sort((a, b) => {
      if (a.periodAny !== b.periodAny) return b.periodAny - a.periodAny;
      if (a.periodMes !== b.periodMes) return b.periodMes - a.periodMes;
      return a.centreCodi.localeCompare(b.centreCodi);
    });

  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "EDICIO";

  const meta = `${resums.length} període${resums.length !== 1 ? "s" : ""}/centre · ${anyFiltre}${
    mesFiltre ? `/${mesFiltre}` : ""
  }`;

  return (
    <DadesPageShell
      title={tab.title}
      description={
        <>
          {tab.description} {meta}.
        </>
      }
    >
      <HistorialVendes items={carregues} canEdit={canEdit} />
      <VendesRestaurantsManager
        resums={resums}
        anys={anys}
        canEdit={canEdit}
        filtreAny={anyFiltre}
        filtreMes={mesFiltre}
      />
    </DadesPageShell>
  );
}

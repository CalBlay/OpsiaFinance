import { getCentresRestaurants } from "@/lib/cost-salarial/consultes";
import { db } from "@/lib/db";
import type { DepartamentSalarial } from "@prisma/client";

export type ForaCentreCanvi = {
  centreId: string;
  centreCodi: string;
  centreNom: string;
  departament: DepartamentSalarial;
  abans: number;
  despres: number;
};

export type ForaCentreSnapshot = {
  canvis: ForaCentreCanvi[];
};

type MovimentFora = {
  centreDestiId: string;
  departament: DepartamentSalarial;
  import_: number | { toString(): string };
  centreDesti?: { codi: string; nom: string };
};

function n(v: number | { toString(): string }): number {
  return typeof v === "number" ? v : Number(v);
}

/** Agrega imports de traspass per destí × departament (només restaurants LN00001). */
export async function calcularForaCentreDesDeMoviments(
  moviments: MovimentFora[]
): Promise<Map<string, { centreId: string; departament: DepartamentSalarial; import_: number }>> {
  const restaurants = await getCentresRestaurants();
  const restaurantIds = new Set(restaurants.map((c) => c.id));
  const out = new Map<
    string,
    { centreId: string; departament: DepartamentSalarial; import_: number }
  >();

  for (const m of moviments) {
    if (!restaurantIds.has(m.centreDestiId)) continue;
    const key = `${m.centreDestiId}|${m.departament}`;
    const prev = out.get(key);
    const add = n(m.import_);
    if (prev) prev.import_ = Math.round((prev.import_ + add) * 100) / 100;
    else
      out.set(key, {
        centreId: m.centreDestiId,
        departament: m.departament,
        import_: Math.round(add * 100) / 100,
      });
  }
  return out;
}

/**
 * Substitueix foraCentre dels restaurants destinataris pels imports dels traspassos.
 * Retorna el snapshot abans/després per mostrar-lo a la UI.
 */
export async function aplicarForaCentreDesDeTraspass(
  periodId: string,
  moviments: MovimentFora[]
): Promise<ForaCentreSnapshot> {
  const nous = await calcularForaCentreDesDeMoviments(moviments);
  const restaurants = await getCentresRestaurants();
  const byId = new Map(restaurants.map((c) => [c.id, c]));

  // Centres restaurant amb moviments o amb fila existent al període
  const centreIds = new Set<string>([...nous.values()].map((v) => v.centreId));
  const existents = await db.costSalarialRestaurant.findMany({
    where: { periodId, centreId: { in: restaurants.map((c) => c.id) } },
    select: {
      centreId: true,
      departament: true,
      foraCentre: true,
      centre: { select: { codi: true, nom: true } },
    },
  });

  const canvis: ForaCentreCanvi[] = [];
  const vistos = new Set<string>();

  for (const row of existents) {
    const key = `${row.centreId}|${row.departament}`;
    vistos.add(key);
    const nou = nous.get(key)?.import_ ?? 0;
    const abans = Number(row.foraCentre);
    if (Math.abs(abans - nou) < 0.005 && !nous.has(key)) continue;

    await db.costSalarialRestaurant.updateMany({
      where: {
        periodId,
        centreId: row.centreId,
        departament: row.departament,
      },
      data: { foraCentre: nou },
    });

    if (Math.abs(abans - nou) >= 0.005 || nous.has(key)) {
      canvis.push({
        centreId: row.centreId,
        centreCodi: row.centre.codi,
        centreNom: row.centre.nom,
        departament: row.departament,
        abans,
        despres: nou,
      });
    }
    centreIds.add(row.centreId);
  }

  for (const [key, nou] of nous) {
    if (vistos.has(key)) continue;
    const centre = byId.get(nou.centreId);
    if (!centre) continue;

    await db.costSalarialRestaurant.upsert({
      where: {
        periodId_centreId_departament: {
          periodId,
          centreId: nou.centreId,
          departament: nou.departament,
        },
      },
      update: { foraCentre: nou.import_ },
      create: {
        periodId,
        centreId: nou.centreId,
        departament: nou.departament,
        foraCentre: nou.import_,
      },
    });

    canvis.push({
      centreId: nou.centreId,
      centreCodi: centre.codi,
      centreNom: centre.nom,
      departament: nou.departament,
      abans: 0,
      despres: nou.import_,
    });
  }

  canvis.sort(
    (a, b) => a.centreCodi.localeCompare(b.centreCodi) || a.departament.localeCompare(b.departament)
  );

  return { canvis };
}

/** Restaura foraCentre als valors «abans» del snapshot (en tornar a esborrany). */
export async function restaurarForaCentreDesDeSnapshot(
  periodId: string,
  snapshot: ForaCentreSnapshot | null
): Promise<void> {
  if (!snapshot?.canvis.length) return;

  for (const c of snapshot.canvis) {
    await db.costSalarialRestaurant.updateMany({
      where: {
        periodId,
        centreId: c.centreId,
        departament: c.departament,
      },
      data: { foraCentre: c.abans },
    });
  }
}

export function parseForaCentreSnapshot(raw: string | null | undefined): ForaCentreSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ForaCentreSnapshot;
    if (!parsed?.canvis || !Array.isArray(parsed.canvis)) return null;
    return parsed;
  } catch {
    return null;
  }
}

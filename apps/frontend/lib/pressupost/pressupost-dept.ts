import { db } from "@/lib/db";
import { type PeriodicitatTipusB, normalitzaMesos } from "@/lib/pressupost/tipus-b";

export type PressupostDeptCapcalera = {
  id: string;
  any: number;
  departamentId: string;
  estat: "ESBORRANY" | "CONFIRMAT";
  notes: string | null;
  updatedAt: string;
};

export type PressupostLiniaDeptRow = {
  id: string;
  partidaCatalogId: string | null;
  categoria: string;
  descripcio: string;
  premissa: string | null;
  periodicitat: PeriodicitatTipusB;
  importUnitari: number;
  mesos: number[];
  ordre: number;
};

export type DepartamentPressupostInfo = {
  id: string;
  codi: string;
  nom: string;
  centreId: string;
  centreCodi: string;
  centreNom: string;
};

export async function getDepartamentPressupost(
  departamentId: string
): Promise<DepartamentPressupostInfo | null> {
  const d = await db.departament.findFirst({
    where: { id: departamentId, isActive: true },
    select: {
      id: true,
      codi: true,
      nom: true,
      centreId: true,
      centre: { select: { codi: true, nom: true } },
    },
  });
  if (!d) return null;
  return {
    id: d.id,
    codi: d.codi,
    nom: d.nom,
    centreId: d.centreId,
    centreCodi: d.centre.codi,
    centreNom: d.centre.nom,
  };
}

export async function getPressupostDept(
  any: number,
  departamentId: string
): Promise<{
  capcalera: PressupostDeptCapcalera | null;
  linies: PressupostLiniaDeptRow[];
}> {
  const row = await db.pressupostDept.findUnique({
    where: { any_departamentId: { any, departamentId } },
    select: {
      id: true,
      any: true,
      departamentId: true,
      estat: true,
      notes: true,
      updatedAt: true,
      linies: {
        orderBy: [{ ordre: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          partidaCatalogId: true,
          categoria: true,
          descripcio: true,
          premissa: true,
          periodicitat: true,
          importUnitari: true,
          mesos: true,
          ordre: true,
        },
      },
    },
  });

  if (!row) return { capcalera: null, linies: [] };

  return {
    capcalera: {
      id: row.id,
      any: row.any,
      departamentId: row.departamentId,
      estat: row.estat,
      notes: row.notes,
      updatedAt: row.updatedAt.toISOString(),
    },
    linies: row.linies.map((l) => ({
      id: l.id,
      partidaCatalogId: l.partidaCatalogId,
      categoria: l.categoria,
      descripcio: l.descripcio,
      premissa: l.premissa,
      periodicitat: l.periodicitat as PeriodicitatTipusB,
      importUnitari: Number(l.importUnitari),
      mesos: normalitzaMesos(l.mesos),
      ordre: l.ordre,
    })),
  };
}

export async function mapEstatPressupostDeptAny(
  any: number,
  departamentIds: string[]
): Promise<Map<string, "ESBORRANY" | "CONFIRMAT">> {
  const m = new Map<string, "ESBORRANY" | "CONFIRMAT">();
  if (!departamentIds.length) return m;

  const rows = await db.pressupostDept.findMany({
    where: { any, departamentId: { in: departamentIds } },
    select: { departamentId: true, estat: true },
  });
  for (const r of rows) m.set(r.departamentId, r.estat);
  return m;
}

export async function listAnysPressupostDept(): Promise<number[]> {
  const rows = await db.pressupostDept.findMany({
    select: { any: true },
    distinct: ["any"],
    orderBy: { any: "desc" },
  });
  return rows.map((r) => r.any);
}

/** Regenera cel·les agregades categoria×mes des de les línies (costos en negatiu). */
export async function regenerarCelsDesDeLinies(pressupostId: string): Promise<void> {
  const linies = await db.pressupostLiniaDept.findMany({
    where: { pressupostId },
    select: { categoria: true, importUnitari: true, mesos: true },
  });

  const agg = new Map<string, number>();
  for (const l of linies) {
    const mesos = normalitzaMesos(l.mesos);
    const u = Math.round(Math.abs(Number(l.importUnitari)) * 100) / 100;
    for (const mes of mesos) {
      const k = `${l.categoria}:${mes}`;
      agg.set(k, (agg.get(k) ?? 0) + u);
    }
  }

  await db.$transaction(async (tx) => {
    await tx.pressupostCelDept.deleteMany({ where: { pressupostId } });
    for (const [key, positiu] of agg) {
      if (positiu < 0.005) continue;
      const [categoria, mesStr] = key.split(":");
      const mes = Number(mesStr);
      await tx.pressupostCelDept.create({
        data: {
          pressupostId,
          mes,
          partida: categoria,
          import_: -positiu,
        },
      });
    }
    await tx.pressupostDept.update({
      where: { id: pressupostId },
      data: { updatedAt: new Date() },
    });
  });
}

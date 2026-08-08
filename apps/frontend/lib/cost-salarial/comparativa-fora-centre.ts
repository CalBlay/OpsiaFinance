/**
 * Comparativa Fora centre (Excel cost salarial) vs import dels traspassos d'hores.
 * Objectiu: veure què hi ha a l'Excel i què el substituiria / ha substituït el traspass.
 *
 * Excel: valor original de CostSalarialRestaurant.foraCentre.
 *   Si el traspass ja està confirmat, el camp s'ha sobreescrit → es recupera via snapshot.abans.
 * Traspass: suma d'imports amb destí = restaurant (Sala/Cuina), de l'execució del període
 *   (esborrany o confirmat).
 */

import { getCentresRestaurants } from "@/lib/cost-salarial/consultes";
import { db } from "@/lib/db";
import { parseForaCentreSnapshot } from "@/lib/traspass-personal/fora-centre";
import type { DepartamentSalarial, EstatExecucioTraspassPersonal } from "@prisma/client";

export type FilComparativaForaCentre = {
  centreId: string;
  centreCodi: string;
  centreNom: string;
  departament: DepartamentSalarial;
  /** Valor Excel (original; snapshot si ja confirmat). */
  excel: number;
  /** Suma imports traspass amb destí = aquest restaurant × dept. */
  traspass: number;
  /** traspass − excel */
  delta: number;
  teExcel: boolean;
  teTraspass: boolean;
};

export type ComparativaForaCentreMes = {
  any: number;
  mes: number;
  periodNom: string;
  periodId: string;
  estatTraspass: EstatExecucioTraspassPersonal | null;
  files: FilComparativaForaCentre[];
  totals: {
    excel: number;
    traspass: number;
    delta: number;
  };
  resum: {
    filesAmbDiferencia: number;
    filesAmbExcel: number;
    filesAmbTraspass: number;
    centres: number;
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function key(centreId: string, dept: DepartamentSalarial): string {
  return `${centreId}|${dept}`;
}

function teDiferencia(delta: number): boolean {
  return Math.abs(delta) > 0.5;
}

export async function getComparativaForaCentreMes(
  any: number,
  mes: number
): Promise<ComparativaForaCentreMes | null> {
  const period = await db.period.findFirst({
    where: { any, mes },
    select: { id: true, nom: true, any: true, mes: true },
  });
  if (!period) return null;

  const restaurants = await getCentresRestaurants();
  const restaurantIds = new Set(restaurants.map((c) => c.id));
  const byId = new Map(restaurants.map((c) => [c.id, c]));

  const [rows, execucio] = await Promise.all([
    db.costSalarialRestaurant.findMany({
      where: { periodId: period.id, centreId: { in: [...restaurantIds] } },
      select: {
        centreId: true,
        departament: true,
        foraCentre: true,
      },
    }),
    db.execucioTraspassPersonal.findUnique({
      where: { periodId: period.id },
      select: {
        estat: true,
        foraCentreSnapshotJson: true,
        moviments: {
          select: {
            centreDestiId: true,
            departament: true,
            import_: true,
          },
        },
      },
    }),
  ]);

  const excelByKey = new Map<string, number>();
  for (const r of rows) {
    excelByKey.set(key(r.centreId, r.departament), round2(Number(r.foraCentre)));
  }

  // Si confirmat, foraCentre ja és el traspass → recuperar Excel del snapshot.
  if (execucio?.estat === "CONFIRMAT") {
    const snap = parseForaCentreSnapshot(execucio.foraCentreSnapshotJson);
    if (snap?.canvis.length) {
      for (const c of snap.canvis) {
        excelByKey.set(key(c.centreId, c.departament), round2(c.abans));
      }
    }
  }

  const traspassByKey = new Map<string, number>();
  if (execucio?.moviments.length) {
    for (const m of execucio.moviments) {
      if (!restaurantIds.has(m.centreDestiId)) continue;
      const k = key(m.centreDestiId, m.departament);
      traspassByKey.set(k, round2((traspassByKey.get(k) ?? 0) + Number(m.import_)));
    }
  }

  const allKeys = new Set<string>([...excelByKey.keys(), ...traspassByKey.keys()]);
  const files: FilComparativaForaCentre[] = [];

  for (const k of allKeys) {
    const [centreId, deptRaw] = k.split("|");
    const departament = deptRaw as DepartamentSalarial;
    if (departament !== "SALA" && departament !== "CUINA") continue;
    const centre = byId.get(centreId);
    if (!centre) continue;

    const excel = excelByKey.get(k) ?? 0;
    const traspass = traspassByKey.get(k) ?? 0;
    if (!excelByKey.has(k) && !traspassByKey.has(k)) continue;

    files.push({
      centreId,
      centreCodi: centre.codi,
      centreNom: centre.nom,
      departament,
      excel: round2(excel),
      traspass: round2(traspass),
      delta: round2(traspass - excel),
      teExcel: excelByKey.has(k),
      teTraspass: traspassByKey.has(k),
    });
  }

  files.sort(
    (a, b) => a.centreCodi.localeCompare(b.centreCodi) || a.departament.localeCompare(b.departament)
  );

  const totals = files.reduce(
    (acc, f) => ({
      excel: round2(acc.excel + f.excel),
      traspass: round2(acc.traspass + f.traspass),
      delta: round2(acc.delta + f.delta),
    }),
    { excel: 0, traspass: 0, delta: 0 }
  );

  const centres = new Set(files.map((f) => f.centreId)).size;

  return {
    any: period.any,
    mes: period.mes,
    periodNom: period.nom,
    periodId: period.id,
    estatTraspass: execucio?.estat ?? null,
    files,
    totals,
    resum: {
      filesAmbDiferencia: files.filter((f) => teDiferencia(f.delta)).length,
      filesAmbExcel: files.filter((f) => Math.abs(f.excel) >= 0.005).length,
      filesAmbTraspass: files.filter((f) => Math.abs(f.traspass) >= 0.005).length,
      centres,
    },
  };
}

export async function getAnysAmbCostSalarialOTraspass(): Promise<number[]> {
  const [a, b] = await Promise.all([
    db.period.findMany({
      where: { costsSalarials: { some: {} } },
      select: { any: true },
      distinct: ["any"],
    }),
    db.period.findMany({
      where: { execucioTraspassPersonal: { isNot: null } },
      select: { any: true },
      distinct: ["any"],
    }),
  ]);
  const s = new Set([...a, ...b].map((p) => p.any));
  return [...s].sort((x, y) => y - x);
}

import { db } from "@/lib/db";
import type { DepartamentSalarial } from "@prisma/client";

export type ForaCentreLiniaDetall = {
  mes: number;
  any: number;
  periodNom: string;
  departament: DepartamentSalarial;
  origenCodi: string;
  origenNom: string;
  destiCodi: string;
  destiNom: string;
  minuts: number;
  hores: number;
  tarifaHora: number;
  import_: number;
  /** true = valor ve de traspass confirmat; false = Excel cost salarial. */
  font: "traspass" | "excel";
};

export type ForaCentreDetallResultat = {
  centreId: string;
  centreCodi: string;
  centreNom: string;
  any: number;
  mes: number | null;
  departament: DepartamentSalarial | null;
  /** Total mostrat a la casella (traspass si n'hi ha; si no, Excel). */
  total: number;
  totalSala: number;
  totalCuina: number;
  /** Hi ha algun mes amb traspass confirmat per aquest centre. */
  teTraspassConfirmat: boolean;
  linies: ForaCentreLiniaDetall[];
};

type TotalsDept = { SALA: number; CUINA: number };

/**
 * Per cada període del filtre: si hi ha traspass confirmat amb destinació = restaurant,
 * Fora centre = suma d'imports d'entrada (substitueix l'Excel). Si no, es manté l'Excel.
 */
export async function resoldreForaCentreRestaurant(
  centreId: string,
  any: number,
  mes: number | null
): Promise<{
  totals: TotalsDept;
  teTraspassConfirmat: boolean;
  liniesTraspass: ForaCentreLiniaDetall[];
}> {
  const periods = await db.period.findMany({
    where: mes != null ? { any, mes } : { any },
    select: { id: true, any: true, mes: true, nom: true },
  });
  if (!periods.length) {
    return { totals: { SALA: 0, CUINA: 0 }, teTraspassConfirmat: false, liniesTraspass: [] };
  }

  const periodIds = periods.map((p) => p.id);
  const periodById = new Map(periods.map((p) => [p.id, p]));

  const [excelRows, execucions] = await Promise.all([
    db.costSalarialRestaurant.findMany({
      where: { centreId, periodId: { in: periodIds } },
      select: { periodId: true, departament: true, foraCentre: true },
    }),
    db.execucioTraspassPersonal.findMany({
      where: { estat: "CONFIRMAT", periodId: { in: periodIds } },
      select: {
        periodId: true,
        moviments: {
          where: { centreDestiId: centreId },
          select: {
            departament: true,
            hores: true,
            tarifaHora: true,
            import_: true,
            centreOrigen: { select: { codi: true, nom: true } },
            centreDesti: { select: { codi: true, nom: true } },
          },
        },
      },
    }),
  ]);

  const excelByPeriodDept = new Map<string, number>();
  for (const r of excelRows) {
    excelByPeriodDept.set(`${r.periodId}|${r.departament}`, Number(r.foraCentre));
  }

  const traspassByPeriodDept = new Map<string, number>();
  const liniesTraspass: ForaCentreLiniaDetall[] = [];
  // Qualsevol mes amb execució confirmada: Fora centre = traspass (0 si no hi ha entrada).
  const periodsAmbTraspass = new Set(execucions.map((ex) => ex.periodId));

  for (const ex of execucions) {
    const period = periodById.get(ex.periodId);
    if (!period) continue;

    for (const m of ex.moviments) {
      const key = `${ex.periodId}|${m.departament}`;
      const add = Number(m.import_);
      traspassByPeriodDept.set(
        key,
        Math.round(((traspassByPeriodDept.get(key) ?? 0) + add) * 100) / 100
      );
      liniesTraspass.push({
        mes: period.mes,
        any: period.any,
        periodNom: period.nom,
        departament: m.departament,
        origenCodi: m.centreOrigen.codi,
        origenNom: m.centreOrigen.nom,
        destiCodi: m.centreDesti.codi,
        destiNom: m.centreDesti.nom,
        minuts: Math.round(Number(m.hores) * 60 * 100) / 100,
        hores: Number(m.hores),
        tarifaHora: Number(m.tarifaHora),
        import_: add,
        font: "traspass",
      });
    }
  }

  const totals: TotalsDept = { SALA: 0, CUINA: 0 };
  for (const p of periods) {
    for (const dept of ["SALA", "CUINA"] as const) {
      const key = `${p.id}|${dept}`;
      if (periodsAmbTraspass.has(p.id)) {
        totals[dept] += traspassByPeriodDept.get(key) ?? 0;
      } else {
        totals[dept] += excelByPeriodDept.get(key) ?? 0;
      }
    }
  }

  totals.SALA = Math.round(totals.SALA * 100) / 100;
  totals.CUINA = Math.round(totals.CUINA * 100) / 100;

  liniesTraspass.sort(
    (a, b) =>
      a.mes - b.mes ||
      a.departament.localeCompare(b.departament) ||
      a.origenNom.localeCompare(b.origenNom)
  );

  return {
    totals,
    teTraspassConfirmat: periodsAmbTraspass.size > 0,
    liniesTraspass,
  };
}

/** Detall per modal (casella Import / Sala / Cuina de Fora centre). */
export async function getForaCentreDetall(params: {
  centreId: string;
  any: number;
  mes: number | null;
  departament?: DepartamentSalarial | null;
}): Promise<ForaCentreDetallResultat | null> {
  const centre = await db.centre.findUnique({
    where: { id: params.centreId },
    select: { id: true, codi: true, nom: true },
  });
  if (!centre) return null;

  const resolved = await resoldreForaCentreRestaurant(params.centreId, params.any, params.mes);

  let linies = resolved.liniesTraspass;
  if (params.departament) {
    linies = linies.filter((l) => l.departament === params.departament);
  }

  // Si no hi ha traspass, mostra el valor Excel com a línia sintètica per transparència.
  if (!resolved.teTraspassConfirmat) {
    const periods = await db.period.findMany({
      where: params.mes != null ? { any: params.any, mes: params.mes } : { any: params.any },
      select: { id: true, any: true, mes: true, nom: true },
    });
    const rows = await db.costSalarialRestaurant.findMany({
      where: {
        centreId: params.centreId,
        periodId: { in: periods.map((p) => p.id) },
        ...(params.departament ? { departament: params.departament } : {}),
      },
      select: {
        departament: true,
        foraCentre: true,
        period: { select: { any: true, mes: true, nom: true } },
      },
    });
    linies = rows
      .filter((r) => Math.abs(Number(r.foraCentre)) >= 0.005)
      .map((r) => ({
        mes: r.period.mes,
        any: r.period.any,
        periodNom: r.period.nom,
        departament: r.departament,
        origenCodi: "—",
        origenNom: "Excel cost salarial",
        destiCodi: centre.codi,
        destiNom: centre.nom,
        minuts: 0,
        hores: 0,
        tarifaHora: 0,
        import_: Number(r.foraCentre),
        font: "excel" as const,
      }));
  }

  const totalSala = params.departament === "CUINA" ? 0 : resolved.totals.SALA;
  const totalCuina = params.departament === "SALA" ? 0 : resolved.totals.CUINA;
  const total =
    params.departament === "SALA"
      ? resolved.totals.SALA
      : params.departament === "CUINA"
        ? resolved.totals.CUINA
        : Math.round((resolved.totals.SALA + resolved.totals.CUINA) * 100) / 100;

  return {
    centreId: centre.id,
    centreCodi: centre.codi,
    centreNom: centre.nom,
    any: params.any,
    mes: params.mes,
    departament: params.departament ?? null,
    total,
    totalSala,
    totalCuina,
    teTraspassConfirmat: resolved.teTraspassConfirmat,
    linies,
  };
}

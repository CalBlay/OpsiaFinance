import { db } from "@/lib/db";
import { parseForaCentreSnapshot } from "@/lib/traspass-personal/fora-centre";
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
  /** excel = Fora centre; traspass = moviment confirmat (destí + / origen −). */
  font: "traspass" | "excel";
  /** Només traspass: rol del restaurant respecte al moviment. */
  rol?: "desti" | "origen";
};

export type ForaCentreDetallResultat = {
  centreId: string;
  centreCodi: string;
  centreNom: string;
  any: number;
  mes: number | null;
  departament: DepartamentSalarial | null;
  total: number;
  totalSala: number;
  totalCuina: number;
  teTraspassConfirmat: boolean;
  /** directe = Excel; gestio = net traspassos (+destí −origen). */
  compte: "directe" | "gestio";
  linies: ForaCentreLiniaDetall[];
};

type TotalsDept = { SALA: number; CUINA: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyTotals(): TotalsDept {
  return { SALA: 0, CUINA: 0 };
}

type MovSel = {
  departament: DepartamentSalarial;
  hores: unknown;
  tarifaHora: unknown;
  import_: unknown;
  centreOrigenId: string;
  centreDestiId: string;
  centreOrigen: { codi: string; nom: string };
  centreDesti: { codi: string; nom: string };
};

/**
 * Directe = valor Excel Fora centre.
 * Gestió = traspassos confirmats: +hores destí −hores origen (mateixa línia).
 */
export async function resoldreForaCentreRestaurant(
  centreId: string,
  any: number,
  mes: number | null
): Promise<{
  excel: TotalsDept;
  gestio: TotalsDept;
  teTraspassConfirmat: boolean;
  liniesExcel: ForaCentreLiniaDetall[];
  liniesTraspass: ForaCentreLiniaDetall[];
}> {
  const periods = await db.period.findMany({
    where: mes != null ? { any, mes } : { any },
    select: { id: true, any: true, mes: true, nom: true },
  });
  if (!periods.length) {
    return {
      excel: emptyTotals(),
      gestio: emptyTotals(),
      teTraspassConfirmat: false,
      liniesExcel: [],
      liniesTraspass: [],
    };
  }

  const periodIds = periods.map((p) => p.id);
  const periodById = new Map(periods.map((p) => [p.id, p]));

  const centre = await db.centre.findUnique({
    where: { id: centreId },
    select: { codi: true, nom: true },
  });

  const [excelRows, execucions] = await Promise.all([
    db.costSalarialRestaurant.findMany({
      where: { centreId, periodId: { in: periodIds } },
      select: { periodId: true, departament: true, foraCentre: true },
    }),
    db.execucioTraspassPersonal.findMany({
      where: { estat: "CONFIRMAT", periodId: { in: periodIds } },
      select: {
        periodId: true,
        foraCentreSnapshotJson: true,
        moviments: {
          where: {
            OR: [{ centreDestiId: centreId }, { centreOrigenId: centreId }],
          },
          select: {
            departament: true,
            hores: true,
            tarifaHora: true,
            import_: true,
            centreOrigenId: true,
            centreDestiId: true,
            centreOrigen: { select: { codi: true, nom: true } },
            centreDesti: { select: { codi: true, nom: true } },
          },
        },
      },
    }),
  ]);

  const bdByPeriodDept = new Map<string, number>();
  for (const r of excelRows) {
    bdByPeriodDept.set(`${r.periodId}|${r.departament}`, Number(r.foraCentre));
  }

  const excelDesDeSnapshot = new Map<string, number>();
  const periodsLegacyOverwrite = new Set<string>();
  const periodsAmbTraspass = new Set<string>();
  const gestio = emptyTotals();
  const liniesTraspass: ForaCentreLiniaDetall[] = [];

  for (const ex of execucions) {
    periodsAmbTraspass.add(ex.periodId);
    const period = periodById.get(ex.periodId);
    if (!period) continue;

    const snap = parseForaCentreSnapshot(ex.foraCentreSnapshotJson);
    if (snap?.canvis.length) {
      periodsLegacyOverwrite.add(ex.periodId);
      for (const c of snap.canvis) {
        if (c.centreId !== centreId) continue;
        excelDesDeSnapshot.set(`${ex.periodId}|${c.departament}`, round2(c.abans));
      }
    }

    for (const m of ex.moviments as MovSel[]) {
      const importAbs = Number(m.import_);
      const liniaBase = {
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
        font: "traspass" as const,
      };

      if (m.centreDestiId === centreId) {
        gestio[m.departament] = round2(gestio[m.departament] + importAbs);
        liniesTraspass.push({ ...liniaBase, import_: importAbs, rol: "desti" });
      }
      if (m.centreOrigenId === centreId) {
        const neg = -importAbs;
        gestio[m.departament] = round2(gestio[m.departament] + neg);
        liniesTraspass.push({ ...liniaBase, import_: neg, rol: "origen" });
      }
    }
  }

  const excel = emptyTotals();
  const liniesExcel: ForaCentreLiniaDetall[] = [];

  for (const p of periods) {
    for (const dept of ["SALA", "CUINA"] as const) {
      const key = `${p.id}|${dept}`;
      const excelRaw = periodsLegacyOverwrite.has(p.id)
        ? (excelDesDeSnapshot.get(key) ?? 0)
        : (bdByPeriodDept.get(key) ?? 0);

      excel[dept] += excelRaw;
      if (Math.abs(excelRaw) >= 0.005) {
        liniesExcel.push({
          mes: p.mes,
          any: p.any,
          periodNom: p.nom,
          departament: dept,
          origenCodi: "—",
          origenNom: "Excel cost salarial",
          destiCodi: centre?.codi ?? "—",
          destiNom: centre?.nom ?? "—",
          minuts: 0,
          hores: 0,
          tarifaHora: 0,
          import_: round2(excelRaw),
          font: "excel",
        });
      }
    }
  }

  excel.SALA = round2(excel.SALA);
  excel.CUINA = round2(excel.CUINA);
  gestio.SALA = round2(gestio.SALA);
  gestio.CUINA = round2(gestio.CUINA);

  const byLinia = (a: ForaCentreLiniaDetall, b: ForaCentreLiniaDetall) =>
    a.mes - b.mes ||
    a.departament.localeCompare(b.departament) ||
    (a.rol ?? "").localeCompare(b.rol ?? "") ||
    a.origenNom.localeCompare(b.origenNom);

  liniesTraspass.sort(byLinia);
  liniesExcel.sort((a, b) => a.mes - b.mes || a.departament.localeCompare(b.departament));

  return {
    excel,
    gestio,
    teTraspassConfirmat: periodsAmbTraspass.size > 0,
    liniesExcel,
    liniesTraspass,
  };
}

/** Detall modal: Excel (directe) o moviments destí/origen (gestió). */
export async function getForaCentreDetall(params: {
  centreId: string;
  any: number;
  mes: number | null;
  departament?: DepartamentSalarial | null;
  compte?: "directe" | "gestio";
}): Promise<ForaCentreDetallResultat | null> {
  const compte = params.compte ?? "directe";
  const centre = await db.centre.findUnique({
    where: { id: params.centreId },
    select: { id: true, codi: true, nom: true },
  });
  if (!centre) return null;

  const resolved = await resoldreForaCentreRestaurant(params.centreId, params.any, params.mes);
  const totals = compte === "gestio" ? resolved.gestio : resolved.excel;
  let linies = compte === "gestio" ? resolved.liniesTraspass : resolved.liniesExcel;

  if (params.departament) {
    linies = linies.filter((l) => l.departament === params.departament);
  }

  const totalSala = params.departament === "CUINA" ? 0 : totals.SALA;
  const totalCuina = params.departament === "SALA" ? 0 : totals.CUINA;
  const total =
    params.departament === "SALA"
      ? totals.SALA
      : params.departament === "CUINA"
        ? totals.CUINA
        : round2(totals.SALA + totals.CUINA);

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
    compte,
    linies,
  };
}

import { crearCarregaFitxer } from "@/lib/carrega-fitxer";
import {
  type FilaCostPersonalExcel,
  extreureCodiPayroll,
  inferDeptSalarialDesDeText,
  parseExcelCostPersonalCentre,
} from "@/lib/cost-personal-centre/parser";
import { db } from "@/lib/db";
import { MESOS_LLARGS } from "@/lib/periodes";
import type { DepartamentSalarial } from "@prisma/client";

export type MapeigCostPersonalDTO = {
  id: string;
  codi: string;
  text: string | null;
  departamentSalarial: DepartamentSalarial | null;
  centre: { id: string; codi: string; nom: string };
};

export type ImportCostPersonalResult = {
  ok: boolean;
  missatge: string;
  filesImportades: number;
  centres: number;
  senseMapeig: number;
  errors: string[];
  carregaId?: string;
};

type MapeigRow = {
  id: string;
  codi: string;
  text: string | null;
  centreId: string;
  departamentSalarial: DepartamentSalarial | null;
  isActive: boolean;
};

/** Resol el mapeig més específic (codi exacte o prefix més llarg). */
export function resolMapeigCodi(codi: string, byCodi: Map<string, MapeigRow>): MapeigRow | null {
  const c = codi.trim();
  if (!c) return null;
  const exacte = byCodi.get(c);
  if (exacte) return exacte;
  // Prova prefixes progressivament més curts (02001001 → 0200100 → … → 02)
  for (let len = c.length - 1; len >= 2; len--) {
    const pref = c.slice(0, len);
    const m = byCodi.get(pref);
    if (m) return m;
  }
  return null;
}

/**
 * Evita doble comptatge jeràrquic: si hi ha un fill mapejat al fitxer,
 * s'ignora el pare (codi prefix del fill).
 */
export function filtrarFullesMapejades<T extends { codi: string }>(files: T[]): T[] {
  const codis = files.map((f) => f.codi);
  return files.filter((f) => {
    const esPare = codis.some(
      (altre) => altre !== f.codi && altre.startsWith(f.codi) && altre.length > f.codi.length
    );
    return !esPare;
  });
}

async function resolPeriodId(any: number, mes: number): Promise<string> {
  const period = await db.period.upsert({
    where: { any_mes: { any, mes } },
    update: {},
    create: { any, mes, nom: `${MESOS_LLARGS[mes - 1]} ${any}` },
  });
  return period.id;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Agregat = {
  centreId: string;
  departamentSalarial: DepartamentSalarial | null;
  importBrut: number;
  segSocialEmpresa: number;
  totalSegSocial: number;
  costPersonal: number;
  codiOrigen: string | null;
  textOrigen: string | null;
};

function clauAgregat(centreId: string, dept: DepartamentSalarial | null): string {
  return `${centreId}::${dept ?? "_"}`;
}

/** Importa el llistat payroll i substitueix les dades del període. */
export async function importarCostPersonalCentreDesDeBuffer(
  buffer: Buffer,
  opts: {
    any: number;
    mes: number;
    nomFitxer: string;
    mida?: number;
    creatPer: string;
    syncRestaurants?: boolean;
  }
): Promise<ImportCostPersonalResult> {
  const errors: string[] = [];
  let parsed: { files: FilaCostPersonalExcel[]; diagnostica?: string };
  try {
    parsed = parseExcelCostPersonalCentre(buffer);
  } catch (e) {
    return {
      ok: false,
      missatge: e instanceof Error ? e.message : "Error en llegir l'Excel.",
      filesImportades: 0,
      centres: 0,
      senseMapeig: 0,
      errors,
    };
  }

  if (!parsed.files.length) {
    return {
      ok: false,
      missatge: parsed.diagnostica
        ? `El fitxer no conté files amb imports. (${parsed.diagnostica})`
        : "El fitxer no conté files amb imports.",
      filesImportades: 0,
      centres: 0,
      senseMapeig: 0,
      errors,
    };
  }

  const mapeigs = await db.mapeigCodiCostPersonal.findMany({
    where: { isActive: true },
  });
  if (!mapeigs.length) {
    return {
      ok: false,
      missatge:
        "No hi ha mapeigs de codi → centre. Configura'ls a Configuració → Cost personal centre.",
      filesImportades: 0,
      centres: 0,
      senseMapeig: parsed.files.length,
      errors,
    };
  }

  const byCodi = new Map(mapeigs.map((m) => [m.codi.trim(), m]));

  type Matched = FilaCostPersonalExcel & {
    centreId: string;
    departamentSalarial: DepartamentSalarial | null;
  };
  const matched: Matched[] = [];
  let senseMapeig = 0;
  const avisSense = new Set<string>();

  for (const f of parsed.files) {
    const codi = extreureCodiPayroll(f.text) ?? f.codi;
    const mapeig = resolMapeigCodi(codi, byCodi);
    if (!mapeig) {
      senseMapeig++;
      if (avisSense.size < 15) avisSense.add(codi);
      continue;
    }
    const dept =
      mapeig.departamentSalarial ??
      inferDeptSalarialDesDeText(f.text) ??
      inferDeptSalarialDesDeText(mapeig.text ?? "");
    matched.push({
      ...f,
      codi,
      centreId: mapeig.centreId,
      departamentSalarial: dept,
    });
  }

  if (avisSense.size) {
    errors.push(`Sense mapeig (exemples): ${[...avisSense].join(", ")}.`);
  }

  const fulles = filtrarFullesMapejades(matched);
  if (!fulles.length) {
    return {
      ok: false,
      missatge: "Cap fila mapejada. Revisa el mapeig de codis.",
      filesImportades: 0,
      centres: 0,
      senseMapeig,
      errors,
    };
  }

  const agregats = new Map<string, Agregat>();
  for (const f of fulles) {
    const k = clauAgregat(f.centreId, f.departamentSalarial);
    const prev = agregats.get(k);
    if (prev) {
      prev.importBrut = round2(prev.importBrut + f.importBrut);
      prev.segSocialEmpresa = round2(prev.segSocialEmpresa + f.segSocialEmpresa);
      prev.totalSegSocial = round2(prev.totalSegSocial + f.totalSegSocial);
      prev.costPersonal = round2(prev.costPersonal + f.costPersonal);
      prev.codiOrigen = null;
      prev.textOrigen = "Diverses línies";
    } else {
      agregats.set(k, {
        centreId: f.centreId,
        departamentSalarial: f.departamentSalarial,
        importBrut: f.importBrut,
        segSocialEmpresa: f.segSocialEmpresa,
        totalSegSocial: f.totalSegSocial,
        costPersonal: f.costPersonal,
        codiOrigen: f.codi,
        textOrigen: f.text,
      });
    }
  }

  const periodId = await resolPeriodId(opts.any, opts.mes);
  const carregaId = await crearCarregaFitxer({
    tipus: "COST_PERSONAL_CENTRE",
    nomFitxer: opts.nomFitxer,
    mida: opts.mida ?? buffer.length,
    periodId,
    resum: `${agregats.size} centres/dept · ${MESOS_LLARGS[opts.mes - 1]} ${opts.any}`,
    creatPer: opts.creatPer,
  });

  // Substitueix el període sencer (una sola font activa per mes).
  await db.costPersonalCentre.deleteMany({ where: { periodId } });

  const rows = [...agregats.values()].map((a) => ({
    periodId,
    centreId: a.centreId,
    departamentSalarial: a.departamentSalarial,
    carregaId,
    codiOrigen: a.codiOrigen,
    textOrigen: a.textOrigen,
    importBrut: a.importBrut,
    segSocialEmpresa: a.segSocialEmpresa,
    totalSegSocial: a.totalSegSocial,
    costPersonal: a.costPersonal,
  }));

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.costPersonalCentre.createMany({ data: rows.slice(i, i + BATCH) });
  }

  if (opts.syncRestaurants !== false) {
    await syncCostSalarialRestaurantsDesDePayroll(periodId, [...agregats.values()]);
  }

  const nCentres = new Set([...agregats.values()].map((a) => a.centreId)).size;
  return {
    ok: true,
    missatge: `Importat: ${rows.length} registres · ${nCentres} centres · ${MESOS_LLARGS[opts.mes - 1]} ${opts.any}.${
      senseMapeig ? ` ${senseMapeig} files sense mapeig.` : ""
    }`,
    filesImportades: rows.length,
    centres: nCentres,
    senseMapeig,
    errors,
    carregaId,
  };
}

/** Actualitza CostSalarialRestaurant (LN00001) amb brut del payroll; conserva foraCentre. */
async function syncCostSalarialRestaurantsDesDePayroll(
  periodId: string,
  agregats: Agregat[]
): Promise<void> {
  const ln = await db.liniaNegoci.findUnique({
    where: { codi: "LN00001" },
    select: { id: true },
  });
  if (!ln) return;

  const restaurantIds = new Set(
    (
      await db.centre.findMany({
        where: { liniaNegociId: ln.id, isActive: true },
        select: { id: true },
      })
    ).map((c) => c.id)
  );

  for (const a of agregats) {
    if (!restaurantIds.has(a.centreId)) continue;
    if (a.departamentSalarial !== "SALA" && a.departamentSalarial !== "CUINA") continue;

    const existent = await db.costSalarialRestaurant.findUnique({
      where: {
        periodId_centreId_departament: {
          periodId,
          centreId: a.centreId,
          departament: a.departamentSalarial,
        },
      },
      select: { id: true, foraCentre: true },
    });

    const data = {
      totalSalari: a.importBrut,
      incentiusMensual: 0,
      incentiuTrimestral: 0,
      horesExtres: 0,
      altres: 0,
      baixes: 0,
      indemnitzacions: 0,
      // foraCentre el mantenen els traspassos
    };

    if (existent) {
      await db.costSalarialRestaurant.update({
        where: { id: existent.id },
        data,
      });
    } else {
      await db.costSalarialRestaurant.create({
        data: {
          periodId,
          centreId: a.centreId,
          departament: a.departamentSalarial,
          foraCentre: 0,
          ...data,
        },
      });
    }
  }
}

export async function llistaMapeigsCostPersonal(): Promise<MapeigCostPersonalDTO[]> {
  const rows = await db.mapeigCodiCostPersonal.findMany({
    orderBy: { codi: "asc" },
    include: { centre: { select: { id: true, codi: true, nom: true } } },
  });
  return rows
    .map((m) => ({
      id: m.id,
      codi: m.codi,
      text: m.text,
      departamentSalarial: m.departamentSalarial,
      centre: m.centre,
    }))
    .sort((a, b) => a.codi.localeCompare(b.codi, "ca", { numeric: true }));
}

export async function upsertMapeigCostPersonal(input: {
  id?: string;
  codi: string;
  text?: string | null;
  centreId: string;
  departamentSalarial?: DepartamentSalarial | null;
}): Promise<{ ok: boolean; missatge: string }> {
  const codi = input.codi.trim();
  if (!codi) return { ok: false, missatge: "El codi és obligatori." };
  if (!input.centreId) return { ok: false, missatge: "Selecciona un centre." };

  const data = {
    codi,
    text: input.text?.trim() || null,
    centreId: input.centreId,
    departamentSalarial: input.departamentSalarial ?? null,
  };

  try {
    if (input.id) {
      await db.mapeigCodiCostPersonal.update({ where: { id: input.id }, data });
      return { ok: true, missatge: "Mapeig actualitzat." };
    }
    await db.mapeigCodiCostPersonal.create({ data });
    return { ok: true, missatge: "Mapeig afegit." };
  } catch {
    return { ok: false, missatge: "No s'ha pogut desar (codi duplicat?)." };
  }
}

export async function deleteMapeigCostPersonal(
  id: string
): Promise<{ ok: boolean; missatge: string }> {
  await db.mapeigCodiCostPersonal.delete({ where: { id } });
  return { ok: true, missatge: "Mapeig eliminat." };
}

/** Importa mapeig des d'Excel: A=codi, B=codi centre Opsia, C=text opcional, D=SALA|CUINA opcional. */
export async function importarMapeigCostPersonalDesDeBuffer(
  buffer: Buffer,
  substituirTot: boolean
): Promise<{ importats: number; errors: string[] }> {
  const { read, utils } = await import("xlsx");
  const wb = read(buffer);
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return { importats: 0, errors: ["Full buit."] };

  const matrix = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
  const centres = await db.centre.findMany({
    where: { isActive: true },
    select: { id: true, codi: true },
  });
  const centreByCodi = new Map(centres.map((c) => [c.codi.trim().toUpperCase(), c.id]));

  if (substituirTot) {
    await db.mapeigCodiCostPersonal.deleteMany({});
  }

  const errors: string[] = [];
  let importats = 0;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const codi = String(row[0] ?? "").trim();
    const centreCodi = String(row[1] ?? "")
      .trim()
      .toUpperCase();
    if (!codi || !centreCodi) continue;
    if (/^codi$/i.test(codi) || /centre/i.test(centreCodi)) continue;

    const centreId = centreByCodi.get(centreCodi);
    if (!centreId) {
      errors.push(`Fila ${i + 1}: centre «${centreCodi}» no trobat.`);
      continue;
    }
    const text = String(row[2] ?? "").trim() || null;
    const deptRaw = String(row[3] ?? "")
      .trim()
      .toUpperCase();
    let departamentSalarial: DepartamentSalarial | null =
      deptRaw === "SALA" || deptRaw === "CUINA" ? deptRaw : null;
    if (!departamentSalarial && text) {
      departamentSalarial = inferDeptSalarialDesDeText(text);
    }

    await db.mapeigCodiCostPersonal.upsert({
      where: { codi },
      create: { codi, text, centreId, departamentSalarial },
      update: { text, centreId, departamentSalarial, isActive: true },
    });
    importats++;
  }

  return { importats, errors };
}

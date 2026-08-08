import { crearCarregaFitxer } from "@/lib/carrega-fitxer";
import {
  type FilaCostPersonalExcel,
  esFilaResumOTotal,
  extreureCodiPayroll,
  inferDeptSalarialDesDeText,
  parseExcelCostPersonalCentre,
} from "@/lib/cost-personal-centre/parser";
import { db } from "@/lib/db";
import { MESOS_LLARGS } from "@/lib/periodes";
import type { DepartamentSalarial, OrigenCostPersonalCentre } from "@prisma/client";

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
  origen?: OrigenCostPersonalCentre;
};

type MapeigRow = {
  id: string;
  codi: string;
  text: string | null;
  centreId: string;
  departamentSalarial: DepartamentSalarial | null;
  isActive: boolean;
};

/** Resol el mapeig més específic (codi exacte o prefix de nivell centre). */
export function resolMapeigCodi(codi: string, byCodi: Map<string, MapeigRow>): MapeigRow | null {
  const c = codi.trim();
  if (!c) return null;
  const exacte = byCodi.get(c);
  if (exacte) return exacte;
  // Prefixos només a partir de longitud de centre (5).
  // Evita encaixar LN curts (01, 00…) i barrejar restaurants amb Serveis Externs.
  const minPrefix = 5;
  for (let len = c.length - 1; len >= minPrefix; len--) {
    const pref = c.slice(0, len);
    const m = byCodi.get(pref);
    if (m) return m;
  }
  return null;
}

/**
 * Candidats de codi per al mapeig (centres = 5 dígits).
 * Prova primer el centre 5 dígits (com al mapeig manual), després fulles.
 */
export function candidatsCodiPayroll(codiFila: string, text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (c: string | null | undefined) => {
    const v = (c ?? "").trim();
    if (!/^\d{4,8}$/.test(v) || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };

  // 1) Centre 5 dígits (el que tens al mapeig: 03001, 00105…)
  for (const m of text.match(/\b(\d{5})\b/g) ?? []) add(m);
  if (/^\d{5}$/.test(codiFila.trim())) add(codiFila);
  if (/^\d{6,8}$/.test(codiFila.trim())) add(codiFila.trim().slice(0, 5));

  // 2) Fulles / altres
  for (const m of text.match(/\b(\d{6,8})\b/g) ?? []) add(m);
  add(codiFila);

  return out;
}

const TOKENS_GENERICS_MAPEIG = new Set([
  "restaurants",
  "restaurant",
  "empresa",
  "serveis",
  "servei",
  "centrals",
  "central",
  "sala",
  "cuina",
  "cocina",
  "personal",
  "administracio",
  "administracion",
]);

/** Fallback: encaixa per nom de centre al text (DECORACIÓ ↔ mapeig «…DECORAC…»). */
function _resolMapeigPerText(text: string, mapeigs: MapeigRow[]): MapeigRow | null {
  if (esFilaResumOTotal(text)) return null;
  const clau = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (clau.length < 4) return null;

  let millor: { m: MapeigRow; score: number } | null = null;
  for (const m of mapeigs) {
    const ref = (m.text ?? "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (ref.length < 4) continue;
    // Només tokens distintius (evita «restaurants» / «serveis» → centre erroni)
    const tokens = ref.split(" ").filter((t) => t.length >= 4 && !TOKENS_GENERICS_MAPEIG.has(t));
    if (!tokens.length) continue;
    let hits = 0;
    for (const t of tokens) {
      if (clau.includes(t)) hits++;
    }
    if (!hits) continue;
    const score = hits / Math.max(tokens.length, 1);
    if (score >= 0.5 && (!millor || score > millor.score)) {
      millor = { m, score };
    }
  }
  return millor && millor.score >= 0.5 ? millor.m : null;
}

/**
 * El mapeig és a nivell centre (5 dígits: 03001, 00105…).
 * Si hi ha fila del centre I fills de departament (03001001…),
 * ens quedem amb el centre (total correcte) i ignorem els fills.
 * Si només hi ha fills, els mantenim (es mapegen per prefix).
 */
export function filtrarFullesMapejades<T extends { codi: string }>(files: T[]): T[] {
  const centres5 = new Set(files.map((f) => f.codi.trim()).filter((c) => /^\d{5}$/.test(c)));
  return files.filter((f) => {
    const c = f.codi.trim();
    if (/^\d{5}$/.test(c)) return true;
    if (c.length >= 6 && /^\d+$/.test(c)) {
      const pare = c.slice(0, 5);
      // Hi ha total del centre → no sumar també el departament
      if (centres5.has(pare)) return false;
      return true;
    }
    return true;
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

/** Importa el llistat payroll (nòmina o millores) i substitueix només aquest origen del període. */
export async function importarCostPersonalCentreDesDeBuffer(
  buffer: Buffer,
  opts: {
    any: number;
    mes: number;
    nomFitxer: string;
    mida?: number;
    creatPer: string;
    /** NOMINA (defecte) o MILLORES — detectat pel nom del fitxer. */
    origen?: OrigenCostPersonalCentre;
  }
): Promise<ImportCostPersonalResult> {
  const origen: OrigenCostPersonalCentre = opts.origen ?? "NOMINA";
  const errors: string[] = [];
  let parsed: { files: FilaCostPersonalExcel[]; diagnostica?: string };
  try {
    parsed = parseExcelCostPersonalCentre(buffer, origen === "MILLORES" ? "MILLORES" : "NOMINA");
  } catch (e) {
    return {
      ok: false,
      missatge: e instanceof Error ? e.message : "Error en llegir l'Excel.",
      filesImportades: 0,
      centres: 0,
      senseMapeig: 0,
      errors,
      origen,
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
      origen,
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
      origen,
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
    if (esFilaResumOTotal(f.text)) continue;
    // Mapeig només centres: ignora qualsevol fila amb codi de departament (6–8 dígits).
    if (/\b\d{6,8}\b/.test(f.text)) continue;
    const codiBase = /^\d{5}$/.test(f.codi.trim())
      ? f.codi.trim()
      : (extreureCodiPayroll(f.text) ?? f.codi.trim());
    if (!/^\d{5}$/.test(codiBase)) continue;
    // Només mapeig exacte del centre (sense prefixos de fulles).
    const mapeig = byCodi.get(codiBase) ?? resolMapeigCodi(codiBase, byCodi);
    if (!mapeig) {
      senseMapeig++;
      if (avisSense.size < 15) avisSense.add(codiBase);
      continue;
    }
    // Sense inferir Sala/Cuina al text: amb mapeig de centres, un sol cub per centre.
    const dept = mapeig.departamentSalarial;
    matched.push({
      ...f,
      codi: codiBase,
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
      origen,
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
  const etiquetaOrigen = origen === "MILLORES" ? "Millores" : "Nòmina";
  const tipusCarrega = origen === "MILLORES" ? "COST_PERSONAL_MILLORES" : "COST_PERSONAL_CENTRE";
  const carregaId = await crearCarregaFitxer({
    tipus: tipusCarrega,
    nomFitxer: opts.nomFitxer,
    mida: opts.mida ?? buffer.length,
    periodId,
    resum: `${etiquetaOrigen} · ${agregats.size} centres/dept · ${MESOS_LLARGS[opts.mes - 1]} ${opts.any}`,
    creatPer: opts.creatPer,
  });

  // Substitueix només aquest origen del període (nòmina i millores coexisteixen).
  await db.costPersonalCentre.deleteMany({ where: { periodId, origen } });

  const rows = [...agregats.values()].map((a) => ({
    periodId,
    centreId: a.centreId,
    origen,
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

  // Cost salarial restaurants és font pròpia (Excel Sala/Cuina + partides).
  // No el sobreescrivim des de la nòmina: esborrava incentius/hores/baixes/etc.

  const nCentres = new Set([...agregats.values()].map((a) => a.centreId)).size;
  return {
    ok: true,
    missatge: `Importat (${etiquetaOrigen}): ${rows.length} registres · ${nCentres} centres · ${MESOS_LLARGS[opts.mes - 1]} ${opts.any}.${
      senseMapeig ? ` ${senseMapeig} files sense mapeig.` : ""
    }`,
    filesImportades: rows.length,
    centres: nCentres,
    senseMapeig,
    errors,
    carregaId,
    origen,
  };
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
  /** Esborra tots els mapeigs codi payroll → centre. */
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

/** Esborra tots els mapeigs codi payroll → centre. */
export async function esborrarTotMapeigCostPersonal(): Promise<{
  ok: boolean;
  missatge: string;
  esborrats: number;
}> {
  const r = await db.mapeigCodiCostPersonal.deleteMany({});
  return {
    ok: true,
    esborrats: r.count,
    missatge: r.count
      ? `S'han esborrat ${r.count} mapeigs. Pots crear-los manualment.`
      : "No hi havia mapeigs.",
  };
}

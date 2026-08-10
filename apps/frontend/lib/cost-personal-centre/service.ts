import { crearCarregaFitxer } from "@/lib/carrega-fitxer";
import {
  type FilaCostPersonalExcel,
  esFilaResumOTotal,
  extreureCodiMesEspecific,
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
  centre: {
    id: string;
    codi: string;
    nom: string;
    liniaNegociId: string;
    liniaNegoci: { id: string; codi: string; nom: string };
  };
  departament: { id: string; codi: string; nom: string } | null;
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
  departamentId: string | null;
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
 * Candidats de codi per al mapeig, del més específic al més genèric.
 * Prioritza fulles 6–8 dígits (ex. 04043005) i després el centre 5 dígits.
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

  const especific = extreureCodiMesEspecific(text);
  add(especific);
  add(codiFila);
  for (const m of text.match(/\b(\d{6,8})\b/g) ?? []) add(m);
  for (const m of text.match(/\b(\d{5})\b/g) ?? []) add(m);
  if (/^\d{6,8}$/.test(codiFila.trim())) add(codiFila.trim().slice(0, 5));

  return out.sort((a, b) => b.length - a.length || a.localeCompare(b, "ca", { numeric: true }));
}

/** Resol el mapeig més específic disponible per a una fila payroll. */
export function resolMapeigPerFila(
  codiFila: string,
  text: string,
  byCodi: Map<string, MapeigRow>
): { mapeig: MapeigRow; codiUsat: string } | null {
  for (const cand of candidatsCodiPayroll(codiFila, text)) {
    const exacte = byCodi.get(cand);
    if (exacte) return { mapeig: exacte, codiUsat: cand };
  }
  const especific = extreureCodiMesEspecific(text) ?? codiFila.trim();
  const viaPrefix = resolMapeigCodi(especific, byCodi);
  if (viaPrefix) return { mapeig: viaPrefix, codiUsat: especific };
  return null;
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
 * Evita doble comptatge centre vs fills.
 * Si hi ha fulles mapeades (6–8 dígits o amb departamentId) d’un centre,
 * ens quedem només amb les fulles. Si no, el total del centre (5 dígits).
 */
export function filtrarFullesMapejades<
  T extends { codi: string; centreId: string; departamentId?: string | null },
>(files: T[]): T[] {
  const centresAmbFulles = new Set(
    files
      .filter((f) => {
        const c = f.codi.trim();
        return f.departamentId || (c.length >= 6 && /^\d+$/.test(c));
      })
      .map((f) => f.centreId)
  );
  if (!centresAmbFulles.size) return files;
  return files.filter((f) => {
    if (!centresAmbFulles.has(f.centreId)) return true;
    const c = f.codi.trim();
    return Boolean(f.departamentId) || (c.length >= 6 && /^\d+$/.test(c));
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
  departamentId: string | null;
  departamentSalarial: DepartamentSalarial | null;
  importBrut: number;
  segSocialEmpresa: number;
  totalSegSocial: number;
  costPersonal: number;
  codiOrigen: string | null;
  textOrigen: string | null;
};

function clauAgregat(
  centreId: string,
  departamentId: string | null,
  deptSalarial: DepartamentSalarial | null
): string {
  return `${centreId}::${departamentId ?? "_"}::${deptSalarial ?? "_"}`;
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
    departamentId: string | null;
    departamentSalarial: DepartamentSalarial | null;
  };
  const matched: Matched[] = [];
  let senseMapeig = 0;
  const avisSense = new Set<string>();

  for (const f of parsed.files) {
    if (esFilaResumOTotal(f.text)) continue;
    const hit = resolMapeigPerFila(f.codi, f.text, byCodi);
    if (!hit) {
      senseMapeig++;
      const codiAvis = extreureCodiMesEspecific(f.text) ?? f.codi.trim();
      if (codiAvis && avisSense.size < 15) avisSense.add(codiAvis);
      continue;
    }
    matched.push({
      ...f,
      codi: hit.codiUsat,
      centreId: hit.mapeig.centreId,
      departamentId: hit.mapeig.departamentId,
      departamentSalarial: hit.mapeig.departamentSalarial,
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
    const k = clauAgregat(f.centreId, f.departamentId, f.departamentSalarial);
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
        departamentId: f.departamentId,
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
    departamentId: a.departamentId,
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
  const nDepts = new Set([...agregats.values()].map((a) => a.departamentId).filter(Boolean)).size;
  return {
    ok: true,
    missatge: `Importat (${etiquetaOrigen}): ${rows.length} registres · ${nCentres} centres${
      nDepts ? ` · ${nDepts} departaments` : ""
    } · ${MESOS_LLARGS[opts.mes - 1]} ${opts.any}.${
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
    include: {
      centre: {
        select: {
          id: true,
          codi: true,
          nom: true,
          liniaNegociId: true,
          liniaNegoci: { select: { id: true, codi: true, nom: true } },
        },
      },
      departament: { select: { id: true, codi: true, nom: true } },
    },
  });
  return rows
    .map((m) => ({
      id: m.id,
      codi: m.codi,
      text: m.text,
      departamentSalarial: m.departamentSalarial,
      centre: m.centre,
      departament: m.departament,
    }))
    .sort((a, b) => a.codi.localeCompare(b.codi, "ca", { numeric: true }));
}

export async function upsertMapeigCostPersonal(input: {
  id?: string;
  codi: string;
  text?: string | null;
  centreId: string;
  departamentId?: string | null;
  departamentSalarial?: DepartamentSalarial | null;
}): Promise<{ ok: boolean; missatge: string }> {
  const codi = input.codi.trim();
  if (!codi) return { ok: false, missatge: "El codi és obligatori." };
  if (!input.centreId) return { ok: false, missatge: "Selecciona un centre o departament." };

  let centreId = input.centreId;
  const departamentId = input.departamentId ?? null;
  let departamentSalarial = input.departamentSalarial ?? null;

  if (departamentId) {
    const dept = await db.departament.findUnique({
      where: { id: departamentId },
      select: { id: true, centreId: true, nom: true, isActive: true },
    });
    if (!dept || !dept.isActive) {
      return { ok: false, missatge: "Departament no trobat a l'arbre de dimensions." };
    }
    centreId = dept.centreId;
    if (!departamentSalarial) {
      departamentSalarial = inferDeptSalarialDesDeText(dept.nom);
    }
  }

  const data = {
    codi,
    text: input.text?.trim() || null,
    centreId,
    departamentId,
    departamentSalarial,
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

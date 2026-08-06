import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  inferDeptSalarialDesDeText,
  parseEtiquetesPayrollPerMapeig,
} from "@/lib/cost-personal-centre/parser";
import { indexaCentrePerNom, normalitzaNomRestaurant } from "@/lib/cost-salarial/restaurant-noms";
import { db } from "@/lib/db";
import type { DepartamentSalarial } from "@prisma/client";

export type PropostaMapeig = {
  codi: string;
  text: string;
  centreId: string;
  centreCodi: string;
  centreNom: string;
  departamentSalarial: DepartamentSalarial | null;
  puntuacio: number;
  motiu: string;
};

function normalitzaClau(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^restaurant\s+/i, "")
    .replace(/\b(d|de|del|dels|la|l|el|els|les|i|y)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Treu el codi numèric inicial i separadors. */
export function etiquetaSenseCodi(text: string): string {
  return text
    .replace(/^\s*\d{2,8}\s*[-–.:)]?\s*/u, "")
    .replace(/^\s*[-–.]\s*/, "")
    .trim();
}

/** Treu cues Sala/Cuina/Neteja per encaixar el nom del centre. */
function etiquetaSenseDept(text: string): string {
  return text
    .replace(/\b(sala|cuina|cocina|netej[ae]|limpieza|cambrer\w*|cuiner\w*|serveis?)\b.*$/iu, "")
    .replace(/\s*[-–/|]\s*$/u, "")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(
    normalitzaClau(s)
      .split(" ")
      .filter((t) => t.length > 1)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

type CentreOpt = { id: string; codi: string; nom: string; lnCodi: string };

/**
 * Troba el centre Opsia que millor encaixa amb una etiqueta del payroll.
 */
export function trobarCentrePerEtiqueta(
  etiquetaRaw: string,
  centres: CentreOpt[],
  byRestaurant: Map<string, CentreOpt>
): { centre: CentreOpt; puntuacio: number; motiu: string } | null {
  const etiqueta = etiquetaSenseCodi(etiquetaRaw);
  if (!etiqueta || etiqueta.length < 3) return null;

  const senseDept = etiquetaSenseDept(etiqueta) || etiqueta;
  const clau = normalitzaClau(senseDept);
  const clauRest = normalitzaNomRestaurant(senseDept);
  const toks = tokens(senseDept);

  // 1) Alias / nom restaurant
  const rest = byRestaurant.get(clauRest) ?? byRestaurant.get(clau);
  if (rest) {
    return { centre: rest, puntuacio: 96, motiu: "nom restaurant" };
  }

  let millor: { centre: CentreOpt; puntuacio: number; motiu: string } | null = null;

  for (const c of centres) {
    const cn = normalitzaClau(c.nom);
    const cnRest = normalitzaNomRestaurant(c.nom);
    if (!cn) continue;

    let puntuacio = 0;
    let motiu = "";

    if (clau === cn || clau === cnRest || clauRest === cnRest) {
      puntuacio = 100;
      motiu = "coincidència exacta";
    } else if (clau.includes(cn) || cn.includes(clau)) {
      // Evita matches massa curts («cuina» dins de tot)
      const curt = Math.min(clau.length, cn.length);
      if (curt >= 8) {
        puntuacio = 88;
        motiu = "nom contingut";
      } else if (curt >= 5 && (clau.startsWith(cn) || cn.startsWith(clau))) {
        puntuacio = 82;
        motiu = "prefix del nom";
      }
    } else {
      const j = jaccard(toks, tokens(c.nom));
      if (j >= 0.75) {
        puntuacio = 78;
        motiu = `tokens ${(j * 100).toFixed(0)}%`;
      } else if (j >= 0.55 && toks.size >= 2) {
        puntuacio = 72;
        motiu = `tokens ${(j * 100).toFixed(0)}%`;
      }
    }

    // Preferència lleugera centres «administració» quan l'etiqueta ho diu
    if (puntuacio > 0 && /administr/.test(clau) && /administr/.test(cn)) {
      puntuacio = Math.min(100, puntuacio + 3);
    }

    if (puntuacio >= 70 && (!millor || puntuacio > millor.puntuacio)) {
      millor = { centre: c, puntuacio, motiu };
    }
  }

  return millor;
}

/**
 * Genera propostes de mapeig a partir del llistat payroll + centres de Dimensions.
 * No escriu a BD — només calcula.
 */
export async function proposarMapeigDesDePayroll(
  buffer: Buffer
): Promise<{ propostes: PropostaMapeig[]; senseMatch: string[]; errors: string[] }> {
  const errors: string[] = [];
  let files: { codi: string; text: string }[] = [];
  try {
    // Només etiquetes (codi/text); els imports no calen per al mapeig.
    files = parseEtiquetesPayrollPerMapeig(buffer).files;
  } catch (e) {
    return {
      propostes: [],
      senseMatch: [],
      errors: [e instanceof Error ? e.message : "Error llegint l'Excel."],
    };
  }

  if (!files.length) {
    return {
      propostes: [],
      senseMatch: [],
      errors: ["No s'han trobat etiquetes amb codi al fitxer (ex. «02001 - ADMINISTRACIO…»)."],
    };
  }

  // Unic per codi (preferim el text més llarg / descriptiu)
  const perCodi = new Map<string, string>();
  for (const f of files) {
    const prev = perCodi.get(f.codi);
    if (!prev || f.text.length > prev.length) perCodi.set(f.codi, f.text);
  }

  const centresRaw = await db.centre.findMany({
    where: { isActive: true },
    select: {
      id: true,
      codi: true,
      nom: true,
      liniaNegoci: { select: { codi: true } },
    },
  });
  const centres: CentreOpt[] = centresRaw.map((c) => ({
    id: c.id,
    codi: c.codi,
    nom: c.nom,
    lnCodi: c.liniaNegoci.codi,
  }));

  const byRestaurant = new Map<string, CentreOpt>();
  for (const c of centres.filter((x) => x.lnCodi === "LN00001")) {
    indexaCentrePerNom(byRestaurant, c);
  }

  const propostes: PropostaMapeig[] = [];
  const senseMatch: string[] = [];

  for (const [codi, text] of [...perCodi.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "ca", { numeric: true })
  )) {
    const hit = trobarCentrePerEtiqueta(text, centres, byRestaurant);
    if (!hit) {
      senseMatch.push(`${codi} · ${etiquetaSenseCodi(text) || text}`);
      continue;
    }
    // Text més net: segment després del codi de centre, no tota la jerarquia LN
    let textNet = text;
    const idxCodi = text.indexOf(codi);
    if (idxCodi >= 0) {
      textNet =
        text
          .slice(idxCodi)
          .replace(new RegExp(`^${codi}\\s*[-–.:)]?\\s*`), "")
          .trim() || text;
      // Talla a la següent branca de codi fill si n'hi ha
      const next = textNet.match(/\s[-–]\s*\d{4,8}\b/);
      if (next?.index && next.index > 3) textNet = textNet.slice(0, next.index).trim();
    } else {
      textNet = etiquetaSenseCodi(text) || text;
    }

    const dept =
      hit.centre.lnCodi === "LN00001"
        ? (inferDeptSalarialDesDeText(text) ?? inferDeptSalarialDesDeText(textNet))
        : null;

    propostes.push({
      codi,
      text: textNet.slice(0, 120),
      centreId: hit.centre.id,
      centreCodi: hit.centre.codi,
      centreNom: hit.centre.nom,
      departamentSalarial: dept,
      puntuacio: hit.puntuacio,
      motiu: hit.motiu,
    });
  }

  if (!propostes.length && !senseMatch.length) {
    errors.push("El fitxer no conté files reconeixibles.");
  }

  return { propostes, senseMatch, errors };
}

/**
 * Desa les propostes (upsert per codi). Si substituirTot, esborra abans tot el mapeig.
 */
export async function aplicarPropostesMapeig(
  propostes: PropostaMapeig[],
  opts?: { substituirTot?: boolean; puntuacioMin?: number }
): Promise<{ importats: number; errors: string[] }> {
  const min = opts?.puntuacioMin ?? 70;
  const errors: string[] = [];
  const valides = propostes.filter((p) => p.puntuacio >= min);
  if (opts?.substituirTot) {
    await db.mapeigCodiCostPersonal.deleteMany({});
  }

  let importats = 0;
  for (const p of valides) {
    try {
      await db.mapeigCodiCostPersonal.upsert({
        where: { codi: p.codi },
        create: {
          codi: p.codi,
          text: p.text,
          centreId: p.centreId,
          departamentSalarial: p.departamentSalarial,
        },
        update: {
          text: p.text,
          centreId: p.centreId,
          departamentSalarial: p.departamentSalarial,
          isActive: true,
        },
      });
      importats++;
    } catch {
      errors.push(`No s'ha pogut desar el codi ${p.codi}.`);
    }
  }
  return { importats, errors };
}

/** Flux complet: parse → match → desar. */
export async function generarMapeigDesDePayrollBuffer(
  buffer: Buffer,
  opts?: { substituirTot?: boolean }
): Promise<{
  ok: boolean;
  missatge: string;
  importats: number;
  senseMatch: number;
  exemplesSenseMatch: string[];
  errors: string[];
}> {
  const { propostes, senseMatch, errors } = await proposarMapeigDesDePayroll(buffer);
  if (errors.length && !propostes.length) {
    return {
      ok: false,
      missatge: errors[0] ?? "Error.",
      importats: 0,
      senseMatch: senseMatch.length,
      exemplesSenseMatch: senseMatch.slice(0, 12),
      errors,
    };
  }

  const { importats, errors: errApply } = await aplicarPropostesMapeig(propostes, {
    substituirTot: opts?.substituirTot,
  });
  const allErr = [...errors, ...errApply];

  return {
    ok: importats > 0,
    missatge: importats
      ? `Mapeig generat: ${importats} codis → centre.${
          senseMatch.length ? ` ${senseMatch.length} sense coincidència (revisa manualment).` : ""
        }`
      : "No s'ha pogut generar cap mapeig automàtic. Revisa els noms dels centres o afegeix files a mà.",
    importats,
    senseMatch: senseMatch.length,
    exemplesSenseMatch: senseMatch.slice(0, 12),
    errors: allErr,
  };
}

/** Rutes on busquem el llistat payroll al disc (repo / cwd). */
export function rutesFitxerCostPersonalLocal(): string[] {
  const candidates = [
    path.resolve(process.cwd(), "Cost_Personal_07_26.xlsx"),
    path.resolve(process.cwd(), "..", "Cost_Personal_07_26.xlsx"),
    path.resolve(process.cwd(), "..", "..", "Cost_Personal_07_26.xlsx"),
    "C:\\dev\\OpsiaFinance\\Cost_Personal_07_26.xlsx",
  ];
  const dirs = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", ".."),
    "C:\\dev\\OpsiaFinance",
  ];
  try {
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        if (/^Cost_Personal_.*\.xlsx$/i.test(name)) {
          candidates.push(path.join(dir, name));
        }
      }
    }
  } catch {
    /* ignore */
  }
  return [...new Set(candidates)];
}

/** Genera el mapeig llegint el Excel del disc (sense pujar-lo). */
export async function generarMapeigDesDeFitxerLocal(opts?: {
  substituirTot?: boolean;
}): Promise<{
  ok: boolean;
  missatge: string;
  importats: number;
  senseMatch: number;
  exemplesSenseMatch: string[];
  errors: string[];
  fitxer?: string;
}> {
  const rutes = rutesFitxerCostPersonalLocal();
  let trobat: string | null = null;
  for (const r of rutes) {
    try {
      await fsp.access(r);
      trobat = r;
      break;
    } catch {
      /* next */
    }
  }
  if (!trobat) {
    return {
      ok: false,
      missatge:
        "No s'ha trobat Cost_Personal_*.xlsx a l'arrel del repo (ex. C:\\dev\\OpsiaFinance\\Cost_Personal_07_26.xlsx).",
      importats: 0,
      senseMatch: 0,
      exemplesSenseMatch: [],
      errors: [],
    };
  }
  const buffer = Buffer.from(await fsp.readFile(trobat));
  const r = await generarMapeigDesDePayrollBuffer(buffer, opts);
  return { ...r, fitxer: trobat, missatge: `${r.missatge} (${trobat})` };
}

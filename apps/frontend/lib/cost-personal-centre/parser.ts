/**
 * Parser Cost Personal (nòmina / millores).
 *
 * Regles de negoci (docs/gestio-i-cost-personal.md):
 *   - Columnes: Importe bruto + Provisión + Seguridad Social (+ Operación ignorada)
 *   - Sous = brut + provisió · SS = L · Cost = brut + provisió + SS (mai Operación)
 *   - Centres (5 dígits) i departaments (6–8 dígits); l’import evita doble comptatge
 *   - Capçaleres LN («04 - PRECUINATS») NO s’importen ni hereten al centre anterior
 */

import type { DepartamentSalarial } from "@prisma/client";
import { type WorkBook, read, utils } from "xlsx";

export type FilaCostPersonalExcel = {
  codi: string;
  text: string;
  /** Col. brut (J / Importe bruto) */
  importBrut: number;
  /** Col. provisió pagues (K) — 0 a millores */
  segSocialEmpresa: number;
  /** Col. seguretat social (L) */
  totalSegSocial: number;
  /** Sempre brut+provisió+SS */
  costPersonal: number;
  nivell: number;
  codiHeretat?: boolean;
};

type Layout = {
  startRow: number;
  idxDesc: number;
  idxBrut: number;
  idxProv: number;
  idxSs: number;
  /** Operación / total fitxer — només per validar layout; no s’usa com a cost */
  idxOp: number;
  origen: string;
};

/* ─── helpers numèrics / text ─────────────────────────────────────────────── */

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g, "").replace(/[€$]/g, "");
  if (!s || s === "-" || s === "—") return 0;
  let neg = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

function normHeader(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function cellNum(raw: unknown[], text: unknown[], col: number): number {
  if (col < 0) return 0;
  const a = parseNum(raw[col]);
  if (a !== 0) return a;
  return parseNum(text[col]);
}

function cellText(raw: unknown[], text: unknown[], col: number): string {
  const t = text[col];
  if (t !== null && t !== undefined && String(t).trim()) return String(t).trim();
  const r = raw[col];
  if (r !== null && r !== undefined && String(r).trim()) return String(r).trim();
  return "";
}

function absRound2(...vals: number[]): number {
  return Math.round(vals.reduce((s, v) => s + Math.abs(v), 0) * 100) / 100;
}

/* ─── classificació de files ──────────────────────────────────────────────── */

/** Concepte comptable 100.x / SOU / MILLORES — no és centre. */
export function esLiniaConcepteComptable(text: string): boolean {
  const t = text.trim();
  if (/^\d{1,3}[.,]\d+\b/.test(t)) return true;
  const n = normHeader(t);
  return (
    /\b(sou i salari|sou i salaris|salario|millores|mejora|indemnitz|seguretat social|seguridad social)\b/.test(
      n
    ) && !/\b\d{5}\b/.test(t)
  );
}

export function esFilaResumOTotal(text: string): boolean {
  const t = text.trim();
  if (!t || esLiniaConcepteComptable(t)) return false;
  const n = normHeader(t);
  if (/\btotal\s+(empresa|general|global|grupo|grup)\b/.test(n)) return true;
  if (/^(total|suma|subtotal)\b/.test(n)) return true;
  if (/\bsubtotal\b/.test(n)) return true;
  if (/\b(trabajadores|treballadors|empleados|empleats)\b/.test(n)) return true;
  return false;
}

/**
 * «04 - PRECUINATS», «01 - RESTAURANTS»… sense codi de centre.
 * Si s’importessin/heretessin → Casaments llegiria Precuinats, etc.
 */
export function esCapcaleraLiniaNegoci(text: string): boolean {
  const t = text.trim();
  if (!t || esLiniaConcepteComptable(t) || esFilaResumOTotal(t)) return false;
  if (!/^\d{2}\b/.test(t)) return false;
  if (/\b\d{5}\b/.test(t)) return false;
  return true;
}

/** Detall sota centre: pot heretar el codi del centre pare. */
export function esFilaDetallHeretable(text: string): boolean {
  if (esLiniaConcepteComptable(text)) return true;
  const n = normHeader(text);
  return /\b(sala|cuina|cocina|netej|limpieza|cambrer|cuiner)\b/.test(n);
}

export function esCodiCentrePayroll(text: string, codi: string): boolean {
  if (!codi || !/^\d{4,8}$/.test(codi)) return false;
  if (esLiniaConcepteComptable(text)) return false;
  if (codi.length === 5 || codi.length >= 7) return true;
  if (codi.length === 4) return !/^100\d?$/.test(codi);
  return false;
}

/** Prioritza codi de centre de 5 dígits (primer trobat). */
export function extreureCodiPayroll(text: string): string | null {
  const t = text.trim();
  if (!t || esLiniaConcepteComptable(t)) return null;
  const cinc = t.match(/\b(\d{5})\b/g);
  if (cinc?.length) return cinc[0] ?? null;
  const lead = t.match(/^(\d{4,8})\b/);
  if (lead?.[1]) return lead[1];
  const tots = t.match(/\b(\d{4,8})\b/g);
  if (tots?.length) return [...tots].sort((a, b) => b.length - a.length)[0] ?? null;
  return null;
}

/**
 * Codi més específic de la fila.
 * Si hi ha departament (6–8 dígits), aquest mana; si no, l’últim centre de 5 dígits.
 */
export function extreureCodiMesEspecific(text: string): string | null {
  const t = text.trim();
  if (!t || esLiniaConcepteComptable(t)) return null;
  const depts = t.match(/\b(\d{6,8})\b/g);
  if (depts?.length) {
    return [...depts].sort((a, b) => b.length - a.length)[0] ?? null;
  }
  const centres = t.match(/\b(\d{5})\b/g);
  if (centres?.length) {
    // «00 - … - 00105 - CUINA CENTRAL» → 00105 (l’últim 5 dígits)
    return centres[centres.length - 1] ?? null;
  }
  const lead = t.match(/^(\d{4,8})\b/);
  if (lead?.[1] && lead[1].length >= 4) return lead[1];
  return null;
}

export function extreureCodisPerMapeig(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const tots = [...new Set(t.match(/\b(\d{4,8})\b/g) ?? [])];
  const cinc = tots.filter((c) => c.length === 5);
  if (!cinc.length) return tots.filter((c) => c.length >= 4);
  const out = [...cinc];
  for (const c of tots) {
    if (c.length >= 7 && cinc.some((p) => c.startsWith(p))) out.push(c);
  }
  return [...new Set(out)];
}

export function inferDeptSalarialDesDeText(text: string): DepartamentSalarial | null {
  const t = normHeader(text);
  if (/\bcuina\b/.test(t) || /\bcocin/.test(t)) return "CUINA";
  if (/\bsala\b/.test(t) || /\bcambrer/.test(t)) return "SALA";
  return null;
}

function esCapcaleraColumna(text: string): boolean {
  const n = normHeader(text);
  return (
    n.includes("importe bruto") ||
    n.includes("import brut") ||
    n.includes("provisio") ||
    n.includes("provision") ||
    n.includes("seguridad social") ||
    n.includes("seguretat social") ||
    n.includes("operacion") ||
    n.includes("operacio") ||
    n.includes("coste de personal") ||
    n.includes("listado") ||
    n.includes("llistat")
  );
}

/* ─── layout de columnes ──────────────────────────────────────────────────── */

/** Capçaleres amb nom (font de veritat). */
function detectarLayoutPerCapcalera(matrix: unknown[][]): Layout | null {
  for (let i = 0; i < Math.min(40, matrix.length); i++) {
    const headers = (matrix[i] ?? []).map(normHeader);

    const idxBrut = headers.findIndex(
      (h) =>
        h.includes("importe bruto") ||
        h.includes("import brut") ||
        h.includes("salario bruto") ||
        (h.includes("importe") && h.includes("brut")) ||
        h === "bruto" ||
        h === "brut"
    );
    const idxProv = headers.findIndex(
      (h) =>
        h.includes("provisio") ||
        h.includes("provision") ||
        (h.includes("paga") && h.includes("extra"))
    );
    const idxSs = headers.findIndex(
      (h, col) =>
        col !== idxProv &&
        !h.includes("operacion") &&
        !h.includes("operacio") &&
        (h.includes("seguridad social") ||
          h.includes("seguretat social") ||
          (h.includes("social") && (h.includes("empresa") || h.includes("segur"))) ||
          h === "ss")
    );
    const idxOp = headers.findIndex(
      (h) =>
        h.includes("operacion") ||
        h.includes("operacio") ||
        (h.includes("cost") && h.includes("personal")) ||
        h === "coste" ||
        h === "cost"
    );

    if (idxBrut < 0 || idxSs < 0) continue;
    // Ordre esperat: brut < provisió < ss (< op)
    if (idxProv >= 0 && !(idxBrut < idxProv && idxProv < idxSs)) continue;
    if (idxOp >= 0 && idxSs >= idxOp) continue;

    let idxDesc = headers.findIndex(
      (h) =>
        h.includes("descrip") ||
        h.includes("denomin") ||
        h.includes("dimension") ||
        h.includes("centro") ||
        h.includes("centre") ||
        h.includes("concepto") ||
        h.includes("organiza")
    );
    if (idxDesc < 0) idxDesc = 0;

    return {
      startRow: i + 1,
      idxDesc,
      idxBrut,
      idxProv,
      idxSs,
      idxOp: idxOp >= 0 ? idxOp : -1,
      origen: `capçalera f${i} brut=${idxBrut} prov=${idxProv} ss=${idxSs} op=${idxOp}`,
    };
  }
  return null;
}

function detectarIdxDesc(matrixText: unknown[][], startRow: number): number {
  let millor = 0;
  let millorScore = 0;
  const fi = Math.min(startRow + 100, matrixText.length);
  const maxCols = Math.min(
    20,
    Math.max(1, ...matrixText.slice(startRow, fi).map((r) => (r ?? []).length))
  );
  for (let col = 0; col < maxCols; col++) {
    let score = 0;
    for (let i = startRow; i < fi; i++) {
      const t = String((matrixText[i] ?? [])[col] ?? "");
      if (/\b\d{5}\b/.test(t)) score += 2;
      else if (/\b\d{4,8}\b/.test(t) && /[A-Za-zÀ-ú]/.test(t)) score += 1;
    }
    if (score > millorScore) {
      millorScore = score;
      millor = col;
    }
  }
  return millor;
}

function detectarStartDades(matrixText: unknown[][], idxDesc: number): number {
  for (let i = 0; i < Math.min(60, matrixText.length); i++) {
    const t = String((matrixText[i] ?? [])[idxDesc] ?? "");
    if (/\b\d{5}\b/.test(t) || extreureCodiPayroll(t)) return i;
  }
  return 0;
}

/**
 * Puntuació de coherència d’un layout candidat:
 * - brut sol ser el component més gran
 * - SS < sous
 * - si hi ha Operación: brut+prov+ss ≈ op
 */
function scoreLayout(
  matrixRaw: unknown[][],
  matrixText: unknown[][],
  layout: Layout,
  mode: "NOMINA" | "MILLORES"
): number {
  let okQuadre = 0;
  let mostres = 0;
  let sumBrut = 0;
  let sumProv = 0;
  let sumSs = 0;

  const fi = Math.min(layout.startRow + 120, matrixRaw.length);
  for (let i = layout.startRow; i < fi; i++) {
    const raw = matrixRaw[i] ?? [];
    const text = matrixText[i] ?? [];
    const j = Math.abs(cellNum(raw, text, layout.idxBrut));
    const k = mode === "MILLORES" ? 0 : Math.abs(cellNum(raw, text, layout.idxProv));
    const l = Math.abs(cellNum(raw, text, layout.idxSs));
    if (j + k + l < 1) continue;
    sumBrut += j;
    sumProv += k;
    sumSs += l;
    if (layout.idxOp >= 0) {
      const m = Math.abs(cellNum(raw, text, layout.idxOp));
      if (m >= 1) {
        mostres++;
        if (Math.abs(j + k + l - m) <= Math.max(0.5, m * 0.02)) okQuadre++;
      }
    }
  }

  let score = sumBrut + sumProv + sumSs * 0.3;
  if (mode === "NOMINA") {
    if (sumBrut > sumProv && sumBrut > sumSs) score += 1e8;
    const sous = sumBrut + sumProv;
    if (sous > 1 && sumSs < sous * 0.8) score += 5e7;
    if (sous > 1 && sumSs > sous * 1.2) score -= 2e8; // desplaçament +1 típic
  }
  if (mostres >= 3) score += (okQuadre / mostres) * 3e8;
  return score;
}

function resolLayout(
  matrixRaw: unknown[][],
  matrixText: unknown[][],
  mode: "NOMINA" | "MILLORES"
): Layout {
  const perNom = detectarLayoutPerCapcalera(matrixText) ?? detectarLayoutPerCapcalera(matrixRaw);
  if (perNom) return { ...perNom, idxProv: mode === "MILLORES" ? -1 : perNom.idxProv };

  const idxDesc = detectarIdxDesc(matrixText, 0);
  const start = detectarStartDades(matrixText, idxDesc);

  // Candidats fixos: I/J/K/L (brut a I) i J/K/L/M (brut a J)
  const candidats: Layout[] = [
    {
      startRow: start,
      idxDesc,
      idxBrut: 8,
      idxProv: mode === "MILLORES" ? -1 : 9,
      idxSs: 10,
      idxOp: 11,
      origen: "fixes I/J/K/L",
    },
    {
      startRow: start,
      idxDesc,
      idxBrut: 9,
      idxProv: mode === "MILLORES" ? -1 : 10,
      idxSs: 11,
      idxOp: 12,
      origen: "fixes J/K/L/M",
    },
  ];

  let millor = candidats[0]!;
  let millorScore = Number.NEGATIVE_INFINITY;
  for (const c of candidats) {
    const s = scoreLayout(matrixRaw, matrixText, c, mode);
    // Preferència lleu a I/J/K/L (desplaçament històric)
    const bonus = c.idxBrut === 8 ? 1e6 : 0;
    if (s + bonus > millorScore) {
      millorScore = s + bonus;
      millor = c;
    }
  }
  return millor;
}

/* ─── extracció de files ──────────────────────────────────────────────────── */

function extreureFiles(
  matrixRaw: unknown[][],
  matrixText: unknown[][],
  layout: Layout,
  mode: "NOMINA" | "MILLORES"
): FilaCostPersonalExcel[] {
  const out: FilaCostPersonalExcel[] = [];
  let centreActual: string | null = null;
  let textCentreActual: string | null = null;

  for (let i = layout.startRow; i < matrixRaw.length; i++) {
    const raw = matrixRaw[i] ?? [];
    const txt = matrixText[i] ?? [];

    let text = cellText(raw, txt, layout.idxDesc);
    if (!text) {
      for (let c = 0; c < 4; c++) {
        if (c === layout.idxDesc) continue;
        const t = cellText(raw, txt, c);
        if (t && !esCapcaleraColumna(t) && !esFilaResumOTotal(t)) {
          text = t;
          break;
        }
      }
    }

    const textScan = [text, cellText(raw, txt, 0), cellText(raw, txt, 1), cellText(raw, txt, 2)]
      .filter(Boolean)
      .join(" · ");

    // Totals / capçaleres LN → trenquen herència i NO s’importen
    if (esFilaResumOTotal(text) || esFilaResumOTotal(textScan)) {
      centreActual = null;
      textCentreActual = null;
      continue;
    }
    if (esCapcaleraLiniaNegoci(text) || esCapcaleraLiniaNegoci(textScan)) {
      centreActual = null;
      textCentreActual = null;
      continue;
    }

    if (!text || esCapcaleraColumna(text)) {
      for (let c = 0; c < 4; c++) {
        const t = cellText(raw, txt, c);
        if (!t || esFilaResumOTotal(t)) continue;
        const codi = extreureCodiPayroll(t);
        if (codi && esCodiCentrePayroll(t, codi)) {
          centreActual = codi;
          textCentreActual = t;
          break;
        }
      }
      continue;
    }

    // Codi de la fila: el més específic (dept 6–8 mana sobre centre 5)
    let codiPropi: string | null = null;
    for (let c = 0; c < 4; c++) {
      const t = cellText(raw, txt, c);
      if (!t || esFilaResumOTotal(t)) continue;
      const codi = extreureCodiMesEspecific(t);
      if (codi && esCodiCentrePayroll(t, codi.length >= 5 ? codi.slice(0, 5) : codi)) {
        // Actualitza centreActual amb el centre 5 dígits si n’hi ha
        const centre5 = codi.length >= 5 ? codi.slice(0, 5) : null;
        if (centre5 && /^\d{5}$/.test(centre5)) {
          centreActual = centre5;
          textCentreActual = t;
        }
        codiPropi = codi;
        break;
      }
    }
    if (!codiPropi) {
      const c = extreureCodiMesEspecific(text);
      if (c) {
        codiPropi = c;
        if (/^\d{5}/.test(c)) {
          centreActual = c.slice(0, 5);
          textCentreActual = text;
        }
      }
    }

    const brut = cellNum(raw, txt, layout.idxBrut);
    const prov = mode === "MILLORES" ? 0 : cellNum(raw, txt, layout.idxProv);
    const ss = cellNum(raw, txt, layout.idxSs);
    let j = brut;
    // % imputació ~100 a la col brut → ignora
    if (Math.abs(j) >= 99 && Math.abs(j) <= 101 && Math.abs(prov) + Math.abs(ss) > 0.05) {
      j = 0;
    }
    const suma = Math.abs(j) + Math.abs(prov) + Math.abs(ss);
    if (suma < 0.05) continue;

    // Centres (5) i departaments (6–8). El servei d’import decideix fulles vs pare.
    if (!codiPropi || codiPropi.length < 5 || codiPropi.length > 8) {
      continue;
    }

    out.push({
      codi: codiPropi,
      text,
      importBrut: Math.abs(j),
      segSocialEmpresa: Math.abs(prov),
      totalSegSocial: Math.abs(ss),
      costPersonal: absRound2(j, prov, ss),
      nivell: codiPropi.length === 5 ? 0 : 1,
      codiHeretat: false,
    });
  }

  // Un sol registre per codi (si el fitxer repeteix la fila, ens quedem l’última)
  const perCodi = new Map<string, FilaCostPersonalExcel>();
  for (const f of out) {
    perCodi.set(f.codi, f);
  }
  return [...perCodi.values()];
}

export function normalitzarFilesNomina(files: FilaCostPersonalExcel[]): FilaCostPersonalExcel[] {
  return files.map((f) => {
    const brut = Math.abs(f.importBrut);
    const provisio = Math.abs(f.segSocialEmpresa);
    const ss = Math.abs(f.totalSegSocial);
    return {
      ...f,
      importBrut: brut,
      segSocialEmpresa: provisio,
      totalSegSocial: ss,
      costPersonal: absRound2(brut, provisio, ss),
    };
  });
}

export function normalitzarFilesMillores(files: FilaCostPersonalExcel[]): FilaCostPersonalExcel[] {
  return files.map((f) => {
    const brut = Math.abs(f.importBrut);
    const ss = Math.abs(f.totalSegSocial);
    return {
      ...f,
      importBrut: brut,
      segSocialEmpresa: 0,
      totalSegSocial: ss,
      costPersonal: absRound2(brut, ss),
    };
  });
}

/* ─── API pública ─────────────────────────────────────────────────────────── */

export function parseExcelCostPersonalCentre(
  buffer: Buffer,
  mode: "NOMINA" | "MILLORES" = "NOMINA"
): { files: FilaCostPersonalExcel[]; diagnostica?: string } {
  const wb: WorkBook = read(buffer, { type: "buffer", cellDates: true });
  let millor: { files: FilaCostPersonalExcel[]; diagnostica: string; score: number } | null = null;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const matrixRaw = utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    const matrixText = utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
    });
    if (!matrixRaw.length) continue;

    const layout = resolLayout(matrixRaw, matrixText, mode);
    const files = extreureFiles(matrixRaw, matrixText, layout, mode);
    const score = files.reduce(
      (s, f) => s + f.importBrut + f.segSocialEmpresa + f.totalSegSocial,
      0
    );
    const diag = [
      `Full «${sheetName}»`,
      layout.origen,
      `brut=${layout.idxBrut} prov=${layout.idxProv} ss=${layout.idxSs}`,
      `${files.length} files`,
      `Σbrut=${Math.round(files.reduce((s, f) => s + f.importBrut, 0))}`,
      `ΣSS=${Math.round(files.reduce((s, f) => s + f.totalSegSocial, 0))}`,
    ].join(" · ");

    if (!millor || score > millor.score) {
      millor = { files, diagnostica: diag, score };
    }
  }

  if (!millor) return { files: [], diagnostica: "Fulls buits." };

  const files =
    mode === "MILLORES"
      ? normalitzarFilesMillores(millor.files)
      : normalitzarFilesNomina(millor.files);

  return { files, diagnostica: millor.diagnostica };
}

/** Etiquetes per generar mapeig (sense imports). */
export function parseEtiquetesPayrollPerMapeig(buffer: Buffer): {
  files: { codi: string; text: string }[];
} {
  const parsed = parseExcelCostPersonalCentre(buffer, "NOMINA");
  const perCodi = new Map<string, string>();
  for (const f of parsed.files) {
    for (const codi of extreureCodisPerMapeig(f.text)) {
      if (codi.length < 4) continue;
      const prev = perCodi.get(codi);
      if (!prev || f.text.length < prev.length) perCodi.set(codi, f.text);
    }
    if (/^\d{4,8}$/.test(f.codi) && f.codi.length >= 4) {
      const prev = perCodi.get(f.codi);
      if (!prev || f.text.length < prev.length) perCodi.set(f.codi, f.text);
    }
  }
  return {
    files: [...perCodi.entries()]
      .map(([codi, text]) => ({ codi, text }))
      .sort((a, b) => a.codi.localeCompare(b.codi, "ca", { numeric: true })),
  };
}

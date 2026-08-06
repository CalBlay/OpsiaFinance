import type { DepartamentSalarial } from "@prisma/client";
import { type WorkBook, read, utils } from "xlsx";

export type FilaCostPersonalExcel = {
  /** Codi extret (02001, 0015…) o clau normalitzada del text. */
  codi: string;
  text: string;
  importBrut: number;
  segSocialEmpresa: number;
  totalSegSocial: number;
  costPersonal: number;
  /** Nivell d’indentació aproximat (0 = arrel). */
  nivell: number;
};

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
    // 1,234.56 vs 1.234,56 — si hi ha coma després del punt → ES
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

function normalitzarCapçalera(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Extreu el codi d’una etiqueta jeràrquica (prioritza el número inicial). */
export function extreureCodiPayroll(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  // Nivell centre típic: 5 dígits (02001, 00105…). Evita LN de 2 dígits (00, 01, 02).
  const centres = t.match(/\b(\d{5})\b/g);
  if (centres?.length) {
    // El primer codi de 5 dígits sol ser el centre; si n'hi ha més, el primer
    return centres[0] ?? null;
  }
  const leading = t.match(/^(\d{2,8})\b/);
  if (leading?.[1] && leading[1].length >= 4) return leading[1];
  const tots = t.match(/\b(\d{4,8})\b/g);
  if (!tots?.length) return null;
  return tots.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * Tots els codis útils per mapeig en una etiqueta jeràrquica.
 * Prioritza nivell centre (5 dígits); també inclou fulles 6–8 si porten Sala/Cuina.
 */
export function extreureCodisPerMapeig(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const tots = [...new Set(t.match(/\b(\d{4,8})\b/g) ?? [])];
  const cinc = tots.filter((c) => c.length === 5);
  if (cinc.length) {
    const out = [...cinc];
    // Fulles 7–8 dígits que pengen d'un centre (ex. 07001004 SALA)
    for (const c of tots) {
      if (c.length >= 7 && cinc.some((p) => c.startsWith(p))) out.push(c);
    }
    return [...new Set(out)];
  }
  return tots.filter((c) => c.length >= 4);
}

function detectarCapçalera(matrix: unknown[][]): {
  row: number;
  idxDesc: number;
  idxBrut: number;
  idxSsEmp: number;
  idxSsTot: number;
  idxCost: number;
} | null {
  for (let i = 0; i < Math.min(40, matrix.length); i++) {
    const row = matrix[i] ?? [];
    const headers = row.map(normalitzarCapçalera);
    const idxBrut = headers.findIndex(
      (h) =>
        h.includes("importe bruto") ||
        h.includes("import brut") ||
        h.includes("salario bruto") ||
        h === "bruto" ||
        h === "brut"
    );
    const idxCost = headers.findIndex(
      (h) =>
        h.includes("coste de personal") ||
        h.includes("cost personal") ||
        h.includes("coste personal") ||
        h.includes("costo de personal")
    );
    const idxSsEmp = headers.findIndex(
      (h) =>
        (h.includes("provision") && (h.includes("paga") || h.includes("extra"))) ||
        h.includes("seguridad social empresa") ||
        h.includes("seguretat social empresa") ||
        h.includes("ss empresa")
    );
    const idxSsTot = headers.findIndex(
      (h) =>
        (h.includes("total") && (h.includes("seg") || h.includes("ss"))) ||
        h.includes("total seg. social") ||
        h.includes("total seg social") ||
        h.includes("seguridad social") ||
        h.includes("seguretat social")
    );
    if (idxBrut >= 0 || idxCost >= 0) {
      let idxDesc = headers.findIndex(
        (h) =>
          h.includes("centre") ||
          h.includes("centro") ||
          h.includes("descrip") ||
          h.includes("cuenta") ||
          h.includes("compte") ||
          h.includes("denomin") ||
          h.includes("dimension") ||
          h.includes("concepto")
      );
      if (idxDesc < 0) idxDesc = 0;
      return {
        row: i,
        idxDesc,
        idxBrut: idxBrut >= 0 ? idxBrut : idxCost,
        idxSsEmp: idxSsEmp >= 0 ? idxSsEmp : -1,
        idxSsTot: idxSsTot >= 0 ? idxSsTot : -1,
        idxCost: idxCost >= 0 ? idxCost : idxBrut,
      };
    }
  }
  return null;
}

function nivellIndent(raw: string): number {
  const m = raw.match(/^(\s*)/);
  const spaces = m?.[1]?.length ?? 0;
  return Math.floor(spaces / 2);
}

function esTextCapcaleraOTitol(text: string): boolean {
  const n = normalitzarCapçalera(text);
  return (
    n.includes("importe") ||
    n.includes("coste de personal") ||
    n.includes("cost personal") ||
    n.includes("seguridad social") ||
    n.includes("seguretat social") ||
    n === "descripcion" ||
    n === "descripcio" ||
    n === "concepto" ||
    n.includes("listado") ||
    n.includes("llistat")
  );
}

/**
 * Només etiquetes (codi + text) per generar el mapeig.
 * No calen columnes d'imports ni imports ≠ 0.
 */
export function parseEtiquetesPayrollPerMapeig(buffer: Buffer): {
  files: { codi: string; text: string }[];
} {
  const wb: WorkBook = read(buffer);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { files: [] };

  const matrix = utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: false,
  });
  if (!matrix.length) return { files: [] };

  const cap = detectarCapçalera(matrix);
  let idxDesc = cap?.idxDesc ?? 0;
  let idxCodiSeparat = -1;
  let startRow = cap ? cap.row + 1 : 0;

  if (!cap) {
    let millorCol = 0;
    let millorScore = 0;
    const maxCols = Math.min(8, Math.max(1, ...matrix.slice(0, 100).map((r) => (r ?? []).length)));
    for (let col = 0; col < maxCols; col++) {
      let score = 0;
      for (let i = 0; i < Math.min(100, matrix.length); i++) {
        const t = String((matrix[i] ?? [])[col] ?? "").trim();
        if (!t) continue;
        if (extreureCodiPayroll(t) || /^\d{2,8}\b/.test(t) || /\s[-–]\s/.test(t)) score++;
      }
      if (score > millorScore) {
        millorScore = score;
        millorCol = col;
      }
    }
    idxDesc = millorCol;

    if (idxDesc > 0) {
      let codiScore = 0;
      for (let i = 0; i < Math.min(80, matrix.length); i++) {
        const t = String((matrix[i] ?? [])[idxDesc - 1] ?? "").trim();
        if (/^\d{2,8}$/.test(t)) codiScore++;
      }
      if (codiScore >= 5) idxCodiSeparat = idxDesc - 1;
    }

    for (let i = 0; i < Math.min(40, matrix.length); i++) {
      const t = String((matrix[i] ?? [])[idxDesc] ?? "").trim();
      const c = idxCodiSeparat >= 0 ? String((matrix[i] ?? [])[idxCodiSeparat] ?? "").trim() : "";
      if (extreureCodiPayroll(t) || /^\d{2,8}$/.test(c) || /^\d{2,8}\b/.test(t)) {
        startRow = i;
        break;
      }
    }
  }

  const perCodi = new Map<string, string>();

  const registra = (codi: string, text: string) => {
    if (!codi || !text || esTextCapcaleraOTitol(text)) return;
    // Ignora només LN de 2 dígits (00, 01, 02…) — no són centre
    if (codi.length <= 2) return;
    const prev = perCodi.get(codi);
    // Preferim el text més curt i específic (menys jerarquia engolada)
    if (!prev || text.length < prev.length || (text.length === prev.length && text < prev)) {
      perCodi.set(codi, text);
    }
  };

  for (let i = startRow; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const descRaw = String(row[idxDesc] ?? "");
    let text = descRaw.trim();
    if (!text) continue;
    if (esTextCapcaleraOTitol(text)) continue;

    if (idxCodiSeparat >= 0) {
      const c = String(row[idxCodiSeparat] ?? "").trim();
      if (/^\d{4,8}$/.test(c)) {
        if (!text.startsWith(c)) text = `${c} - ${text}`;
        registra(c, text);
      }
    }

    for (const codi of extreureCodisPerMapeig(text)) {
      registra(codi, text);
    }
  }

  if (perCodi.size === 0) {
    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i] ?? [];
      for (let col = 0; col < Math.min(6, row.length); col++) {
        const text = String(row[col] ?? "").trim();
        if (!text || esTextCapcaleraOTitol(text)) continue;
        for (const codi of extreureCodisPerMapeig(text)) {
          registra(codi, text);
        }
      }
    }
  }

  return {
    files: [...perCodi.entries()].map(([codi, text]) => ({ codi, text })),
  };
}

/**
 * Llegeix el llistat de costos per centre de cost (payroll).
 * Retorna files amb import ≠ 0 i text identificable.
 */
export function parseExcelCostPersonalCentre(buffer: Buffer): {
  files: FilaCostPersonalExcel[];
  diagnostica?: string;
} {
  const wb: WorkBook = read(buffer, { type: "buffer", cellDates: true });
  // Prova tots els fulls; agafa el que tingui més files amb imports
  let millor: { files: FilaCostPersonalExcel[]; diagnostica: string } | null = null;

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

    const parsed = parseMatrixCostPersonal(matrixRaw, matrixText, sheetName);
    if (!millor || parsed.files.length > millor.files.length) {
      millor = parsed;
    }
  }

  if (!millor) return { files: [], diagnostica: "Fulls buits." };
  return millor;
}

function cellNum(rawRow: unknown[], textRow: unknown[], col: number): number {
  if (col < 0) return 0;
  const fromRaw = parseNum(rawRow[col]);
  if (fromRaw !== 0) return fromRaw;
  return parseNum(textRow[col]);
}

function cellText(rawRow: unknown[], textRow: unknown[], col: number): string {
  const t = textRow[col];
  if (t !== null && t !== undefined && String(t).trim()) return String(t);
  const r = rawRow[col];
  if (r !== null && r !== undefined && String(r).trim()) return String(r);
  return "";
}

function detectarCapçaleraFlexible(matrix: unknown[][]): {
  row: number;
  idxDesc: number;
  idxBrut: number;
  idxSsEmp: number;
  idxSsTot: number;
  idxCost: number;
} | null {
  for (let i = 0; i < Math.min(50, matrix.length); i++) {
    const row = matrix[i] ?? [];
    const headers = row.map(normalitzarCapçalera);
    // Només coincidències FORTES (evitar títols tipus «Listado coste personal» a una sola cel·la)
    const idxBrut = headers.findIndex(
      (h) =>
        h.includes("importe bruto") ||
        h.includes("import brut") ||
        h.includes("salario bruto") ||
        h.includes("sou brut") ||
        (h.includes("importe") && h.includes("brut")) ||
        h === "bruto" ||
        h === "brut"
    );
    const idxCost = headers.findIndex(
      (h) =>
        h.includes("coste de personal") ||
        h.includes("cost personal") ||
        h.includes("coste personal") ||
        h.includes("costo de personal") ||
        (h.includes("coste") && h.includes("personal")) ||
        (h.includes("cost") && h.includes("personal"))
    );
    const idxSsEmp = headers.findIndex(
      (h) =>
        (h.includes("provision") && (h.includes("paga") || h.includes("extra"))) ||
        h.includes("seguridad social empresa") ||
        h.includes("seguretat social empresa") ||
        h.includes("ss empresa") ||
        h.includes("s.s. empresa")
    );
    const idxSsTot = headers.findIndex(
      (h) =>
        h.includes("total seg") ||
        h.includes("total ss") ||
        (h.includes("total") && h.includes("social")) ||
        h.includes("seguridad social") ||
        h.includes("seguretat social")
    );

    // Cal almenys 2 columnes de capçalera reconegudes, o brut+cost forts
    const hits = [idxBrut, idxCost, idxSsEmp, idxSsTot].filter((x) => x >= 0);
    if (hits.length < 1) continue;
    // Una sola coincidència dèbil a una cel·la llarga (títol) → ignora
    if (hits.length === 1) {
      const h = headers[hits[0]!] ?? "";
      if (h.length > 40) continue;
    }

    let idxDesc = headers.findIndex(
      (h) =>
        h.includes("centre") ||
        h.includes("centro") ||
        h.includes("descrip") ||
        h.includes("cuenta") ||
        h.includes("compte") ||
        h.includes("denomin") ||
        h.includes("dimension") ||
        h.includes("concepto") ||
        h.includes("organiza")
    );
    if (idxDesc < 0) idxDesc = 0;

    const brut = idxBrut >= 0 ? idxBrut : idxCost;
    const cost = idxCost >= 0 ? idxCost : brut;
    if (brut < 0) continue;

    return {
      row: i,
      idxDesc,
      idxBrut: brut,
      idxSsEmp: idxSsEmp >= 0 ? idxSsEmp : -1,
      idxSsTot: idxSsTot >= 0 ? idxSsTot : -1,
      idxCost: cost,
    };
  }
  return null;
}

type LayoutParse = {
  startRow: number;
  idxDesc: number;
  idxBrut: number;
  idxSsEmp: number;
  idxSsTot: number;
  idxCost: number;
  origen: string;
};

/** Columna de text amb codis + columnes numèriques (imports). */
function inferirLayout(matrixRaw: unknown[][], matrixText: unknown[][]): LayoutParse | null {
  const sample = Math.min(200, matrixRaw.length);
  const maxCols = Math.min(
    25,
    Math.max(1, ...matrixRaw.slice(0, sample).map((r) => (r ?? []).length), 1)
  );

  let idxDesc = 0;
  let bestDesc = 0;
  for (let col = 0; col < maxCols; col++) {
    let score = 0;
    for (let i = 0; i < sample; i++) {
      const t = cellText(matrixRaw[i] ?? [], matrixText[i] ?? [], col);
      if (!t || t.length < 3) continue;
      if (extreureCodiPayroll(t) || /\b\d{4,8}\b/.test(t)) score++;
      else if (/\s[-–]\s/.test(t) && /[A-Za-zÀ-ú]/.test(t)) score += 0.3;
    }
    if (score > bestDesc) {
      bestDesc = score;
      idxDesc = col;
    }
  }
  if (bestDesc < 3) return null;

  const numericScores: { col: number; score: number; sum: number }[] = [];
  for (let col = 0; col < maxCols; col++) {
    if (col === idxDesc) continue;
    let score = 0;
    let sum = 0;
    for (let i = 0; i < sample; i++) {
      const n = cellNum(matrixRaw[i] ?? [], matrixText[i] ?? [], col);
      if (Math.abs(n) > 0.5) {
        score++;
        sum += Math.abs(n);
      }
    }
    // Imports de nòmina: calen diverses files amb valors reals
    if (score >= 5 && sum > 10) numericScores.push({ col, score, sum });
  }
  numericScores.sort((a, b) => b.sum - a.sum || b.score - a.score);
  if (!numericScores.length) return null;

  let startRow = 0;
  for (let i = 0; i < Math.min(60, matrixRaw.length); i++) {
    const t = cellText(matrixRaw[i] ?? [], matrixText[i] ?? [], idxDesc);
    if (extreureCodiPayroll(t) || /\b\d{4,8}\b/.test(t)) {
      startRow = i;
      break;
    }
  }

  const cols = numericScores.map((n) => n.col);
  // Heurística: primera col num = brut, segona = SS, última (o la de més suma) = cost
  const byColAsc = [...cols].sort((a, b) => a - b);
  return {
    startRow,
    idxDesc,
    idxBrut: byColAsc[0] ?? cols[0]!,
    idxSsEmp: byColAsc[1] ?? -1,
    idxSsTot: byColAsc[1] ?? -1,
    idxCost: byColAsc[byColAsc.length - 1] ?? cols[0]!,
    origen: `inferit desc=${idxDesc} nums=[${byColAsc.join(",")}]`,
  };
}

function extreureAmbLayout(
  matrixRaw: unknown[][],
  matrixText: unknown[][],
  layout: LayoutParse
): { files: FilaCostPersonalExcel[]; textSenseImport: number } {
  const files: FilaCostPersonalExcel[] = [];
  let textSenseImport = 0;
  const maxColScan = Math.max(layout.idxBrut, layout.idxCost, layout.idxSsEmp, layout.idxDesc + 10);

  for (let i = layout.startRow; i < matrixRaw.length; i++) {
    const rawRow = matrixRaw[i] ?? [];
    const textRow = matrixText[i] ?? [];
    const descRaw = cellText(rawRow, textRow, layout.idxDesc);
    const text = descRaw.trim();
    if (!text || esTextCapcaleraOTitol(text)) continue;
    // Cal alguna dada numèrica a la fila (no només títols de grup)
    if (!/[A-Za-zÀ-ú]/.test(text) && !/\d{4,8}/.test(text)) continue;

    let importBrut = cellNum(rawRow, textRow, layout.idxBrut);
    const segSocialEmpresa = cellNum(rawRow, textRow, layout.idxSsEmp);
    const totalSegSocial = cellNum(rawRow, textRow, layout.idxSsTot) || segSocialEmpresa;
    let costPersonal = cellNum(rawRow, textRow, layout.idxCost);

    let sumaFila = 0;
    for (let c = 0; c <= Math.min(rawRow.length - 1, maxColScan); c++) {
      if (c === layout.idxDesc) continue;
      sumaFila += Math.abs(cellNum(rawRow, textRow, c));
    }

    if (sumaFila < 0.05) {
      textSenseImport++;
      continue;
    }

    if (Math.abs(importBrut) < 0.005 && Math.abs(costPersonal) < 0.005) {
      // Omple amb la suma de columnes numèriques de la fila
      importBrut = 0;
      for (let c = layout.idxDesc + 1; c < Math.min(rawRow.length, layout.idxDesc + 12); c++) {
        importBrut += cellNum(rawRow, textRow, c);
      }
      costPersonal = importBrut;
    } else if (layout.idxCost === layout.idxBrut && (importBrut || totalSegSocial)) {
      costPersonal = Math.round((importBrut + totalSegSocial) * 100) / 100;
    } else if (!costPersonal && (importBrut || totalSegSocial)) {
      costPersonal = Math.round((importBrut + totalSegSocial) * 100) / 100;
    }

    const codi = extreureCodiPayroll(text) ?? text.slice(0, 80);
    files.push({
      codi,
      text,
      importBrut,
      segSocialEmpresa,
      totalSegSocial,
      costPersonal: costPersonal || importBrut,
      nivell: nivellIndent(descRaw),
    });
  }

  return { files, textSenseImport };
}

function mostraFiles(matrixText: unknown[][], n = 4, cols = 12): string {
  return matrixText
    .slice(0, n)
    .map((r, i) => {
      const cells = (r ?? [])
        .slice(0, cols)
        .map((c, j) => `c${j}:${String(c ?? "").slice(0, 28)}`)
        .filter((s) => !s.endsWith(":"));
      return `f${i}{${cells.join("; ")}}`;
    })
    .join(" ");
}

function parseMatrixCostPersonal(
  matrixRaw: unknown[][],
  matrixText: unknown[][],
  sheetName: string
): { files: FilaCostPersonalExcel[]; diagnostica: string } {
  const candidats: LayoutParse[] = [];

  const cap = detectarCapçaleraFlexible(matrixText) ?? detectarCapçaleraFlexible(matrixRaw);
  if (cap) {
    candidats.push({
      startRow: cap.row + 1,
      idxDesc: cap.idxDesc,
      idxBrut: cap.idxBrut,
      idxSsEmp: cap.idxSsEmp,
      idxSsTot: cap.idxSsTot,
      idxCost: cap.idxCost,
      origen: `capçalera f${cap.row}`,
    });
  }

  const inferit = inferirLayout(matrixRaw, matrixText);
  if (inferit) candidats.push(inferit);

  if (!candidats.length) {
    return {
      files: [],
      diagnostica: `Full «${sheetName}»: sense layout. ${mostraFiles(matrixText)}`,
    };
  }

  let millor: {
    files: FilaCostPersonalExcel[];
    textSenseImport: number;
    layout: LayoutParse;
  } | null = null;

  for (const layout of candidats) {
    const r = extreureAmbLayout(matrixRaw, matrixText, layout);
    if (!millor || r.files.length > millor.files.length) {
      millor = { ...r, layout };
    }
  }

  const files = millor?.files ?? [];
  const layout = millor?.layout;
  const diag = [
    `Full «${sheetName}»`,
    layout?.origen ?? "?",
    layout
      ? `desc=${layout.idxDesc} brut=${layout.idxBrut} ss=${layout.idxSsEmp} cost=${layout.idxCost}`
      : "",
    `${files.length} files amb import`,
    millor?.textSenseImport ? `${millor.textSenseImport} text sense import` : "",
    files.length === 0 ? mostraFiles(matrixText) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return { files, diagnostica: diag };
}

/** Heurística Sala/Cuina a partir del text (restaurants). */
export function inferDeptSalarialDesDeText(text: string): DepartamentSalarial | null {
  const t = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/\bcuina\b/.test(t) || /\bcocin/.test(t)) return "CUINA";
  if (/\bsala\b/.test(t) || /\bcambrer/.test(t) || /\bserveis?\b/.test(t)) return "SALA";
  return null;
}

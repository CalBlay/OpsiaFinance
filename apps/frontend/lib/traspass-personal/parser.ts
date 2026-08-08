/**
 * Parser de l'Excel d'hores (traspassos).
 *
 * Columnes obligatòries:
 *   Empleado | Organizaciones (origen) | Proyecto (destí) | Minutos
 */

import { type WorkBook, read, utils } from "xlsx";

export type FilaHoresTreball = {
  /** Número de fila a l'Excel (1-based, com el veu l'usuari). */
  filaExcel: number;
  empleado: string;
  organizaciones: string;
  proyecto: string;
  minutos: number;
};

export type ResultatParserHores = {
  files: FilaHoresTreball[];
  capçalera: string[];
};

function normHeader(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function parseMinuts(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function idxExacte(headers: string[], ...noms: string[]): number {
  for (const n of noms) {
    const i = headers.findIndex((h) => h === n);
    if (i >= 0) return i;
  }
  return -1;
}

function idxInclou(headers: string[], fragment: string, excloureId = false): number {
  return headers.findIndex((h) => {
    if (!h.includes(fragment)) return false;
    if (excloureId && /\bid\b/.test(h)) return false;
    return true;
  });
}

function filaCapçalera(matrix: unknown[][]): number {
  let best = 0;
  let score = -1;
  for (let i = 0; i < Math.min(20, matrix.length); i++) {
    const h = (matrix[i] ?? []).map(normHeader);
    const s = [
      h.some((x) => x.includes("empleado")),
      h.some((x) => x.includes("organizacion")),
      h.some((x) => x === "proyecto" || (x.includes("proyecto") && !/\bid\b/.test(x))),
      h.some((x) => x.includes("minuto")),
    ].filter(Boolean).length;
    if (s > score) {
      score = s;
      best = i;
    }
  }
  return best;
}

export function parseExcelHoresTreball(buffer: Buffer): ResultatParserHores {
  const wb: WorkBook = read(buffer);
  const sheet = wb.SheetNames[0];
  if (!sheet) return { files: [], capçalera: [] };

  const matrix = utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], {
    header: 1,
    defval: null,
    raw: false,
  });
  if (!matrix.length) return { files: [], capçalera: [] };

  const headerRow = filaCapçalera(matrix);
  const capçalera = (matrix[headerRow] ?? []).map((c) => String(c ?? "").trim());
  const h = capçalera.map(normHeader);

  const idxEmp =
    idxExacte(h, "empleado") >= 0 ? idxExacte(h, "empleado") : idxInclou(h, "empleado");
  // Preferència: «organizaciones» exacte (no «id de organizacion»).
  let idxOrg = idxExacte(h, "organizaciones", "organizacion");
  if (idxOrg < 0) idxOrg = idxInclou(h, "organizacion", true);
  let idxProy = idxExacte(h, "proyecto");
  if (idxProy < 0) idxProy = idxInclou(h, "proyecto", true);
  let idxMin = idxExacte(h, "minutos", "minuto");
  if (idxMin < 0) idxMin = idxInclou(h, "minuto");

  // Fallback layout clàssic: C / F / G
  if (idxOrg < 0) idxOrg = 2;
  if (idxProy < 0) idxProy = 5;
  if (idxMin < 0) idxMin = 6;

  if (idxOrg < 0 || idxProy < 0 || idxMin < 0) {
    throw new Error("No s'han trobat les columnes Organizaciones, Proyecto i Minutos a l'Excel.");
  }

  const files: FilaHoresTreball[] = [];
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const organizaciones = String(row[idxOrg] ?? "").trim();
    const proyecto = String(row[idxProy] ?? "").trim();
    const minutos = parseMinuts(row[idxMin]);
    if (!organizaciones || !proyecto || minutos <= 0) continue;
    if (/^\d+$/.test(proyecto)) continue; // columna ID per error

    files.push({
      filaExcel: i + 1,
      empleado: idxEmp >= 0 ? String(row[idxEmp] ?? "").trim() : "",
      organizaciones,
      proyecto,
      minutos,
    });
  }

  return { files, capçalera };
}

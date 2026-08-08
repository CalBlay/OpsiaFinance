/**
 * Parser Excel de cost salarial restaurants.
 *
 * Columnes esperades (capçalera flexible, català):
 *   Data | Nom Restaurant | Departament | Total Salari | Incentius mensual |
 *   Incentiu Trimestral | Hores extres | Altres | Baixes | Indemnitzacions | Fora Centre
 *
 * Cada fila = un mes × restaurant × departament (Sala | Cuina).
 */

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

export type DepartamentSalarialCodi = "SALA" | "CUINA";

export interface CostSalarialLiniaParsed {
  any: number;
  mes: number;
  nomRestaurant: string;
  departament: DepartamentSalarialCodi;
  totalSalari: number;
  incentiusMensual: number;
  incentiuTrimestral: number;
  horesExtres: number;
  altres: number;
  baixes: number;
  indemnitzacions: number;
  foraCentre: number;
  filaExcel: number;
}

export interface ParseCostSalarialResult {
  linies: CostSalarialLiniaParsed[];
  errors: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  data: ["data", "date", "mes", "periodo", "periode"],
  restaurant: ["nom restaurant", "restaurant", "nom", "centre", "establecimiento"],
  departament: ["departament", "departamento", "dept"],
  totalSalari: ["total salari", "total salario", "salari", "salario"],
  incentiusMensual: [
    "incentius mensuals",
    "incentius mensual",
    "incentiu mensual",
    "incentivos mensuales",
    "incentivo mensual",
  ],
  incentiuTrimestral: [
    "incentius trimestral",
    "incentiu trimestral",
    "incentivos trimestrales",
    "incentivo trimestral",
  ],
  horesExtres: ["hores extres", "horas extras", "hores extra", "horas extra"],
  altres: ["altres", "otros", "altre"],
  baixes: ["baixes", "bajas"],
  indemnitzacions: ["indemnitzacions", "indemnizaciones", "indemnitzacio"],
  foraCentre: ["fora centre", "fuera centro", "fora de centre", "fuera de centro"],
};

function normalitzaHeader(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function trobaCol(headers: string[], aliases: string[]): number {
  const norms = aliases.map(normalitzaHeader);
  // Preferència: coincidència exacta abans de prefix (evita «nom» vs «nom restaurant»).
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    if (norms.some((a) => h === a)) return i;
  }
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    if (norms.some((a) => a.length >= 4 && h.startsWith(a))) return i;
  }
  return -1;
}

/** Parseja imports europeus: "11.831,00 €", "-", buit → 0. */
export function parseImportExcel(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).replace(/€/g, "").replace(/\s/g, "").replace(/−/g, "-").trim();
  if (!s || s === "-" || s === "–" || s === "—") return 0;
  // Excel ja pot haver convertit a number; si ve com a text europeu:
  const net = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(net);
  return Number.isFinite(n) ? n : 0;
}

function parseDataExcel(raw: unknown): { any: number; mes: number } | null {
  if (raw == null || raw === "") return null;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Serial Excel → Date
    const d = XLSX.SSF.parse_date_code(raw);
    if (d?.y && d?.m) return { any: d.y, mes: d.m };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { any: raw.getFullYear(), mes: raw.getMonth() + 1 };
  }

  const s = String(raw).trim();
  // dd/mm/yyyy o d/m/yyyy
  const m1 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m1) {
    const mes = Number(m1[2]);
    const any = Number(m1[3]);
    if (mes >= 1 && mes <= 12) return { any, mes };
  }
  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m2) {
    const any = Number(m2[1]);
    const mes = Number(m2[2]);
    if (mes >= 1 && mes <= 12) return { any, mes };
  }
  // mm/yyyy o yyyy-mm
  const m3 = s.match(/^(\d{1,2})[\/\-.](\d{4})$/);
  if (m3) {
    const mes = Number(m3[1]);
    const any = Number(m3[2]);
    if (mes >= 1 && mes <= 12) return { any, mes };
  }
  const m4 = s.match(/^(\d{4})[\/\-.](\d{1,2})$/);
  if (m4) {
    const any = Number(m4[1]);
    const mes = Number(m4[2]);
    if (mes >= 1 && mes <= 12) return { any, mes };
  }
  return null;
}

function parseDepartament(raw: unknown): DepartamentSalarialCodi | null {
  const s = String(raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
  if (s === "sala" || s.startsWith("sala")) return "SALA";
  if (s === "cuina" || s === "cocina" || s.startsWith("cuina") || s.startsWith("cocina"))
    return "CUINA";
  return null;
}

/**
 * Amplia `!ref` a totes les cel·les presents al full.
 * Sense això, `sheet_to_json` pot truncar files si el rang declarat és curt.
 */
function matriuDelFull(sheet: XLSX.WorkSheet): (string | number | null)[][] {
  const keys = Object.keys(sheet).filter((k) => !k.startsWith("!"));
  let maxR = 0;
  let maxC = 0;
  for (const k of keys) {
    const cell = XLSX.utils.decode_cell(k);
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c > maxC) maxC = cell.c;
  }
  if (sheet["!ref"]) {
    const ref = XLSX.utils.decode_range(sheet["!ref"]);
    maxR = Math.max(maxR, ref.e.r);
    maxC = Math.max(maxC, ref.e.c);
  }
  if (keys.length === 0 && !sheet["!ref"]) return [];
  sheet["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true,
  });
}

export function parseCostSalarialRestaurantsBuffer(data: Buffer): ParseCostSalarialResult {
  const errors: string[] = [];
  const linies: CostSalarialLiniaParsed[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { cellDates: true, raw: true });
  } catch (err) {
    return { linies: [], errors: [`No s'ha pogut llegir l'Excel: ${String(err)}`] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { linies: [], errors: ["El fitxer no té cap full."] };

  const sheet = workbook.Sheets[sheetName];
  const rows = matriuDelFull(sheet);

  if (rows.length < 2) return { linies: [], errors: ["El full no té files de dades."] };

  const headerRow = (rows[0] ?? []).map((c) => normalitzaHeader(String(c ?? "")));
  const cols = {
    data: trobaCol(headerRow, HEADER_ALIASES.data),
    restaurant: trobaCol(headerRow, HEADER_ALIASES.restaurant),
    departament: trobaCol(headerRow, HEADER_ALIASES.departament),
    totalSalari: trobaCol(headerRow, HEADER_ALIASES.totalSalari),
    incentiusMensual: trobaCol(headerRow, HEADER_ALIASES.incentiusMensual),
    incentiuTrimestral: trobaCol(headerRow, HEADER_ALIASES.incentiuTrimestral),
    horesExtres: trobaCol(headerRow, HEADER_ALIASES.horesExtres),
    altres: trobaCol(headerRow, HEADER_ALIASES.altres),
    baixes: trobaCol(headerRow, HEADER_ALIASES.baixes),
    indemnitzacions: trobaCol(headerRow, HEADER_ALIASES.indemnitzacions),
    foraCentre: trobaCol(headerRow, HEADER_ALIASES.foraCentre),
  };

  if (cols.data < 0) errors.push("Falta la columna Data.");
  if (cols.restaurant < 0) errors.push("Falta la columna Nom Restaurant.");
  if (cols.departament < 0) errors.push("Falta la columna Departament.");
  if (cols.totalSalari < 0) errors.push("Falta la columna Total Salari.");
  if (errors.length) return { linies: [], errors };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;

    const filaExcel = i + 1;
    const periode = parseDataExcel(row[cols.data]);
    if (!periode) {
      errors.push(`Fila ${filaExcel}: data no vàlida («${row[cols.data]}»).`);
      continue;
    }

    const nomRestaurant = String(row[cols.restaurant] ?? "").trim();
    if (!nomRestaurant) {
      errors.push(`Fila ${filaExcel}: falta el nom del restaurant.`);
      continue;
    }

    const departament = parseDepartament(row[cols.departament]);
    if (!departament) {
      errors.push(
        `Fila ${filaExcel}: departament desconegut («${row[cols.departament]}»). Cal Sala o Cuina.`
      );
      continue;
    }

    const cell = (idx: number) => (idx >= 0 ? parseImportExcel(row[idx]) : 0);

    linies.push({
      any: periode.any,
      mes: periode.mes,
      nomRestaurant,
      departament,
      totalSalari: cell(cols.totalSalari),
      incentiusMensual: cell(cols.incentiusMensual),
      incentiuTrimestral: cell(cols.incentiuTrimestral),
      horesExtres: cell(cols.horesExtres),
      altres: cell(cols.altres),
      baixes: cell(cols.baixes),
      indemnitzacions: cell(cols.indemnitzacions),
      foraCentre: cell(cols.foraCentre),
      filaExcel,
    });
  }

  return { linies, errors };
}

export function parseCostSalarialRestaurants(filePath: string): ParseCostSalarialResult {
  try {
    return parseCostSalarialRestaurantsBuffer(readFileSync(filePath));
  } catch (err) {
    return { linies: [], errors: [`No s'ha pogut llegir l'Excel: ${String(err)}`] };
  }
}

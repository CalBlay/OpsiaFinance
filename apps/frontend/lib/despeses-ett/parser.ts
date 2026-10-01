import { readWorkbook } from "@/lib/excel-parsers/read-workbook";
import * as XLSX from "xlsx";

export type FilaEttParsejada = {
  any: number;
  mes: number;
  centreCodi: string;
  liniaNegociCodi: string | null;
  /** Net Cargo − Abono (positiu = despesa). */
  importNet: number;
  filaExcel: number;
};

export type ParseDespesesEttResult = {
  files: FilaEttParsejada[];
  errors: string[];
  avisos: string[];
};

const CENTRE_RE = /^CC[A-Z]\d+$/i;
const LN_RE = /^LN\d+$/i;

function normalitzaCap(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
}

function parseDataExcel(raw: unknown): { any: number; mes: number } | null {
  if (raw == null || raw === "") return null;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d?.y && d?.m) return { any: d.y, mes: d.m };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { any: raw.getFullYear(), mes: raw.getMonth() + 1 };
  }

  const s = String(raw).trim();
  const m1 = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m1) {
    const mes = Number(m1[2]);
    const any = Number(m1[3]);
    if (mes >= 1 && mes <= 12) return { any, mes };
  }
  const m2 = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m2) {
    const any = Number(m2[1]);
    const mes = Number(m2[2]);
    if (mes >= 1 && mes <= 12) return { any, mes };
  }
  return null;
}

function parseImport(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

type ColMap = {
  fecha: number;
  cargo: number;
  abono: number | null;
  centro: number;
  linia: number | null;
};

function trobarCapçaleres(rows: unknown[][]): { headerRow: number; cols: ColMap } | null {
  const maxScan = Math.min(rows.length, 30);
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r] ?? [];
    let fecha = -1;
    let cargo = -1;
    let abono: number | null = null;
    let centro = -1;
    let linia: number | null = null;

    for (let c = 0; c < row.length; c++) {
      const cap = normalitzaCap(String(row[c] ?? ""));
      if (!cap) continue;
      if (
        fecha < 0 &&
        (cap.startsWith("fecha de con") || cap === "fecha" || cap.startsWith("fecha de contabil"))
      ) {
        fecha = c;
      } else if (fecha < 0 && cap.startsWith("fecha") && !cap.includes("ven")) {
        // Primer «Fecha…» que no sigui venciment
        fecha = c;
      }
      if (cargo < 0 && (cap.startsWith("cargo") || cap === "cargo (ml)")) cargo = c;
      if (abono == null && (cap.startsWith("abono") || cap === "abono (ml)")) abono = c;
      if (centro < 0 && (cap === "centro" || cap.startsWith("centro de") || cap === "centre")) {
        centro = c;
      }
      if (
        linia == null &&
        (cap.startsWith("linea de neg") || cap.startsWith("linia de neg") || cap === "ln")
      ) {
        linia = c;
      }
    }

    if (fecha >= 0 && cargo >= 0 && centro >= 0) {
      return { headerRow: r, cols: { fecha, cargo, abono, centro, linia } };
    }
  }
  return null;
}

/**
 * Parseja l'Excel d'apunts ETT (compte 629006).
 * Agrega després el servei; aquí retorna una fila per apunt amb import net.
 */
export function parseDespesesEtt(buffer: Buffer): ParseDespesesEttResult {
  const errors: string[] = [];
  const avisos: string[] = [];
  const files: FilaEttParsejada[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = readWorkbook(buffer);
  } catch (e) {
    return {
      files: [],
      errors: [`No s'ha pogut llegir l'Excel: ${e instanceof Error ? e.message : String(e)}`],
      avisos: [],
    };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { files: [], errors: ["El fitxer no té fulls."], avisos: [] };
  }

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null | undefined)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  const cap = trobarCapçaleres(rows);
  if (!cap) {
    return {
      files: [],
      errors: [
        "No s'han trobat les columnes necessàries (Fecha, Cargo, Centro). Revisa el format del fitxer ETT.",
      ],
      avisos: [],
    };
  }

  let filesSenseCentre = 0;
  let filesSenseData = 0;
  let filesZero = 0;

  for (let i = cap.headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const filaExcel = i + 1;

    const centreRaw = String(row[cap.cols.centro] ?? "")
      .trim()
      .toUpperCase();
    if (!centreRaw || !CENTRE_RE.test(centreRaw)) {
      // Files de títol compte / buides
      if (centreRaw) filesSenseCentre++;
      continue;
    }

    const periode = parseDataExcel(row[cap.cols.fecha]);
    if (!periode) {
      filesSenseData++;
      continue;
    }

    const cargo = parseImport(row[cap.cols.cargo]);
    const abono = cap.cols.abono != null ? parseImport(row[cap.cols.abono]) : 0;
    const importNet = cargo - abono;
    if (importNet === 0) {
      filesZero++;
      continue;
    }

    let liniaNegociCodi: string | null = null;
    if (cap.cols.linia != null) {
      const lnRaw = String(row[cap.cols.linia] ?? "")
        .trim()
        .toUpperCase();
      if (LN_RE.test(lnRaw)) liniaNegociCodi = lnRaw;
    }

    files.push({
      any: periode.any,
      mes: periode.mes,
      centreCodi: centreRaw,
      liniaNegociCodi,
      importNet,
      filaExcel,
    });
  }

  if (filesSenseData > 0) {
    avisos.push(
      `${filesSenseData} files amb centre però sense data vàlida a la columna A (ignorades).`
    );
  }
  if (filesSenseCentre > 0) {
    avisos.push(`${filesSenseCentre} files amb text a Centro no reconegut (ignorades).`);
  }
  if (filesZero > 0) {
    avisos.push(`${filesZero} files amb Cargo−Abono = 0 (ignorades).`);
  }
  if (files.length === 0 && errors.length === 0) {
    errors.push("No s'ha trobat cap apunt ETT vàlid (cal Fecha, Centro i Cargo).");
  }

  return { files, errors, avisos };
}

/** Agrega per període × centre (suma d'imports nets). */
export function agregarPerCentrePeriode(
  files: FilaEttParsejada[]
): Map<
  string,
  {
    any: number;
    mes: number;
    centreCodi: string;
    liniaNegociCodi: string | null;
    total: number;
    files: number;
  }
> {
  const map = new Map<
    string,
    {
      any: number;
      mes: number;
      centreCodi: string;
      liniaNegociCodi: string | null;
      total: number;
      files: number;
    }
  >();

  for (const f of files) {
    const key = `${f.any}-${String(f.mes).padStart(2, "0")}::${f.centreCodi}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        any: f.any,
        mes: f.mes,
        centreCodi: f.centreCodi,
        liniaNegociCodi: f.liniaNegociCodi,
        total: f.importNet,
        files: 1,
      });
    } else {
      cur.total += f.importNet;
      cur.files += 1;
      // Conserva LN si encara no n'hi ha; si divergen, deixa la primera
      if (!cur.liniaNegociCodi && f.liniaNegociCodi) cur.liniaNegociCodi = f.liniaNegociCodi;
    }
  }

  return map;
}

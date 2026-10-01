import { readWorkbook } from "@/lib/excel-parsers/read-workbook";
import * as XLSX from "xlsx";

export type FilaJornadaParsejada = {
  codi: string;
  /** Text columna A (p.ex. «SALA», «CUINA», «MARKETING»…). */
  descripcio: string;
  horesSetmanals: number;
  filaExcel: number;
};

export type ParseJornadaResult = {
  files: FilaJornadaParsejada[];
  errors: string[];
  avisos: string[];
};

const HORES_JORNADA_COMPLETA = 40;

function normalitzaCap(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
}

function parseNumero(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * % jornada → hores setmanals.
 * En blanc = 100% = 40 h. Si el valor és ≤ 1, es tracta com a fracció (0,5 = 50%).
 */
export function horesDesDePercentatge(raw: unknown): number {
  const pct = parseNumero(raw);
  if (pct == null) return HORES_JORNADA_COMPLETA;
  const base = pct > 0 && pct <= 1 ? pct * 100 : pct;
  return Math.round((base / 100) * HORES_JORNADA_COMPLETA * 10) / 10;
}

function trobarCapçaleres(rows: unknown[][]): {
  headerRow: number;
  colDesc: number;
  colPct: number;
  colCodi: number;
} | null {
  const maxScan = Math.min(rows.length, 40);
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r] ?? [];
    let colDesc = -1;
    let colPct = -1;
    let colCodi = -1;
    for (let c = 0; c < row.length; c++) {
      const cap = normalitzaCap(String(row[c] ?? ""));
      if (!cap) continue;
      if (
        colDesc < 0 &&
        (cap.includes("descripcion") ||
          cap.includes("descripcio") ||
          cap === "desc" ||
          cap === "text")
      ) {
        colDesc = c;
      }
      if (
        colPct < 0 &&
        (cap.includes("porcentaje") ||
          cap.includes("percentatge") ||
          cap.includes("jornada") ||
          cap === "%")
      ) {
        colPct = c;
      }
      if (
        colCodi < 0 &&
        (cap.includes("codigo imputacion") ||
          cap.includes("codi imputacio") ||
          (cap.includes("codigo") && cap.includes("imput")) ||
          (cap.includes("codi") && cap.includes("imput")))
      ) {
        colCodi = c;
      }
    }
    if (colPct >= 0 && colCodi >= 0) {
      return {
        headerRow: r,
        colDesc: colDesc >= 0 ? colDesc : 0,
        colPct,
        colCodi,
      };
    }
    const a0 = normalitzaCap(String(row[0] ?? ""));
    const a1 = normalitzaCap(String(row[1] ?? ""));
    const a2 = normalitzaCap(String(row[2] ?? ""));
    if (
      (a0.includes("descripcion") || a0.includes("descripcio") || a0 === "") &&
      (a1.includes("porcentaje") || a1.includes("jornada") || a1.includes("percent")) &&
      (a2.includes("codigo") || a2.includes("codi"))
    ) {
      return { headerRow: r, colDesc: 0, colPct: 1, colCodi: 2 };
    }
  }
  if (rows.length > 1) {
    return { headerRow: 0, colDesc: 0, colPct: 1, colCodi: 2 };
  }
  return null;
}

/**
 * Parseja l'Excel de resum nòmina:
 * A = descripció (departament / etiquetatge), B = % jornada, C = codi imputació.
 */
export function parseJornadaPersonal(buffer: Buffer): ParseJornadaResult {
  const errors: string[] = [];
  const avisos: string[] = [];
  const files: FilaJornadaParsejada[] = [];

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
  if (!sheetName) return { files: [], errors: ["El fitxer no té fulls."], avisos: [] };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  const cap = trobarCapçaleres(rows);
  if (!cap) {
    return {
      files: [],
      errors: ["No s'han trobat les columnes A (descripció), B (% jornada) i C (codi)."],
      avisos: [],
    };
  }

  let senseCodi = 0;
  let senseDesc = 0;
  for (let i = cap.headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const filaExcel = i + 1;
    const descripcio = String(row[cap.colDesc] ?? "").trim();
    const codiRaw = String(row[cap.colCodi] ?? "")
      .trim()
      .replace(/\s/g, "");
    const digits = codiRaw.replace(/\D/g, "");
    if (!digits) {
      const buit =
        (row[cap.colPct] == null || row[cap.colPct] === "") &&
        (row[cap.colCodi] == null || row[cap.colCodi] === "") &&
        !descripcio;
      if (!buit) senseCodi++;
      continue;
    }
    let codi = /^\d+$/.test(codiRaw) ? codiRaw : digits;
    if (typeof row[cap.colCodi] === "number") {
      const n = String(Math.trunc(row[cap.colCodi] as number));
      codi = n.length <= 8 ? n.padStart(Math.max(n.length, 5), "0") : n;
      if (n.length <= 7) codi = n.padStart(8, "0");
    }

    if (!/^\d{4,8}$/.test(codi)) {
      senseCodi++;
      continue;
    }

    if (!descripcio) senseDesc++;

    files.push({
      codi,
      descripcio,
      horesSetmanals: horesDesDePercentatge(row[cap.colPct]),
      filaExcel,
    });
  }

  if (senseCodi > 0) {
    avisos.push(`${senseCodi} files sense codi d'imputació vàlid (ignorades).`);
  }
  if (senseDesc > 0) {
    avisos.push(
      `${senseDesc} files sense text a la columna A (departament més difícil de resoldre).`
    );
  }
  if (!files.length) {
    errors.push("No s'ha trobat cap fila amb codi d'imputació (columna C).");
  }

  return { files, errors, avisos };
}

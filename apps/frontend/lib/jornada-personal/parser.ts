import { readWorkbook } from "@/lib/excel-parsers/read-workbook";
import * as XLSX from "xlsx";

export type FilaJornadaParsejada = {
  codi: string;
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

/** % jornada → hores setmanals. En blanc = 100% = 40 h. */
export function horesDesDePercentatge(raw: unknown): number {
  const pct = parseNumero(raw);
  if (pct == null) return HORES_JORNADA_COMPLETA;
  return (pct / 100) * HORES_JORNADA_COMPLETA;
}

function trobarCapçaleres(rows: unknown[][]): {
  headerRow: number;
  colPct: number;
  colCodi: number;
} | null {
  const maxScan = Math.min(rows.length, 40);
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r] ?? [];
    let colPct = -1;
    let colCodi = -1;
    for (let c = 0; c < row.length; c++) {
      const cap = normalitzaCap(String(row[c] ?? ""));
      if (!cap) continue;
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
    // Fallback posicional: B=% , C=codi (si els headers són parcials)
    if (colCodi < 0 && colPct >= 0 && row.length > colPct + 1) {
      // no forcem
    }
    if (colPct >= 0 && colCodi >= 0) {
      return { headerRow: r, colPct, colCodi };
    }
    // Capçaleres típiques A/B/C amb noms parcials: si veiem «Descripcion» a A
    const a0 = normalitzaCap(String(row[0] ?? ""));
    const a1 = normalitzaCap(String(row[1] ?? ""));
    const a2 = normalitzaCap(String(row[2] ?? ""));
    if (
      (a0.includes("descripcion") || a0.includes("descripcio")) &&
      (a1.includes("porcentaje") || a1.includes("jornada") || a1.includes("percent")) &&
      (a2.includes("codigo") || a2.includes("codi"))
    ) {
      return { headerRow: r, colPct: 1, colCodi: 2 };
    }
  }
  return null;
}

/**
 * Parseja l'Excel de resum nòmina per codi imputació i jornada.
 * Només usa B (% jornada) i C (codi). A s'ignora.
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
      errors: ["No s'han trobat les columnes «Porcentaje Jornada» (B) i «Código Imputación» (C)."],
      avisos: [],
    };
  }

  let senseCodi = 0;
  for (let i = cap.headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const filaExcel = i + 1;
    const codiRaw = String(row[cap.colCodi] ?? "")
      .trim()
      .replace(/\s/g, "");
    // Excel pot perdre zeros a l'esquerra → normalitza a dígits
    const digits = codiRaw.replace(/\D/g, "");
    if (!digits) {
      // fila buida
      const buit =
        (row[cap.colPct] == null || row[cap.colPct] === "") &&
        (row[cap.colCodi] == null || row[cap.colCodi] === "");
      if (!buit) senseCodi++;
      continue;
    }
    // Conserva zeros a l'esquerra si el text els tenia; si ve com a número, pad a 8 si sembla fulla
    let codi = /^\d+$/.test(codiRaw) ? codiRaw : digits;
    if (typeof row[cap.colCodi] === "number") {
      // 6002001 → sovint era 06002001
      const n = String(Math.trunc(row[cap.colCodi] as number));
      codi = n.length <= 8 ? n.padStart(Math.max(n.length, 5), "0") : n;
      // Preferència 8 dígits si cal
      if (n.length <= 7) codi = n.padStart(8, "0");
    }

    if (!/^\d{4,8}$/.test(codi)) {
      senseCodi++;
      continue;
    }

    files.push({
      codi,
      horesSetmanals: horesDesDePercentatge(row[cap.colPct]),
      filaExcel,
    });
  }

  if (senseCodi > 0) {
    avisos.push(`${senseCodi} files sense codi d'imputació vàlid (ignorades).`);
  }
  if (!files.length) {
    errors.push("No s'ha trobat cap fila amb codi d'imputació (columna C).");
  }

  return { files, errors, avisos };
}

/**
 * Parser del balanç d'esdeveniments (Excel/CSV).
 *
 * - A2 = nom del centre (text a mapear)
 * - A4 = FECHA dd/mm/yyyy AL … → any
 * - Bloc Descr_* / Gener…Desembre a partir de ~fila 49
 * - Només línies de detall → fets per mes
 */

import {
  mapEtiquetaEsdevenimentsANode,
  normalitzarImportEsdeveniments,
} from "@/lib/balanc-esdeveniments/nodes";
import { type ExcelSource, readWorkbook } from "@/lib/excel-parsers/read-workbook";
import * as XLSX from "xlsx";

export interface EsdevenimentsFet {
  node: number;
  mes: number;
  valor: number;
  etiqueta: string;
}

export interface ParseBalancEsdevenimentsResult {
  centreText: string | null;
  anyDetectat: number | null;
  titolBloc: string | null;
  fets: EsdevenimentsFet[];
  mesosDetectats: number[];
  errors: string[];
  avisos: string[];
  etiquetesNoMapades: string[];
}

const MES_HEADER: Record<string, number> = {
  enero: 1,
  gener: 1,
  febrero: 2,
  febrer: 2,
  marzo: 3,
  març: 3,
  marc: 3,
  abril: 4,
  mayo: 5,
  maig: 5,
  junio: 6,
  juny: 6,
  julio: 7,
  juliol: 7,
  agosto: 8,
  agost: 8,
  septiembre: 9,
  setembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  novembre: 11,
  diciembre: 12,
  desembre: 12,
};

function parseImportCel(val: unknown): number | null {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (val === null || val === undefined || val === "") return null;

  let s = String(val)
    .trim()
    .replace(/[€$\s]/g, "");
  if (!s || s === "-" || s === "—" || s.startsWith("#")) return null;

  if (/^\(\d/.test(s)) {
    s = `-${s.replace(/[()]/g, "")}`;
  }

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  }

  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function mesDesDeCapcalera(text: string): number | null {
  const norm = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  if (MES_HEADER[norm] !== undefined) return MES_HEADER[norm];
  for (const [key, mes] of Object.entries(MES_HEADER)) {
    if (norm.startsWith(key)) return mes;
  }
  return null;
}

function anyDesDeFecha(text: string): number | null {
  const m = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})/);
  if (m) return Number(m[3]);
  const y = text.match(/(20\d{2})/);
  return y ? Number(y[1]) : null;
}

function anyDesDeTitol(text: string): number | null {
  const m = text.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

interface CapcaleraHistoric {
  rowIdx: number;
  titol: string | null;
  columnesMes: { col: number; mes: number }[];
}

function detectarCapcaleres(matrix: (string | number | null)[][]): CapcaleraHistoric[] {
  const caps: CapcaleraHistoric[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const columnesMes: { col: number; mes: number }[] = [];
    for (let c = 1; c < row.length; c++) {
      const cell = row[c];
      if (cell === null || cell === undefined || String(cell).trim() === "") continue;
      const mes = mesDesDeCapcalera(String(cell));
      if (mes !== null) columnesMes.push({ col: c, mes });
    }
    if (columnesMes.length >= 6) {
      const a0 = row[0];
      const titol =
        a0 !== null && a0 !== undefined && String(a0).trim() !== "" ? String(a0).trim() : null;
      caps.push({ rowIdx: i, titol, columnesMes });
    }
  }
  return caps;
}

function triarCapcalera(caps: CapcaleraHistoric[]): CapcaleraHistoric | null {
  if (caps.length === 0) return null;
  const desDe49 = caps.filter((c) => c.rowIdx >= 48);
  if (desDe49.length > 0) {
    const descr = desDe49.find((c) => /descr_/i.test(c.titol ?? ""));
    return descr ?? desDe49[0] ?? null;
  }
  return caps[caps.length - 1] ?? null;
}

function cellText(matrix: (string | number | null)[][], row: number, col: number): string | null {
  const v = matrix[row]?.[col];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function readMatrix(source: ExcelSource): {
  matrix: (string | number | null)[][];
  avisos: string[];
  error?: string;
} {
  const avisos: string[] = [];
  let workbook: XLSX.WorkBook;
  try {
    workbook = readWorkbook(source);
  } catch (err) {
    return { matrix: [], avisos, error: `No s'ha pogut llegir el fitxer: ${err}` };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { matrix: [], avisos, error: "El fitxer no té cap full." };

  if (workbook.SheetNames.length > 1) {
    avisos.push(`Només s'ha llegit «${sheetName}» (primer full); la resta s'ignora.`);
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  return { matrix, avisos };
}

export function parseBalancEsdeveniments(
  source: ExcelSource,
  anyFallback: number | null = null
): ParseBalancEsdevenimentsResult {
  const errors: string[] = [];
  const avisos: string[] = [];
  const etiquetesNoMapades: string[] = [];
  const fets: EsdevenimentsFet[] = [];
  const mesosAmbDades = new Set<number>();

  const { matrix, avisos: avisosWb, error } = readMatrix(source);
  avisos.push(...avisosWb);
  if (error) {
    return {
      centreText: null,
      anyDetectat: null,
      titolBloc: null,
      fets: [],
      mesosDetectats: [],
      errors: [error],
      avisos,
      etiquetesNoMapades: [],
    };
  }

  const centreText = cellText(matrix, 1, 0);
  const fechaText = cellText(matrix, 3, 0) ?? "";
  const anyDesFecha = anyDesDeFecha(fechaText);

  const cap = triarCapcalera(detectarCapcaleres(matrix));
  if (!cap) {
    return {
      centreText,
      anyDetectat: anyDesFecha ?? anyFallback,
      titolBloc: null,
      fets: [],
      mesosDetectats: [],
      errors: [
        "No s'ha trobat la capçalera mensual (Gener…Desembre). Cal el bloc a partir de la fila 49.",
      ],
      avisos,
      etiquetesNoMapades: [],
    };
  }

  if (cap.rowIdx < 48) {
    avisos.push(
      `Capçalera detectada a la fila ${cap.rowIdx + 1} (s'esperava ≥ 49). S'ha usat aquest bloc.`
    );
  }

  const anyDetectat = anyDesFecha ?? anyDesDeTitol(cap.titol ?? "") ?? anyFallback;
  const titolBloc = cap.titol;

  for (let r = cap.rowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const rawEtiqueta = row[0];
    if (rawEtiqueta === null || rawEtiqueta === undefined || String(rawEtiqueta).trim() === "") {
      continue;
    }
    const etiqueta = String(rawEtiqueta).trim();

    let mesosEnFila = 0;
    for (let c = 1; c < row.length; c++) {
      if (row[c] !== null && mesDesDeCapcalera(String(row[c])) !== null) mesosEnFila++;
    }
    if (mesosEnFila >= 6) break;

    const node = mapEtiquetaEsdevenimentsANode(etiqueta);
    if (node === null) {
      const norm = etiqueta.toUpperCase();
      if (
        !/TOTAL|MARGE|RESULTAT|EBITDA|COST SALARIAL TOTAL|DESCR_/i.test(norm) &&
        !etiquetesNoMapades.includes(etiqueta)
      ) {
        etiquetesNoMapades.push(etiqueta);
      }
      continue;
    }

    for (const { col, mes } of cap.columnesMes) {
      const raw = parseImportCel(row[col]);
      if (raw === null) continue;
      const valor = normalitzarImportEsdeveniments(node, raw);
      if (valor === 0) continue;
      fets.push({ node, mes, valor, etiqueta });
      mesosAmbDades.add(mes);
    }
  }

  if (!centreText) {
    errors.push("No s'ha trobat el nom del centre a la fila 2 (columna A).");
  }
  if (fets.length === 0) {
    errors.push("No s'han trobat imports de detall al bloc del C.Explotació.");
  }

  return {
    centreText,
    anyDetectat,
    titolBloc,
    fets,
    mesosDetectats: [...mesosAmbDades].sort((a, b) => a - b),
    errors,
    avisos,
    etiquetesNoMapades,
  };
}

/**
 * Parser per al format "PyG Mensual per Centres" (Restaurants_26.xlsx)
 *
 * Estructura de l'Excel:
 * - Cada full = un centre (Nautic, Masia, Camp Nou, etc.)
 * - Fila 1: [Nom centre, Gener, Febrer, ..., Desembre, TOTAL, %]
 * - Fila 2: capçalera buida (zeros)
 * - Files 3+: comptes del P&L
 *   · Comencen amb "." → compte de detall
 *   · Sense punt inicial → subtotal / total
 * - Columnes B-M (índex 1-12) → valors mensuals Gener-Desembre
 *
 * Fulls a saltar: "REST" (consolidació total)
 */

import * as XLSX from "xlsx";
import { type ExcelSource, readWorkbook } from "./read-workbook";

/** Fulls que són consolidacions i s'han de saltar */
const SKIP_SHEETS = new Set(["REST"]);

/** Mesos: índex de columna (1-based des de la col A=0) → número de mes */
const COL_TO_MES: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
};

export interface ParsedRow {
  centreNom: string; // Nom complet del centre (cel·la A1 del full)
  sheetName: string; // Nom del full (codi breu del centre)
  nomCompte: string; // Nom del compte tal com apareix a l'Excel
  esSubtotal: boolean; // true si és fila de total/subtotal (sense punt inicial)
  mes: number; // 1-12
  import_: number; // Valor numèric (negatiu si és despesa)
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

export function parsePygMensualCentres(source: ExcelSource, _anyExcel: number): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = readWorkbook(source);
  } catch (err) {
    return { rows: [], errors: [`No s'ha pogut llegir el fitxer: ${err}`] };
  }

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.has(sheetName)) continue;

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
    });

    if (matrix.length < 3) continue;

    // Fila 1 (índex 0): nom del centre a la primera cel·la
    const centreNom = String(matrix[0]?.[0] ?? sheetName).trim();

    // Comprova que la capçalera de mesos sigui correcta (opcional)
    // matrix[0][1..12] hauria de ser Gener, Febrer...

    // Recorre files de dades (des de la fila 3, índex 2)
    for (let rowIdx = 2; rowIdx < matrix.length; rowIdx++) {
      const row = matrix[rowIdx];
      const nomCompte = String(row?.[0] ?? "").trim();

      if (!nomCompte) continue; // fila buida

      const esSubtotal = !nomCompte.startsWith(".");

      // Per a cada mes
      for (const [colStr, mes] of Object.entries(COL_TO_MES)) {
        const colIdx = Number.parseInt(colStr, 10);
        const rawVal = row?.[colIdx];

        if (rawVal === null || rawVal === undefined || rawVal === "") continue;
        const valor = typeof rawVal === "number" ? rawVal : Number.parseFloat(String(rawVal));
        if (Number.isNaN(valor) || valor === 0) continue;

        rows.push({
          centreNom,
          sheetName,
          nomCompte,
          esSubtotal,
          mes,
          import_: valor,
        });
      }
    }
  }

  return { rows, errors };
}

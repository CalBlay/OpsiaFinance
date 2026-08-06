import type { DepartamentSalarial } from "@prisma/client";
import { type WorkBook, read, utils } from "xlsx";
import { inferDepartamentSalarial, parseDepartamentSalarialLabel } from "./departament";

export interface FilaMapeigExcel {
  text: string;
  codiCentre: string;
  nomCentre: string;
  /** Si ve de columna D o s'ha pogut inferir del text. */
  departament: DepartamentSalarial | null;
}

export interface ResultatImportMapeig {
  files: FilaMapeigExcel[];
}

function cell(row: unknown[], i: number): string {
  const v = row[i];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Detecta si una fila sembla capçalera. */
function esCapçalera(row: unknown[]): boolean {
  const a = cell(row, 0).toLowerCase();
  const b = cell(row, 1).toLowerCase();
  return (
    a.includes("organiz") ||
    a.includes("text") ||
    a.includes("descrip") ||
    b.includes("codi") ||
    b.includes("ccr") ||
    b.includes("centre")
  );
}

/**
 * Llegeix l'excel de mapeig:
 *   A = text, B = codi centre, C = nom centre (opcional),
 *   D = departament SALA|CUINA (opcional; si falta s'infereix del text).
 */
export function parseExcelMapeigCentres(buffer: Buffer): ResultatImportMapeig {
  const wb: WorkBook = read(buffer);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { files: [] };

  const matrix = utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: false,
  });

  const files: FilaMapeigExcel[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const text = cell(row, 0);
    const codiCentre = cell(row, 1).toUpperCase();
    const nomCentre = cell(row, 2);
    if (!text || !codiCentre) continue;
    if (i === 0 && esCapçalera(row)) continue;
    if (!/^CC[A-Z]\d{5}$/i.test(codiCentre) && !/^LN\d{5}$/i.test(codiCentre)) continue;

    const deptCol = parseDepartamentSalarialLabel(cell(row, 3));
    const departament = deptCol ?? inferDepartamentSalarial(text);

    files.push({ text, codiCentre, nomCentre, departament });
  }

  return { files };
}

/**
 * Import Excel de mapeig plantilla RRHH.
 *
 * Columnes:
 *   A = text organització (tal com al fitxer RRHH; | / || s'ignoren)
 *   B = codi centre (CCR… / CCC…)
 *   C = nom centre (opcional, desambiguar)
 *   D = codi departament DRO…/DCC… (opcional)
 */

import { type WorkBook, read, utils } from "xlsx";
import { normalitzarTextOrgPlantilla } from "./mapeig";

export type FilaMapeigOrgPlantillaExcel = {
  text: string;
  codiCentre: string;
  nomCentre: string;
  codiDepartament: string | null;
};

function cell(row: unknown[], i: number): string {
  const v = row[i];
  if (v == null) return "";
  return String(v).trim();
}

function esCapçalera(row: unknown[]): boolean {
  const a = cell(row, 0).toLowerCase();
  const b = cell(row, 1).toLowerCase();
  return (
    a.includes("organiz") ||
    a.includes("text") ||
    a.includes("descrip") ||
    a.includes("plantilla") ||
    b.includes("codi") ||
    b.includes("ccr") ||
    b.includes("centre")
  );
}

function parseCodiDepartament(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (/^D[A-Z]{2}\d{3,}$/.test(t)) return t;
  return null;
}

export function parseExcelMapeigOrgPlantilla(buffer: Buffer): {
  files: FilaMapeigOrgPlantillaExcel[];
} {
  const wb: WorkBook = read(buffer);
  const name = wb.SheetNames[0];
  if (!name) return { files: [] };

  const matrix = utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
    header: 1,
    defval: null,
    raw: false,
  });

  const files: FilaMapeigOrgPlantillaExcel[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (i === 0 && esCapçalera(row)) continue;

    const text = normalitzarTextOrgPlantilla(cell(row, 0));
    const codiCentre = cell(row, 1).toUpperCase();
    const nomCentre = cell(row, 2);
    if (!text || !codiCentre) continue;
    if (!/^CC[A-Z]\d{5}$/i.test(codiCentre)) continue;

    const colD = cell(row, 3);
    files.push({
      text,
      codiCentre,
      nomCentre,
      codiDepartament: parseCodiDepartament(colD) ?? parseCodiDepartament(cell(row, 4)),
    });
  }

  return { files };
}

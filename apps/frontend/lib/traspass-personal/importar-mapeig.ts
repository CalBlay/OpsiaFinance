/**
 * Import de l'Excel de mapeig (Configuració → Traspassos personal).
 *
 * Columnes:
 *   A = text (tal com surt a Organizaciones / Proyecto)
 *   B = codi centre (CCR… / CCC…)
 *   C = nom centre (opcional, desambiguar)
 *   D = SALA | CUINA (opcional; si falta s'infereix del text)
 */

import type { DepartamentSalarial } from "@prisma/client";
import { type WorkBook, read, utils } from "xlsx";
import { inferDepartamentSalarial, parseDepartamentSalarialLabel } from "./departament";

export type FilaMapeigExcel = {
  text: string;
  codiCentre: string;
  nomCentre: string;
  departament: DepartamentSalarial | null;
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
    b.includes("codi") ||
    b.includes("ccr") ||
    b.includes("centre")
  );
}

export function parseExcelMapeigCentres(buffer: Buffer): { files: FilaMapeigExcel[] } {
  const wb: WorkBook = read(buffer);
  const name = wb.SheetNames[0];
  if (!name) return { files: [] };

  const matrix = utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
    header: 1,
    defval: null,
    raw: false,
  });

  const files: FilaMapeigExcel[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (i === 0 && esCapçalera(row)) continue;

    const text = cell(row, 0);
    const codiCentre = cell(row, 1).toUpperCase();
    const nomCentre = cell(row, 2);
    if (!text || !codiCentre) continue;
    if (!/^CC[A-Z]\d{5}$/i.test(codiCentre) && !/^LN\d{5}$/i.test(codiCentre)) continue;

    const deptCol = parseDepartamentSalarialLabel(cell(row, 3));
    files.push({
      text,
      codiCentre,
      nomCentre,
      departament: deptCol ?? inferDepartamentSalarial(text),
    });
  }

  return { files };
}

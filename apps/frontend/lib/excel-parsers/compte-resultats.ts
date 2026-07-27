/**
 * Parser per al compte de resultats en format matriu (p.ex. 01_2026.xlsx).
 *
 * Estructura de l'Excel (un sol full, un sol període — el mes/any ve del nom del fitxer):
 * - Fila 1 (capçalera):
 *     A = "#"  |  B = "Node"  |  C = "Description"  |  D = "TOTAL"
 *     E, F, G… = codis de columna (Centre "CCR00001" o LN "LN00001") · última "Sin Centro"
 * - Files 2+ (dades):
 *     A = # correlatiu · B = Node (id estable de SAP) · C = Descripció del concepte
 *     D = total de la fila · E, F… = valor per cada centre/LN
 *
 * Distinció detall vs subtotal:
 * - La descripció que comença amb "." (p.ex. ".   VENDES") és una línia de DETALL.
 * - Sense punt inicial (p.ex. "TOTAL INGRESSOS EXPLOT", "EBITDA") és un TOTAL/SUBTOTAL.
 */

import { readFileSync } from "fs";
import * as XLSX from "xlsx";

/** Concepte del compte de resultats (una línia de l'estructura del P&L). */
export interface ConcepteParsed {
  node: number; // identificador estable (columna B)
  descripcio: string; // net, sense el prefix ".   "
  esSubtotal: boolean; // true si és total/subtotal (sense punt inicial)
  ordre: number; // posició dins el compte (per mantenir l'ordre original)
}

/** Columna de dimensió (capçalera de la E cap a la dreta). */
export interface ColumnaParsed {
  codi: string | null; // codi del centre o LN ("CCR00001") · null si "Sin Centro"
  senseCentre: boolean; // true per la columna "Sin Centro"
  colIdx: number; // índex de columna a l'Excel
}

/** Fet: valor d'un concepte per una columna (centre/LN). */
export interface FetParsed {
  node: number; // → ConcepteParsed.node
  colIdx: number; // → ColumnaParsed.colIdx
  valor: number; // import (negatiu = despesa)
}

export interface ParseResultatsResult {
  concepts: ConcepteParsed[];
  columnes: ColumnaParsed[];
  fets: FetParsed[];
  errors: string[];
}

const IDX_NODE = 1; // columna B
const IDX_DESC = 2; // columna C
const IDX_FIRST_DIM = 4; // columna E (primera columna de centre/LN)

/** Detecta la columna "Sin Centro" (variants d'accent/espais). */
function esSinCentro(header: string): boolean {
  const h = header.toLowerCase().replace(/\s+/g, " ").trim();
  return h.startsWith("sin cent") || h.startsWith("sense centre");
}

/**
 * Tria el full a processar. SAP exporta el compte de resultats a la pestanya
 * "sheet"; si el fitxer en té d'altres (resums, gràfics…), s'ignoren.
 * Ordre de preferència: full anomenat exactament "sheet" → que comenci per
 * "sheet"/"hoja"/"full" → el primer full del llibre.
 */
function triaNomFull(noms: string[]): string | null {
  const norm = (s: string) => s.trim().toLowerCase();
  const exacte = noms.find((n) => norm(n) === "sheet");
  if (exacte) return exacte;
  const prefix = noms.find((n) => /^(sheet|hoja|full|hoja1|sheet1)/.test(norm(n)));
  if (prefix) return prefix;
  return noms[0] ?? null;
}

export function parseCompteResultats(filePath: string): ParseResultatsResult {
  const errors: string[] = [];

  let workbook;
  try {
    workbook = XLSX.read(readFileSync(filePath));
  } catch (err) {
    return {
      concepts: [],
      columnes: [],
      fets: [],
      errors: [`No s'ha pogut llegir el fitxer: ${err}`],
    };
  }

  const sheetName = triaNomFull(workbook.SheetNames);
  if (!sheetName)
    return { concepts: [], columnes: [], fets: [], errors: ["El fitxer no té cap full."] };

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  if (matrix.length < 2) {
    return { concepts: [], columnes: [], fets: [], errors: ["El full no té dades suficients."] };
  }

  // ─── Capçalera: mapeja columnes de dimensió (E cap a la dreta) ───────────────
  const header = matrix[0] ?? [];
  const columnes: ColumnaParsed[] = [];
  for (let j = IDX_FIRST_DIM; j < header.length; j++) {
    const raw = header[j];
    if (raw === null || raw === undefined || String(raw).trim() === "") continue;
    const text = String(raw).trim();
    if (esSinCentro(text)) {
      columnes.push({ codi: null, senseCentre: true, colIdx: j });
    } else {
      columnes.push({ codi: text, senseCentre: false, colIdx: j });
    }
  }

  if (columnes.length === 0)
    errors.push("No s'ha detectat cap columna de centre/LN a la capçalera.");

  // ─── Files de dades: conceptes + fets ────────────────────────────────────────
  const concepts: ConcepteParsed[] = [];
  const fets: FetParsed[] = [];
  const nodesVistos = new Set<number>();

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;

    const nodeRaw = row[IDX_NODE];
    const descRaw = row[IDX_DESC];
    if (nodeRaw === null || nodeRaw === undefined || descRaw === null || descRaw === undefined)
      continue;

    const node = typeof nodeRaw === "number" ? nodeRaw : Number.parseInt(String(nodeRaw), 10);
    if (Number.isNaN(node)) continue;

    const descOriginal = String(descRaw).trim();
    if (!descOriginal) continue;

    const descripcio = descOriginal.replace(/^\.\s*/, "").trim();
    /** SAP exporta algunes línies de detall sense "." (p.ex. MOVIMENTS INTERNS). */
    const detallSensePunt = descripcio.toUpperCase() === "MOVIMENTS INTERNS";
    const esSubtotal = !descOriginal.startsWith(".") && !detallSensePunt;

    if (!nodesVistos.has(node)) {
      nodesVistos.add(node);
      concepts.push({ node, descripcio, esSubtotal, ordre: concepts.length });
    }

    // Fets: valor per cada columna de dimensió (només no-zero)
    for (const col of columnes) {
      const raw = row[col.colIdx];
      if (raw === null || raw === undefined || raw === "") continue;
      const valor = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
      if (Number.isNaN(valor) || valor === 0) continue;
      fets.push({ node, colIdx: col.colIdx, valor });
    }
  }

  return { concepts, columnes, fets, errors };
}

export {
  periodeDesDelNomFitxer,
  classificacioDesDelNomFitxer,
  codiLnDesDeSufix,
} from "@/lib/nom-fitxer";

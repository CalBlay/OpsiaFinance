import { type WorkBook, read, utils } from "xlsx";

export interface FilaHoresTreball {
  empleado: string;
  organizaciones: string;
  proyecto: string;
  minutos: number;
}

export interface ResultatParserHores {
  files: FilaHoresTreball[];
  capçalera: string[];
}

function normalitzarCapçalera(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function trobarIndex(headers: string[], ...candidats: string[]): number {
  for (const c of candidats) {
    const idx = headers.findIndex((h) => h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function trobarIndexExacte(headers: string[], ...candidats: string[]): number {
  for (const c of candidats) {
    const idx = headers.findIndex((h) => h === c);
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Columna nom de projecte (mai «ID de proyecto» / «ID del proyecto padre»). */
function trobarIndexProyecto(headers: string[]): number {
  const exact = trobarIndexExacte(headers, "proyecto");
  if (exact >= 0) return exact;
  return headers.findIndex((h) => h.includes("proyecto") && !/\bid\b/.test(h));
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function detectarCapçalera(matrix: unknown[][]): number {
  let best = 0;
  let score = 0;
  for (let i = 0; i < Math.min(15, matrix.length); i++) {
    const row = matrix[i] ?? [];
    const headers = row.map(normalitzarCapçalera);
    const hasEmp = headers.some((h) => h.includes("empleado"));
    const hasOrg = headers.some((h) => h.includes("organizacion"));
    const hasProy = headers.some((h) => h === "proyecto");
    const hasMin = headers.some((h) => h.includes("minuto"));
    const s = [hasEmp, hasOrg, hasProy, hasMin].filter(Boolean).length;
    if (s > score) {
      score = s;
      best = i;
    }
  }
  return best;
}

export function parseExcelHoresTreball(buffer: Buffer): ResultatParserHores {
  const wb: WorkBook = read(buffer);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { files: [], capçalera: [] };

  const matrix = utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: false,
  });

  if (!matrix.length) return { files: [], capçalera: [] };

  const headerRow = detectarCapçalera(matrix);
  const capçalera = (matrix[headerRow] ?? []).map((c) => String(c ?? "").trim());
  const headersNorm = capçalera.map(normalitzarCapçalera);

  const idxEmp = trobarIndex(headersNorm, "empleado");
  let idxOrg = trobarIndex(headersNorm, "organizacion");
  let idxProy = trobarIndexProyecto(headersNorm);
  let idxMin = trobarIndexExacte(headersNorm, "minutos", "minuto");
  if (idxMin < 0) idxMin = trobarIndex(headersNorm, "minuto");

  // Format exportació: A=Empleado, C=Organizaciones (origen), F=Proyecto (destí), G=Minutos
  if (idxOrg < 0) idxOrg = 2;
  if (idxProy < 0) idxProy = 5;
  if (idxMin < 0) idxMin = 6;

  if (idxOrg < 0 || idxProy < 0 || idxMin < 0) {
    throw new Error(
      "No s'han trobat les columnes obligatòries (Organizaciones, Proyecto, Minutos)."
    );
  }

  const files: FilaHoresTreball[] = [];
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const organizaciones = String(row[idxOrg] ?? "").trim();
    const proyecto = String(row[idxProy] ?? "").trim();
    const minutos = parseNum(row[idxMin]);
    // Ignora IDs numèrics si s'ha llegit la columna equivocada
    if (!organizaciones || !proyecto || minutos <= 0) continue;
    if (/^\d+$/.test(proyecto)) continue;

    files.push({
      empleado: idxEmp >= 0 ? String(row[idxEmp] ?? "").trim() : "",
      organizaciones,
      proyecto,
      minutos,
    });
  }

  return { files, capçalera };
}

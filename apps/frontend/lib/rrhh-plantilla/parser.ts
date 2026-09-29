/**
 * Parser Excel plantilla RRHH (organization × M1'2026 … M12'2026).
 * M1 = gener, M2 = febrer, … M12 = desembre.
 */

import { type WorkBook, read, utils } from "xlsx";
import { normalitzarTextOrgPlantilla } from "./mapeig";

export type ColMesPlantilla = { idx: number; mes: number; any: number; capcalera: string };

export type FilaPlantillaExcel = {
  textRaw: string;
  text: string;
  /** 0 = arrel, 1 = |, 2 = || … */
  nivell: number;
  esFulla: boolean;
  valors: { mes: number; any: number; persones: number }[];
};

export type ParsePlantillaResult = {
  files: FilaPlantillaExcel[];
  columnesMes: ColMesPlantilla[];
  diagnostica: string;
};

function cell(row: unknown[], i: number): string {
  const v = row[i];
  if (v == null) return "";
  return String(v).trim();
}

function cellNum(row: unknown[], i: number): number | null {
  const v = row[i];
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function nivellDesDeText(raw: string): number {
  const m = raw.match(/^(\|+)\s*/);
  return m?.[1] ? m[1].length : 0;
}

/**
 * Accepta: M1'2026, M1’2026, M1 2026, M1-2026, M01'26, m1'2026…
 * Any de 2 dígits → 2000+.
 */
export function parseCapcaleraMes(raw: string): { mes: number; any: number } | null {
  const t = raw.trim();
  const m = t.match(/^M\s*0?([1-9]|1[0-2])\s*[''`´\-/\s]?\s*(\d{2}|\d{4})\s*$/i);
  if (!m?.[1] || !m[2]) return null;
  const mes = Number(m[1]);
  let any = Number(m[2]);
  if (any < 100) any += 2000;
  if (mes < 1 || mes > 12 || any < 2000 || any > 2100) return null;
  return { mes, any };
}

function detectarIdxOrg(header: unknown[]): number {
  for (let i = 0; i < Math.min(header.length, 6); i++) {
    const t = cell(header, i).toLowerCase();
    if (
      t.includes("organiz") ||
      t.includes("organitz") ||
      t === "org" ||
      t.includes("depart") ||
      t.includes("unitat")
    ) {
      return i;
    }
  }
  return 0;
}

export function parseExcelPlantillaRrhh(buffer: Buffer): ParsePlantillaResult {
  const wb: WorkBook = read(buffer, { type: "buffer", cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) {
    return { files: [], columnesMes: [], diagnostica: "Full buit." };
  }

  const matrix = utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (!matrix.length) {
    return { files: [], columnesMes: [], diagnostica: "Sense files." };
  }

  // Cerca fila de capçalera (primers 10)
  let headerRow = 0;
  let columnesMes: ColMesPlantilla[] = [];
  let idxOrg = 0;
  for (let r = 0; r < Math.min(10, matrix.length); r++) {
    const row = matrix[r] ?? [];
    const cols: ColMesPlantilla[] = [];
    for (let c = 0; c < row.length; c++) {
      const parsed = parseCapcaleraMes(cell(row, c));
      if (parsed) cols.push({ idx: c, mes: parsed.mes, any: parsed.any, capcalera: cell(row, c) });
    }
    if (cols.length >= 1) {
      headerRow = r;
      columnesMes = cols;
      idxOrg = detectarIdxOrg(row);
      break;
    }
  }

  if (!columnesMes.length) {
    return {
      files: [],
      columnesMes: [],
      diagnostica: "No s'han trobat columnes M1'AAAA … M12'AAAA.",
    };
  }

  const files: FilaPlantillaExcel[] = [];
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const textRaw = cell(row, idxOrg);
    if (!textRaw) continue;
    const nivell = nivellDesDeText(textRaw);
    const text = normalitzarTextOrgPlantilla(textRaw);
    if (!text) continue;

    const valors: FilaPlantillaExcel["valors"] = [];
    for (const col of columnesMes) {
      const n = cellNum(row, col.idx);
      if (n == null || n < 0) continue;
      valors.push({ mes: col.mes, any: col.any, persones: n });
    }
    if (!valors.length) continue;

    files.push({ textRaw, text, nivell, esFulla: true, valors });
  }

  // Marca fulles: una fila és fulla si la següent té nivell <= actual (o no hi ha més).
  for (let i = 0; i < files.length; i++) {
    const cur = files[i]!;
    const next = files[i + 1];
    cur.esFulla = !next || next.nivell <= cur.nivell;
  }

  const anys = [...new Set(columnesMes.map((c) => c.any))].sort();
  const mesos = columnesMes.map((c) => `M${c.mes}'${c.any}`).join(", ");
  return {
    files,
    columnesMes,
    diagnostica: `Full «${name}» · org col ${idxOrg} · ${columnesMes.length} mesos (${mesos}) · ${files.length} files · anys ${anys.join(",")}`,
  };
}

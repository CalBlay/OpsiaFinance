/**
 * Parser per al P&L hotel FDLC (comptes PGC amb columnes mensuals).
 *
 * Estructura esperada:
 * - Col A: Cuenta · Col B: Definición · Cols G–R: mesos (Enero…Diciembre)
 * - Cols C–F (Debe/Haber/Saldo): s'ignoren · Cols G+ = mesos
 * - Una pujada extreu tots els mesos amb dades de l'exercici indicat
 */

import { readFileSync } from "fs";
import {
  esSubcomptePg,
  mapFdlcCompte,
  normalitzarCodiCompte,
  normalitzarImportFdlc,
  prefixPg3,
} from "@/lib/fdlc/mapeig";
import * as XLSX from "xlsx";

export interface FdlcFetParsed {
  node: number;
  valor: number;
  mes: number;
}

export interface ParsePygFdlcResult {
  fets: FdlcFetParsed[];
  mesosDetectats: number[];
  errors: string[];
  avisos: string[];
  comptesNoMapats: string[];
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
  if (!s || s === "-" || s === "—") return null;

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

function esCapcaleraCuenta(text: string): boolean {
  const norm = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return (
    norm === "cuenta" ||
    norm === "compte" ||
    norm.startsWith("cuenta ") ||
    norm.startsWith("compte ")
  );
}

function esCapcaleraTipus(text: string): boolean {
  const norm = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return norm.includes("tipo") && (norm.includes("registro") || norm.includes("registre"));
}

interface CapcaleraFdlc {
  rowIdx: number;
  cuentaCol: number;
  descCol: number;
  tipoCol: number;
  columnesMes: { col: number; mes: number }[];
}

/** Grups PGC amb subcomptes de detall al mateix full (p.ex. 622 → 62200002). */
function recollirPrefixesAmbDetall(
  matrix: (string | number | null)[][],
  cap: CapcaleraFdlc
): Set<string> {
  const prefixes = new Set<string>();
  for (let i = cap.rowIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;
    const cuentaRaw = row[cap.cuentaCol];
    if (cuentaRaw === null || cuentaRaw === undefined) continue;
    if (esSubcomptePg(cuentaRaw)) {
      prefixes.add(prefixPg3(cuentaRaw));
    }
  }
  return prefixes;
}

/**
 * Decideix si una fila s'ha d'importar.
 * - «Detalle» / subcomptes: sempre.
 * - «Cabecera» (3 dígits): només si el grup no té subcomptes (p.ex. 640 sense 640xxxxx).
 */
function filaImportable(cuenta: string, tipoRaw: unknown, prefixesAmbDetall: Set<string>): boolean {
  if (tipoRaw !== null && tipoRaw !== undefined && String(tipoRaw).trim() !== "") {
    const t = String(tipoRaw).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    if (t.includes("cabecera")) {
      return !prefixesAmbDetall.has(prefixPg3(cuenta));
    }
    if (t.includes("detalle") || t.includes("detall")) return true;
  }

  if (esSubcomptePg(cuenta)) return true;
  return !prefixesAmbDetall.has(prefixPg3(cuenta));
}

function detectarCapcalera(matrix: (string | number | null)[][]): CapcaleraFdlc | null {
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const row = matrix[i];
    if (!row) continue;

    let cuentaCol = -1;
    let descCol = -1;
    let tipoCol = -1;
    const columnesMes: { col: number; mes: number }[] = [];

    for (let j = 0; j < row.length; j++) {
      const raw = row[j];
      if (raw === null || raw === undefined) continue;
      const text = String(raw).trim();
      if (!text) continue;

      if (cuentaCol === -1 && esCapcaleraCuenta(text)) {
        cuentaCol = j;
        continue;
      }

      const norm = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
      if (
        descCol === -1 &&
        (norm.includes("definicion") ||
          norm.includes("definici") ||
          norm === "descripcion" ||
          norm === "descripcio")
      ) {
        descCol = j;
        continue;
      }
      if (tipoCol === -1 && esCapcaleraTipus(text)) {
        tipoCol = j;
        continue;
      }

      const mes = mesDesDeCapcalera(text);
      if (mes !== null) columnesMes.push({ col: j, mes });
    }

    if (cuentaCol >= 0 && columnesMes.length > 0) {
      columnesMes.sort((a, b) => a.col - b.col);
      const unics = new Map<number, number>();
      for (const c of columnesMes) unics.set(c.mes, c.col);
      const columnesUniques = [...unics.entries()]
        .map(([mes, col]) => ({ mes, col }))
        .sort((a, b) => a.mes - b.mes);

      return {
        rowIdx: i,
        cuentaCol,
        descCol: descCol >= 0 ? descCol : cuentaCol + 1,
        tipoCol,
        columnesMes: columnesUniques,
      };
    }
  }
  return null;
}

function triaFullFdlc(noms: string[]): string {
  const preferit = noms.find((n) => /pyg|perdidas|ganancias|resultat|p&l|fdlc|hotel/i.test(n));
  if (preferit) return preferit;
  return noms[0] ?? "";
}

/**
 * Llegeix tots els mesos amb dades de l'Excel FDLC per a un exercici (`any`).
 */
export function parsePygFdlc(filePath: string, _any: number): ParsePygFdlcResult {
  const errors: string[] = [];
  const avisos: string[] = [];
  const comptesNoMapats = new Set<string>();
  const agregatPerMes = new Map<number, Map<number, number>>();

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(readFileSync(filePath));
  } catch (err) {
    return {
      fets: [],
      mesosDetectats: [],
      errors: [`No s'ha pogut llegir el fitxer: ${err}`],
      avisos: [],
      comptesNoMapats: [],
    };
  }

  if (workbook.SheetNames.length === 0) {
    return {
      fets: [],
      mesosDetectats: [],
      errors: ["El fitxer no té cap full."],
      avisos: [],
      comptesNoMapats: [],
    };
  }

  const sheetName = triaFullFdlc(workbook.SheetNames);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      fets: [],
      mesosDetectats: [],
      errors: ["No s'ha pogut llegir el full de dades."],
      avisos: [],
      comptesNoMapats: [],
    };
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  const cap = detectarCapcalera(matrix);
  if (!cap) {
    return {
      fets: [],
      mesosDetectats: [],
      errors: ["No s'ha reconegut el format FDLC (capçalera «Cuenta» + mesos)."],
      avisos: [],
      comptesNoMapats: [],
    };
  }

  for (const { mes } of cap.columnesMes) {
    agregatPerMes.set(mes, new Map());
  }

  const prefixesAmbDetall = recollirPrefixesAmbDetall(matrix, cap);

  for (let i = cap.rowIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;

    const cuentaRaw = row[cap.cuentaCol];
    if (cuentaRaw === null || cuentaRaw === undefined || String(cuentaRaw).trim() === "") continue;

    const cuenta = normalitzarCodiCompte(cuentaRaw);
    if (!/\d/.test(cuenta)) continue;

    const tipoRaw = cap.tipoCol >= 0 ? row[cap.tipoCol] : null;
    if (!filaImportable(cuenta, tipoRaw, prefixesAmbDetall)) continue;

    const descripcio = String(row[cap.descCol] ?? "").trim();
    const node = mapFdlcCompte(cuenta, descripcio);

    for (const { col, mes } of cap.columnesMes) {
      const raw = parseImportCel(row[col]);
      if (raw === null || raw === 0) continue;

      if (node === null) {
        if (!cuenta.startsWith("129")) {
          comptesNoMapats.add(`${cuenta} · ${descripcio}`);
        }
        continue;
      }

      const valor = normalitzarImportFdlc(node, raw);
      if (valor === 0) continue;

      const mapMes = agregatPerMes.get(mes)!;
      mapMes.set(node, (mapMes.get(node) ?? 0) + valor);
    }
  }

  const fets: FdlcFetParsed[] = [];
  const mesosDetectats: number[] = [];

  for (const [mes, mapNode] of agregatPerMes) {
    if (mapNode.size === 0) continue;
    mesosDetectats.push(mes);
    for (const [node, valor] of mapNode) {
      if (valor !== 0) fets.push({ node, valor, mes });
    }
  }

  mesosDetectats.sort((a, b) => a - b);
  fets.sort((a, b) => a.mes - b.mes || a.node - b.node);

  if (fets.length === 0) {
    errors.push("No s'han trobat dades en cap columna mensual de l'Excel.");
  }

  if (cap.tipoCol < 0) {
    avisos.push(
      "No s'ha detectat la columna «Tipo registro»; s'importen subcomptes o capçaleres sense detall."
    );
  }

  return {
    fets,
    mesosDetectats,
    errors,
    avisos,
    comptesNoMapats: [...comptesNoMapats],
  };
}

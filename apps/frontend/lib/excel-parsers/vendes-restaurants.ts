/**
 * Parsers dels Excel mensuals de vendes TPV (restaurants).
 *
 * Convenció de nom:
 *   V_MM_YYYY[_CC].xls       → vendes diàries
 *   Pack_MM_YYYY[_CC].xls    → packs / menús
 *   Detall_MM_YYYY_CC.xls    → productes (sufix = CCR000NN)
 *
 * Suporta dos layouts:
 *   A) Transposat: files = mètriques (Jornada/Article/Unitats/Base), columnes = dies/articles
 *   B) Tabular:    1a fila = capçaleres, cada fila = un dia o un article
 *
 * Import monetari: sempre Base (sense IVA). Si no hi ha Base → Cobrades.
 */

import { parseImportExcel } from "@/lib/excel-parsers/cost-salarial-restaurants";
import { type CategoriaVenda, categoriaDesDeTaxonomia } from "@/lib/vendes-restaurants/categories";
import * as XLSX from "xlsx";

export type TipusFitxerVendes = "V" | "DETALL" | "PACK";

export interface MetaFitxerVendes {
  tipus: TipusFitxerVendes;
  mes: number;
  any: number;
  centreSufix: number | null;
}

export interface VendaDiariaParsed {
  dia: number;
  data: Date;
  unitats: number;
  base: number;
}

export interface VendaArticleParsed {
  article: string;
  tipusArticle: string | null;
  grup: string | null;
  familia: string | null;
  subfamilia: string | null;
  categoria: CategoriaVenda | null;
  unitats: number;
  base: number;
}

export interface ParseVendesDiariesResult {
  meta: MetaFitxerVendes;
  nomCentre: string | null;
  linies: VendaDiariaParsed[];
  errors: string[];
}

export interface ParseVendesArticlesResult {
  meta: MetaFitxerVendes;
  nomCentre: string | null;
  linies: VendaArticleParsed[];
  errors: string[];
}

function normalitzaLabel(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const SECCIONS = new Set(["vendes", "cost", "marge", "beneficio", "benefici", "tarifa"]);

const LABEL_SET = new Set([
  "centre",
  "centro",
  "font negoci",
  "fuente negocio",
  "article",
  "articulo",
  "producto",
  "producte",
  "article base",
  "articulo base",
  "jornada",
  "dia",
  "fecha",
  "data",
  "unitats",
  "unidades",
  "ud",
  "uds",
  "% unitats",
  "% unidades",
  "base",
  "iva",
  "total",
  "cobrades",
  "cobradas",
  "brut",
  "bruto",
  "pvp",
  "pvp ponderat",
  "pvp ponderado",
  "% cobrades",
  "% cobradas",
  "tipo",
  "tipus",
  "articulo [tipo]",
  "article [tipus]",
  "articulo[tipo]",
  "article[tipus]",
  "article [grupo]",
  "article [grup]",
  "articulo [grupo]",
  "article [familia]",
  "articulo [familia]",
  "article [subfamilia]",
  "articulo [subfamilia]",
  "grupo",
  "grup",
  "familia",
  "subfamilia",
]);

function esLabelConegut(label: string): boolean {
  if (!label) return false;
  if (LABEL_SET.has(label)) return true;
  if (label.includes("[tipo]") || label.includes("[tipus]")) return true;
  if (label.includes("[grupo]") || label.includes("[grup]")) return true;
  if (label.includes("[familia]") || label.includes("[subfamilia]")) return true;
  if (label.startsWith("% ")) return true;
  return false;
}

function esCentreLabel(l: string): boolean {
  return l === "centre" || l === "centro";
}
function esArticleLabel(l: string): boolean {
  return l === "article" || l === "articulo" || l === "producto" || l === "producte";
}
function esTipusLabel(l: string): boolean {
  return (
    l === "tipo" ||
    l === "tipus" ||
    l.includes("[tipo]") ||
    l.includes("[tipus]") ||
    l === "articulo [tipo]" ||
    l === "article [tipus]"
  );
}
function esGrupLabel(l: string): boolean {
  return (
    l === "grupo" ||
    l === "grup" ||
    l.includes("[grupo]") ||
    l.includes("[grup]") ||
    l === "article [grupo]" ||
    l === "article [grup]" ||
    l === "articulo [grupo]"
  );
}
function esFamiliaLabel(l: string): boolean {
  return (
    l === "familia" ||
    l.includes("[familia]") ||
    l === "article [familia]" ||
    l === "articulo [familia]"
  );
}
function esSubfamiliaLabel(l: string): boolean {
  return (
    l === "subfamilia" ||
    l.includes("[subfamilia]") ||
    l === "article [subfamilia]" ||
    l === "articulo [subfamilia]"
  );
}
function esJornadaLabel(l: string): boolean {
  return l === "jornada" || l === "dia" || l === "fecha" || l === "data";
}
function esUnitatsLabel(l: string): boolean {
  return l === "unitats" || l === "unidades" || l === "ud" || l === "uds";
}
function esBaseLabel(l: string): boolean {
  return l === "base";
}
function esCobradesLabel(l: string): boolean {
  return l === "cobrades" || l === "cobradas" || l === "importe cobrado" || l === "import cobrat";
}

/** Detecta tipus / període / sufix CCR del nom del fitxer. */
export function metaDesDelNomFitxer(nomFitxer: string): MetaFitxerVendes | null {
  const base = nomFitxer.replace(/\.[^.]+$/, "").trim();
  const lower = base.toLowerCase();

  let tipus: TipusFitxerVendes | null = null;
  if (/^v([_\-\s]|$)/i.test(lower) || lower.startsWith("v_")) tipus = "V";
  else if (lower.startsWith("pack")) tipus = "PACK";
  else if (lower.startsWith("detall") || lower.startsWith("detalle")) tipus = "DETALL";
  if (!tipus) return null;

  const nums = base.match(/\d+/g);
  if (!nums || nums.length < 2) return null;

  let mes: number | null = null;
  let any: number | null = null;
  let centreSufix: number | null = null;

  for (const n of nums) {
    const v = Number.parseInt(n, 10);
    if (v >= 1900) any = v;
    else if (v >= 1 && v <= 12 && mes === null) mes = v;
    else if (v >= 0 && v <= 99 && mes !== null && any !== null && centreSufix === null) {
      centreSufix = v;
    }
  }

  if (mes === null || any === null) return null;
  return { tipus, mes, any, centreSufix };
}

export function codiCentreDesDeSufix(sufix: number): string {
  return `CCR${String(sufix).padStart(5, "0")}`;
}

function llegeixFiles(buffer: Buffer): { rows: unknown[][]; errors: string[] } {
  try {
    const wb = XLSX.read(buffer, { cellDates: true, raw: true });
    const name = wb.SheetNames[0];
    if (!name) return { rows: [], errors: ["El fitxer no té cap full."] };
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    });
    return { rows, errors: [] };
  } catch (err) {
    return { rows: [], errors: [`No s'ha pogut llegir l'Excel: ${String(err)}`] };
  }
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Capçaleres tabulars (possiblement 2 files: secció + mètrica). */
function resolCapcaleraTabular(
  rows: unknown[][]
): { headerRow: number; dataStartRow: number; headers: string[] } | null {
  const limit = Math.min(rows.length, 15);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] ?? [];
    const labels = row.map((c) => normalitzaLabel(cellStr(c)));
    const teCentre = labels.some(esCentreLabel);
    const teArticle = labels.some(esArticleLabel);
    const teJornada = labels.some(esJornadaLabel);
    if (!teCentre || (!teArticle && !teJornada)) continue;

    const headers = [...labels];
    let dataStartRow = r + 1;
    const next = rows[r + 1] ?? [];
    if (next.length) {
      const nextLabels = next.map((c) => normalitzaLabel(cellStr(c)));
      const nextSemblaDades =
        nextLabels.some((l) => l && !esLabelConegut(l) && !SECCIONS.has(l)) &&
        !nextLabels.some(esUnitatsLabel) &&
        !nextLabels.some(esBaseLabel) &&
        !nextLabels.some(esCobradesLabel);

      // Segona fila de capçalera (ex. Vendes → Unitats / Cobrades)
      if (!nextSemblaDades) {
        for (let c = 0; c < Math.max(headers.length, nextLabels.length); c++) {
          const h = headers[c] ?? "";
          const n = nextLabels[c] ?? "";
          if (!h && n) headers[c] = n;
          else if (SECCIONS.has(h) && n) headers[c] = n;
          else if (h && n && esLabelConegut(n)) headers[c] = n;
        }
        dataStartRow = r + 2;
      }
    }

    const teUnitats = headers.some(esUnitatsLabel);
    const teImport = headers.some(esBaseLabel) || headers.some(esCobradesLabel);
    if (teArticle || teJornada) {
      if (teUnitats || teImport) {
        return { headerRow: r, dataStartRow, headers };
      }
      // Centre+Article sense mètriques a la capçalera: pot ser eix de matriu transposada → no tabular
    }
  }
  return null;
}

function labelIDataStart(row: unknown[]): { label: string; dataStart: number } | null {
  const c0 = row[0] != null && cellStr(row[0]) !== "" ? normalitzaLabel(cellStr(row[0])) : "";
  const c1 = row[1] != null && cellStr(row[1]) !== "" ? normalitzaLabel(cellStr(row[1])) : "";

  if (c0 && SECCIONS.has(c0) && c1) return { label: c1, dataStart: 2 };
  if (c0 && c1 && c0 === c1) return { label: c0, dataStart: 2 };
  if (!c0 && c1) return { label: c1, dataStart: 2 };

  if (c0) {
    if (SECCIONS.has(c0) && !c1) return null;
    // «Article | COMBINAT | …» → dades a col 1 (no saltar el primer article)
    if (
      esArticleLabel(c0) ||
      esJornadaLabel(c0) ||
      esUnitatsLabel(c0) ||
      esBaseLabel(c0) ||
      esCobradesLabel(c0)
    ) {
      // Si c1 també és etiqueta coneguda (Centre|Centre ja cobert), dades a 2
      if (c1 && esLabelConegut(c1) && !esArticleLabel(c0)) {
        return { label: c0, dataStart: 2 };
      }
      return { label: c0, dataStart: 1 };
    }
    if (esCentreLabel(c0)) {
      return { label: c0, dataStart: c1 && esCentreLabel(c1) ? 2 : 1 };
    }
    if (
      esTipusLabel(c0) ||
      esGrupLabel(c0) ||
      esFamiliaLabel(c0) ||
      esSubfamiliaLabel(c0) ||
      (c1 && (esTipusLabel(c1) || esGrupLabel(c1) || esFamiliaLabel(c1) || esSubfamiliaLabel(c1)))
    ) {
      const label =
        esTipusLabel(c0) || esGrupLabel(c0) || esFamiliaLabel(c0) || esSubfamiliaLabel(c0)
          ? c0
          : c1;
      return {
        label,
        dataStart:
          esTipusLabel(c0) || esGrupLabel(c0) || esFamiliaLabel(c0) || esSubfamiliaLabel(c0)
            ? 1
            : 2,
      };
    }
    return { label: c0, dataStart: 1 };
  }
  return null;
}

function parseDataJornada(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d?.y && d?.m && d?.d) return new Date(d.y, d.m - 1, d.d);
  }
  const s = String(raw).trim();
  const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const any = Number(m[3]);
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) return new Date(any, mes - 1, dia);
  }
  return null;
}

function primerNomCentre(vals: unknown[]): string | null {
  for (const v of vals) {
    const s = cellStr(v);
    if (!s) continue;
    const n = normalitzaLabel(s);
    if (esLabelConegut(n)) continue;
    if (n === "font negoci" || n.startsWith("font ")) continue;
    return s;
  }
  return null;
}

function indexCol(headers: string[], pred: (l: string) => boolean): number {
  for (let i = 0; i < headers.length; i++) {
    if (pred(headers[i] ?? "")) return i;
  }
  return -1;
}

function parseDiariesTabular(
  rows: unknown[][],
  cap: { headerRow: number; dataStartRow: number; headers: string[] },
  meta: MetaFitxerVendes
): { nomCentre: string | null; linies: VendaDiariaParsed[]; errors: string[] } {
  const errors: string[] = [];
  const headers = cap.headers;
  const colCentre = indexCol(headers, esCentreLabel);
  const colJornada = indexCol(headers, esJornadaLabel);
  const colUnitats = indexCol(headers, esUnitatsLabel);
  const colBase = indexCol(headers, esBaseLabel);
  const colCobrades = indexCol(headers, esCobradesLabel);
  const colImport = colBase >= 0 ? colBase : colCobrades;

  if (colJornada < 0) errors.push("No s'ha trobat la columna Jornada.");
  if (colImport < 0) errors.push("No s'ha trobat la columna Base ni Cobrades.");
  if (errors.length) return { nomCentre: null, linies: [], errors };

  let nomCentre: string | null = null;
  const perDia = new Map<number, VendaDiariaParsed>();

  for (let r = cap.dataStartRow; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (colCentre >= 0) {
      const c = cellStr(row[colCentre]);
      if (c && !esLabelConegut(normalitzaLabel(c))) nomCentre = nomCentre ?? c;
    }
    const data = parseDataJornada(row[colJornada]);
    if (!data) continue;
    const unitats = colUnitats >= 0 ? parseImportExcel(row[colUnitats]) : 0;
    const base = parseImportExcel(row[colImport]);
    if (unitats === 0 && base === 0) continue;
    if (data.getMonth() + 1 !== meta.mes || data.getFullYear() !== meta.any) {
      errors.push(
        `Dia ${data.toLocaleDateString("ca-ES")} fora del període ${meta.mes}/${meta.any}.`
      );
    }
    // Ignorem Font negoci: si hi ha Mostrador + [1] el mateix dia → una sola línia
    const dia = data.getDate();
    const existent = perDia.get(dia);
    if (existent) {
      existent.unitats += unitats;
      existent.base += base;
    } else {
      perDia.set(dia, { dia, data, unitats, base });
    }
  }

  const linies = [...perDia.values()].sort((a, b) => a.dia - b.dia);

  if (!linies.length) errors.push("No s'han trobat dies amb vendes.");
  return { nomCentre, linies, errors };
}

function parseArticlesTabular(
  rows: unknown[][],
  cap: { headerRow: number; dataStartRow: number; headers: string[] },
  meta: MetaFitxerVendes
): { nomCentre: string | null; linies: VendaArticleParsed[]; errors: string[] } {
  const errors: string[] = [];
  const headers = cap.headers;
  const colCentre = indexCol(headers, esCentreLabel);
  const colArticle = indexCol(headers, esArticleLabel);
  const colTipus = indexCol(headers, esTipusLabel);
  const colGrup = indexCol(headers, esGrupLabel);
  const colFamilia = indexCol(headers, esFamiliaLabel);
  const colSubfamilia = indexCol(headers, esSubfamiliaLabel);
  const colUnitats = indexCol(headers, esUnitatsLabel);
  let colImport = indexCol(headers, esBaseLabel);
  if (colImport < 0) colImport = indexCol(headers, esCobradesLabel);

  if (colArticle < 0) errors.push("No s'ha trobat la columna Article.");
  if (colImport < 0) errors.push("No s'ha trobat la columna Base ni Cobrades.");
  if (errors.length) return { nomCentre: null, linies: [], errors };

  let nomCentre: string | null = null;
  const linies: VendaArticleParsed[] = [];
  const vistos = new Map<string, VendaArticleParsed>();

  for (let r = cap.dataStartRow; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (colCentre >= 0) {
      const c = cellStr(row[colCentre]);
      if (c && !esLabelConegut(normalitzaLabel(c))) nomCentre = nomCentre ?? c;
    }
    const article = cellStr(row[colArticle]);
    if (!article || esLabelConegut(normalitzaLabel(article))) continue;
    const unitats = colUnitats >= 0 ? parseImportExcel(row[colUnitats]) : 0;
    const base = parseImportExcel(row[colImport]);
    if (unitats === 0 && base === 0) continue;
    const tipusArticle =
      colTipus >= 0 ? cellStr(row[colTipus]) || null : meta.tipus === "PACK" ? "Pack" : null;
    const grup = colGrup >= 0 ? cellStr(row[colGrup]) || null : null;
    const familia = colFamilia >= 0 ? cellStr(row[colFamilia]) || null : null;
    const subfamilia = colSubfamilia >= 0 ? cellStr(row[colSubfamilia]) || null : null;
    const categoria = categoriaDesDeTaxonomia(grup, familia, subfamilia);

    const clau = article.toLowerCase();
    const existent = vistos.get(clau);
    if (existent) {
      existent.unitats += unitats;
      existent.base += base;
    } else {
      const linia: VendaArticleParsed = {
        article,
        tipusArticle,
        grup,
        familia,
        subfamilia,
        categoria,
        unitats,
        base,
      };
      vistos.set(clau, linia);
      linies.push(linia);
    }
  }

  if (!linies.length) errors.push("No s'han trobat articles amb vendes.");
  return { nomCentre, linies, errors };
}

function parseDiariesTransposed(
  rows: unknown[][],
  meta: MetaFitxerVendes
): { nomCentre: string | null; linies: VendaDiariaParsed[]; errors: string[] } {
  const errors: string[] = [];
  let nomCentre: string | null = null;
  let jornades: (Date | null)[] = [];
  let unitats: number[] = [];
  let bases: number[] = [];

  for (const row of rows) {
    if (!row || !Array.isArray(row)) continue;
    const info = labelIDataStart(row);
    if (!info) continue;

    if (esCentreLabel(info.label)) {
      nomCentre = primerNomCentre(row.slice(info.dataStart)) ?? nomCentre;
    } else if (esJornadaLabel(info.label)) {
      jornades = row.slice(info.dataStart).map(parseDataJornada);
    } else if (esUnitatsLabel(info.label) && !unitats.length) {
      unitats = row.slice(info.dataStart).map(parseImportExcel);
    } else if (esBaseLabel(info.label) && !bases.length) {
      bases = row.slice(info.dataStart).map(parseImportExcel);
    } else if (esCobradesLabel(info.label) && !bases.length) {
      bases = row.slice(info.dataStart).map(parseImportExcel);
    }
  }

  if (!jornades.length) errors.push("No s'ha trobat la fila Jornada (dies del mes).");
  if (!bases.length) errors.push("No s'ha trobat la fila Base ni Cobrades.");

  const linies: VendaDiariaParsed[] = [];
  const n = Math.max(jornades.length, unitats.length, bases.length);
  for (let i = 0; i < n; i++) {
    const data = jornades[i] ?? null;
    if (!data) continue;
    if (data.getMonth() + 1 !== meta.mes || data.getFullYear() !== meta.any) {
      errors.push(
        `Dia ${data.toLocaleDateString("ca-ES")} fora del període ${meta.mes}/${meta.any}.`
      );
    }
    const u = unitats[i] ?? 0;
    const b = bases[i] ?? 0;
    if (u === 0 && b === 0) continue;
    linies.push({ dia: data.getDate(), data, unitats: u, base: b });
  }

  if (!linies.length && !errors.length) errors.push("No s'han trobat dies amb vendes.");
  return { nomCentre, linies, errors };
}

function parseArticlesTransposed(
  rows: unknown[][],
  meta: MetaFitxerVendes
): { nomCentre: string | null; linies: VendaArticleParsed[]; errors: string[] } {
  const errors: string[] = [];
  let nomCentre: string | null = null;
  let articles: (string | null)[] = [];
  let tipus: (string | null)[] = [];
  let grups: (string | null)[] = [];
  let families: (string | null)[] = [];
  let subfamilies: (string | null)[] = [];
  let unitats: number[] = [];
  let bases: number[] = [];

  for (const row of rows) {
    if (!row || !Array.isArray(row)) continue;
    const info = labelIDataStart(row);
    if (!info) continue;

    if (esCentreLabel(info.label)) {
      nomCentre = primerNomCentre(row.slice(info.dataStart)) ?? nomCentre;
    } else if (esArticleLabel(info.label)) {
      articles = row.slice(info.dataStart).map((v) => {
        const s = cellStr(v);
        if (!s || esLabelConegut(normalitzaLabel(s))) return null;
        return s;
      });
    } else if (esTipusLabel(info.label)) {
      tipus = row.slice(info.dataStart).map((v) => cellStr(v) || null);
    } else if (esGrupLabel(info.label)) {
      grups = row.slice(info.dataStart).map((v) => cellStr(v) || null);
    } else if (esFamiliaLabel(info.label)) {
      families = row.slice(info.dataStart).map((v) => cellStr(v) || null);
    } else if (esSubfamiliaLabel(info.label)) {
      subfamilies = row.slice(info.dataStart).map((v) => cellStr(v) || null);
    } else if (esUnitatsLabel(info.label) && !unitats.length) {
      unitats = row.slice(info.dataStart).map(parseImportExcel);
    } else if (esBaseLabel(info.label) && !bases.length) {
      bases = row.slice(info.dataStart).map(parseImportExcel);
    } else if (esCobradesLabel(info.label) && !bases.length) {
      bases = row.slice(info.dataStart).map(parseImportExcel);
    }
  }

  if (!articles.length) errors.push("No s'ha trobat la fila Article.");
  if (!bases.length) errors.push("No s'ha trobat Base ni Cobrades (import en €).");

  const n = Math.max(
    articles.length,
    unitats.length,
    bases.length,
    tipus.length,
    grups.length,
    families.length,
    subfamilies.length
  );
  const linies: VendaArticleParsed[] = [];
  const vistos = new Set<string>();

  for (let i = 0; i < n; i++) {
    const article = articles[i];
    if (!article) continue;
    const u = unitats[i] ?? 0;
    const b = bases[i] ?? 0;
    if (u === 0 && b === 0) continue;
    const grup = grups[i] ?? null;
    const familia = families[i] ?? null;
    const subfamilia = subfamilies[i] ?? null;
    const categoria = categoriaDesDeTaxonomia(grup, familia, subfamilia);
    const tipusArticle = tipus[i] ?? (meta.tipus === "PACK" ? "Pack" : null);

    const clau = article.toLowerCase();
    if (vistos.has(clau)) {
      const existent = linies.find((l) => l.article.toLowerCase() === clau);
      if (existent) {
        existent.unitats += u;
        existent.base += b;
      }
      continue;
    }
    vistos.add(clau);
    linies.push({
      article,
      tipusArticle,
      grup,
      familia,
      subfamilia,
      categoria,
      unitats: u,
      base: b,
    });
  }

  if (!linies.length && !errors.length) errors.push("No s'han trobat articles amb vendes.");
  return { nomCentre, linies, errors };
}

export function parseVendesDiariesBuffer(
  buffer: Buffer,
  nomFitxer: string
): ParseVendesDiariesResult {
  const meta = metaDesDelNomFitxer(nomFitxer);
  if (!meta || meta.tipus !== "V") {
    return {
      meta: meta ?? { tipus: "V", mes: 0, any: 0, centreSufix: null },
      nomCentre: null,
      linies: [],
      errors: ["El fitxer no sembla un V_MM_YYYY (vendes diàries)."],
    };
  }

  const { rows, errors: readErrors } = llegeixFiles(buffer);
  if (readErrors.length) return { meta, nomCentre: null, linies: [], errors: readErrors };

  const cap = resolCapcaleraTabular(rows);
  const parsed = cap ? parseDiariesTabular(rows, cap, meta) : parseDiariesTransposed(rows, meta);

  return { meta, nomCentre: parsed.nomCentre, linies: parsed.linies, errors: parsed.errors };
}

export function parseVendesArticlesBuffer(
  buffer: Buffer,
  nomFitxer: string
): ParseVendesArticlesResult {
  const meta = metaDesDelNomFitxer(nomFitxer);
  if (!meta || (meta.tipus !== "DETALL" && meta.tipus !== "PACK")) {
    return {
      meta: meta ?? { tipus: "DETALL", mes: 0, any: 0, centreSufix: null },
      nomCentre: null,
      linies: [],
      errors: ["El fitxer no sembla un Detall_ o Pack_ de vendes."],
    };
  }

  const { rows, errors: readErrors } = llegeixFiles(buffer);
  if (readErrors.length) return { meta, nomCentre: null, linies: [], errors: readErrors };

  const cap = resolCapcaleraTabular(rows);
  const parsed = cap ? parseArticlesTabular(rows, cap, meta) : parseArticlesTransposed(rows, meta);

  return { meta, nomCentre: parsed.nomCentre, linies: parsed.linies, errors: parsed.errors };
}

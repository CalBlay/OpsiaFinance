import type { CarregaFitxerLlistaItem } from "@/lib/carrega-fitxer";
import type { ImportCercaItem } from "@/lib/import-search";
import { etiquetaDepartamentArbre } from "@/lib/traspass-personal/departament";
import type { ResumTraspassPersonal } from "@/lib/traspass-personal/resum";
import { slugFilename } from "./filename";
import type { ExportColumn, ExportInforme, ExportRow } from "./types";

/** Historial d'importacions (pestanya Importacions). */
export function importsToExportInforme(
  items: ImportCercaItem[],
  opts?: { title?: string }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "format", label: "Format" },
    { key: "ln", label: "Línia" },
    { key: "periode", label: "Període" },
    { key: "estat", label: "Estat" },
    { key: "autor", label: "Autor" },
    { key: "data", label: "Data càrrega" },
  ];

  const rows: ExportRow[] = items.map((i) => ({
    descripcio: i.nomFitxer,
    valors: [
      i.formatNom,
      i.lnCodi ? `${i.lnCodi}${i.lnNom ? ` · ${i.lnNom}` : ""}` : (i.lnNom ?? null),
      i.periodNom ??
        (i.periodAny != null
          ? i.periodMes != null
            ? `${i.periodMes}/${i.periodAny}`
            : String(i.periodAny)
          : null),
      i.estatLabel,
      i.autor,
      i.dataCarrega,
    ],
  }));

  return {
    filename: slugFilename("dades-importacions"),
    title: opts?.title ?? "Importacions",
    subtitle: `${items.length} fitxer${items.length !== 1 ? "s" : ""}`,
    firstColLabel: "Fitxer",
    columns,
    rows,
    showTotal: false,
    sheetName: "Importacions",
  };
}

type CostRegistreExport = {
  centreLabel: string;
  periodNom: string;
  periodAny: number;
  periodMes: number;
  departament: string;
  totalSalari: number;
  incentiusMensual: number;
  incentiuTrimestral: number;
  horesExtres: number;
  altres: number;
  baixes: number;
  indemnitzacions: number;
  foraCentre: number;
  notes: string | null;
};

/** Registres de cost salarial (pestanya Dades → Cost salarial). */
export function costRegistresToExportInforme(
  registres: CostRegistreExport[],
  opts: { any: number; mes: number | null; title?: string }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "periode", label: "Període" },
    { key: "dept", label: "Departament" },
    { key: "totalSalari", label: "Total salari" },
    { key: "incentiusM", label: "Incentius mens." },
    { key: "incentiuT", label: "Incentiu trim." },
    { key: "hores", label: "Hores extres" },
    { key: "altres", label: "Altres" },
    { key: "baixes", label: "Baixes" },
    { key: "indem", label: "Indemnitzacions" },
    { key: "fora", label: "Fora centre" },
    { key: "notes", label: "Notes" },
  ];

  const rows: ExportRow[] = registres.map((r) => ({
    descripcio: r.centreLabel,
    valors: [
      r.periodNom,
      r.departament,
      r.totalSalari,
      r.incentiusMensual,
      r.incentiuTrimestral,
      r.horesExtres,
      r.altres,
      r.baixes,
      r.indemnitzacions,
      r.foraCentre,
      r.notes,
    ],
  }));

  const periode = opts.mes != null ? `${opts.mes}/${opts.any}` : `Acumulat ${opts.any}`;

  return {
    filename: slugFilename(`dades-cost-salarial-${periode}`),
    title: opts.title ?? "Cost salarial · registres",
    subtitle: periode,
    firstColLabel: "Centre",
    columns,
    rows,
    showTotal: false,
    sheetName: "Cost salarial",
  };
}

type VendesResumExport = {
  centreCodi: string;
  centreNom: string;
  periodNom: string;
  dies: number;
  baseDies: number;
  productes: number;
  packs: number;
  baseProductes: number;
  basePacks: number;
};

/** Resums de vendes per centre/període (Dades → Vendes). */
export function vendesResumsToExportInforme(
  resums: VendesResumExport[],
  opts: { any: number; mes: number | null; title?: string }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "periode", label: "Període" },
    { key: "dies", label: "Dies" },
    { key: "baseDies", label: "Base dies" },
    { key: "productes", label: "Productes" },
    { key: "baseProd", label: "Base productes" },
    { key: "packs", label: "Packs" },
    { key: "basePacks", label: "Base packs" },
  ];

  const rows: ExportRow[] = resums.map((r) => ({
    descripcio: `${r.centreCodi} · ${r.centreNom}`,
    valors: [r.periodNom, r.dies, r.baseDies, r.productes, r.baseProductes, r.packs, r.basePacks],
  }));

  const periode = opts.mes != null ? `${opts.mes}/${opts.any}` : `Acumulat ${opts.any}`;

  return {
    filename: slugFilename(`dades-vendes-${periode}`),
    title: opts.title ?? "Vendes restaurants · resums",
    subtitle: periode,
    firstColLabel: "Centre",
    columns,
    rows,
    showTotal: false,
    sheetName: "Vendes",
  };
}

type AjustExport = {
  concepte: string;
  periodNom: string;
  centre: string | null;
  liniaNegoci: string | null;
  import_: number;
  motiu: string;
  autor: string;
  createdAt: string;
};

/** Llista d'ajustos manuals. */
export function ajustosToExportInforme(
  ajustos: AjustExport[],
  opts?: { title?: string }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "periode", label: "Període" },
    { key: "centre", label: "Centre" },
    { key: "ln", label: "Línia" },
    { key: "import", label: "Import" },
    { key: "motiu", label: "Motiu" },
    { key: "autor", label: "Autor" },
    { key: "data", label: "Data" },
  ];

  const rows: ExportRow[] = ajustos.map((a) => ({
    descripcio: a.concepte,
    valors: [
      a.periodNom,
      a.centre,
      a.liniaNegoci,
      a.import_,
      a.motiu,
      a.autor,
      a.createdAt.slice(0, 10),
    ],
  }));

  return {
    filename: slugFilename("dades-ajustos"),
    title: opts?.title ?? "Ajustos",
    subtitle: `${ajustos.length} ajust${ajustos.length !== 1 ? "os" : ""}`,
    firstColLabel: "Concepte",
    columns,
    rows,
    showTotal: false,
    sheetName: "Ajustos",
  };
}

/** Historial de càrregues de fitxer (cost / vendes). */
export function carreguesToExportInforme(
  items: CarregaFitxerLlistaItem[],
  opts: { title: string; filename: string }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "tipus", label: "Tipus" },
    { key: "periode", label: "Període" },
    { key: "registres", label: "Registres" },
    { key: "usuari", label: "Usuari" },
    { key: "data", label: "Data" },
  ];

  const rows: ExportRow[] = items.map((i) => ({
    descripcio: i.nomFitxer,
    valors: [i.tipusLabel, i.periodLabel, i.registres, i.usuari, i.createdAtLabel],
  }));

  return {
    filename: slugFilename(opts.filename),
    title: opts.title,
    subtitle: `${items.length} càrrega${items.length !== 1 ? "es" : ""}`,
    firstColLabel: "Fitxer",
    columns,
    rows,
    showTotal: false,
    sheetName: "Historial",
  };
}

type PeriodListItem = {
  nom: string;
  any: number;
  mes: number;
  estat: string | null;
  fitxer?: string | null;
};

/** Llista de períodes (repartiment / traspassos). */
export function periodesToExportInforme(
  items: PeriodListItem[],
  opts: { title: string; filename: string; withFitxer?: boolean }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "any", label: "Any" },
    { key: "mes", label: "Mes" },
    { key: "estat", label: "Estat" },
  ];
  if (opts.withFitxer) columns.push({ key: "fitxer", label: "Fitxer" });

  const rows: ExportRow[] = items.map((p) => ({
    descripcio: p.nom,
    valors: opts.withFitxer ? [p.any, p.mes, p.estat, p.fitxer ?? null] : [p.any, p.mes, p.estat],
  }));

  return {
    filename: slugFilename(opts.filename),
    title: opts.title,
    subtitle: `${items.length} període${items.length !== 1 ? "s" : ""}`,
    firstColLabel: "Període",
    columns,
    rows,
    showTotal: false,
    sheetName: "Períodes",
  };
}

/** Moviments d'una execució de traspass (fitxa del període). */
export function traspassMovimentsToExportInforme(
  moviments: {
    minuts?: number;
    hores: number;
    tarifaHora: number;
    import_: number;
    departament?: "SALA" | "CUINA";
    centreOrigen: { codi: string; nom: string };
    centreDesti: { codi: string; nom: string };
    departamentOrigen?: { codi: string; nom: string } | null;
    departamentDesti?: { codi: string; nom: string } | null;
  }[],
  opts: { periodNom: string; estat?: string; nomFitxer?: string | null }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "deptOrigen", label: "Dept. origen" },
    { key: "desti", label: "Destí" },
    { key: "deptDesti", label: "Dept. destí" },
    { key: "minuts", label: "Minuts" },
    { key: "hores", label: "Hores" },
    { key: "tarifa", label: "Tarifa €" },
    { key: "total", label: "Total €" },
  ];

  const rows: ExportRow[] = moviments.map((m) => ({
    descripcio: `${m.centreOrigen.codi} · ${m.centreOrigen.nom}`,
    valors: [
      etiquetaDepartamentArbre(m.departamentOrigen, m.departament),
      `${m.centreDesti.codi} · ${m.centreDesti.nom}`,
      etiquetaDepartamentArbre(m.departamentDesti),
      m.minuts ?? Math.round(m.hores * 60 * 100) / 100,
      m.hores,
      m.tarifaHora,
      m.import_,
    ],
  }));

  const subtitleParts = [
    opts.estat,
    opts.nomFitxer ? `Fitxer: ${opts.nomFitxer}` : null,
    `${moviments.length} moviment${moviments.length !== 1 ? "s" : ""}`,
  ].filter(Boolean);

  return {
    filename: slugFilename(`dades-traspass-${opts.periodNom}`),
    title: `Traspassos personal · ${opts.periodNom}`,
    subtitle: subtitleParts.join(" · "),
    firstColLabel: "Origen",
    columns,
    rows,
    showTotal: false,
    sheetName: "Moviments",
  };
}

/** Resum anual de traspassos (moviments origen→destí). */
export function traspassResumToExportInforme(resum: ResumTraspassPersonal): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "mes", label: "Mes" },
    { key: "origen", label: "Origen" },
    { key: "origenDept", label: "Dept. origen" },
    { key: "origenLn", label: "LN origen" },
    { key: "desti", label: "Destí" },
    { key: "destiDept", label: "Dept. destí" },
    { key: "destiLn", label: "LN destí" },
    { key: "minuts", label: "Minuts" },
    { key: "hores", label: "Hores" },
    { key: "import", label: "Import €" },
  ];

  const rows: ExportRow[] = resum.perCentre.map((f) => ({
    descripcio: f.periodNom,
    valors: [
      f.mes,
      `${f.origenCodi} · ${f.origenNom}`,
      f.origenDept,
      `${f.origenLnCodi} · ${f.origenLnNom}`,
      `${f.destiCodi} · ${f.destiNom}`,
      f.destiDept,
      `${f.destiLnCodi} · ${f.destiLnNom}`,
      f.minuts,
      f.hores,
      f.import_,
    ],
  }));

  return {
    filename: slugFilename(`dades-traspass-resum-${resum.any}`),
    title: "Resum traspassos de personal",
    subtitle: `Any ${resum.any} · volum ${resum.volumTraspassAny.toFixed(2)} €`,
    firstColLabel: "Període",
    columns,
    rows,
    showTotal: false,
    sheetName: "Traspassos",
  };
}

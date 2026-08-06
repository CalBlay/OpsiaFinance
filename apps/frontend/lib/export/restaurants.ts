import type { ComparativaRestaurants, InformeRestaurant } from "@/lib/cost-salarial/consultes";
import type { QuadreMandoRestaurants } from "@/lib/restaurants/quadre-mando";
import type {
  ComparativaVendes,
  InformeVendesRestaurant,
} from "@/lib/vendes-restaurants/consultes";
import { slugFilename } from "./filename";
import type { ExportColumn, ExportInforme, ExportRow } from "./types";

function n(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Quadre de comandament · una fila per restaurant (+ total). */
export function quadreToExportInforme(
  data: QuadreMandoRestaurants,
  opts?: { title?: string }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "vendesTpv", label: "Vendes TPV" },
    { key: "variacioPct", label: "Δ %" },
    { key: "costLaboral", label: "Personal €" },
    { key: "laborPct", label: "Personal %" },
    { key: "sala", label: "Sala €" },
    { key: "cuina", label: "Cuina €" },
    { key: "pctSala", label: "Sala %" },
    { key: "pctCuina", label: "Cuina %" },
    { key: "foodCost", label: "Compres €" },
    { key: "foodPct", label: "Compres %" },
    { key: "primePct", label: "Cost operatiu %" },
    { key: "ebitda", label: "EBITDA €" },
    { key: "ebitdaPct", label: "EBITDA %" },
    { key: "gapTpvPl", label: "Desviació TPV−P&L" },
  ];

  const toRow = (
    label: string,
    f: {
      vendesTpv: number | null;
      variacioPct: number | null;
      costLaboral: number | null;
      laborPct: number | null;
      sala: number | null;
      cuina: number | null;
      pctSala: number | null;
      pctCuina: number | null;
      foodCost: number | null;
      foodPct: number | null;
      primePct: number | null;
      ebitda: number | null;
      ebitdaPct: number | null;
      gapTpvPl: number | null;
      semafor?: string;
    },
    esSubtotal = false
  ): ExportRow => ({
    descripcio: f.semafor ? `${label} [${f.semafor}]` : label,
    valors: [
      n(f.vendesTpv),
      n(f.variacioPct),
      n(f.costLaboral),
      n(f.laborPct),
      n(f.sala),
      n(f.cuina),
      n(f.pctSala),
      n(f.pctCuina),
      n(f.foodCost),
      n(f.foodPct),
      n(f.primePct),
      n(f.ebitda),
      n(f.ebitdaPct),
      n(f.gapTpvPl),
    ],
    esSubtotal,
  });

  const rows: ExportRow[] = [
    ...data.files.map((f) => toRow(f.centre.etiqueta, { ...f, semafor: f.semafor }, false)),
    toRow("Total línia", { ...data.totals, semafor: data.totals.semafor }, true),
  ];

  const title = opts?.title ?? "Quadre de comandament · restaurants";
  return {
    filename: slugFilename(`quadre-mando-${data.periode}`),
    title,
    subtitle: data.periode,
    firstColLabel: "Restaurant",
    columns,
    rows,
    showTotal: false,
    sheetName: "Quadre",
  };
}

/** Cost salarial · comparativa multi-restaurant. */
export function costComparativaToExportInforme(
  data: ComparativaRestaurants,
  opts: { periode: string; title?: string }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "sala", label: "Sala" },
    { key: "pctSala", label: "% Sala" },
    { key: "cuina", label: "Cuina" },
    { key: "pctCuina", label: "% Cuina" },
    { key: "costTotal", label: "Cost total" },
    { key: "vendes", label: "Vendes" },
    { key: "pctVendes", label: "% / vendes" },
  ];

  const rows: ExportRow[] = [
    ...data.files.map((f) => ({
      descripcio: f.centre.etiqueta,
      valors: [
        f.sala,
        n(f.pctSala),
        f.cuina,
        n(f.pctCuina),
        f.costTotal,
        f.vendes,
        n(f.pctSobreVendes),
      ],
    })),
    {
      descripcio: "Total",
      valors: [
        data.totals.sala,
        data.totals.costTotal ? (data.totals.sala / data.totals.costTotal) * 100 : null,
        data.totals.cuina,
        data.totals.costTotal ? (data.totals.cuina / data.totals.costTotal) * 100 : null,
        data.totals.costTotal,
        data.totals.vendes,
        n(data.totals.pctSobreVendes),
      ],
      esSubtotal: true,
    },
  ];

  return {
    filename: slugFilename(`cost-salarial-comparativa-${opts.periode}`),
    title: opts.title ?? "Cost salarial · comparativa restaurants",
    subtitle: opts.periode,
    firstColLabel: "Restaurant",
    columns,
    rows,
    showTotal: false,
    sheetName: "Cost salarial",
  };
}

/** Cost salarial · detall d'un restaurant (partides). */
export function costInformeToExportInforme(
  data: InformeRestaurant,
  opts: { periode: string; title?: string }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "import", label: "Import" },
    { key: "pes", label: "Pes %" },
    { key: "sala", label: "Sala" },
    { key: "cuina", label: "Cuina" },
  ];

  const rows: ExportRow[] = [
    ...data.partidesTotals.map((p, i) => ({
      descripcio: p.label,
      valors: [
        p.import_,
        n(p.pct),
        data.sala.partides[i]?.import_ ?? 0,
        data.cuina.partides[i]?.import_ ?? 0,
      ],
    })),
    {
      descripcio: "Total",
      valors: [data.costTotal, 100, data.sala.total, data.cuina.total],
      esSubtotal: true,
    },
  ];

  return {
    filename: slugFilename(`cost-salarial-${data.centre.etiqueta}-${opts.periode}`),
    title: opts.title ?? `Cost salarial · ${data.centre.etiqueta}`,
    subtitle: `${data.centre.codi} · ${opts.periode}`,
    firstColLabel: "Partida",
    columns,
    rows,
    showTotal: false,
    sheetName: "Partides",
  };
}

/** Vendes · comparativa multi-restaurant. */
export function vendesComparativaToExportInforme(
  data: ComparativaVendes,
  opts?: { title?: string }
): ExportInforme {
  const columns: ExportColumn[] = [
    { key: "base", label: "Base TPV" },
    { key: "unitats", label: "Unitats" },
    { key: "baseAnt", label: "Base any ant." },
    { key: "variacioPct", label: "Δ %" },
    { key: "vendesPl", label: "Vendes P&L" },
    { key: "desviacioPl", label: "Desviació P&L" },
  ];

  const rows: ExportRow[] = [
    ...data.files.map((f) => ({
      descripcio: f.centre.etiqueta,
      valors: [f.base, f.unitats, n(f.baseAnt), n(f.variacioPct), f.vendesPl, n(f.desviacioPl)],
    })),
    {
      descripcio: "Total línia",
      valors: [
        data.totals.base,
        data.totals.unitats,
        n(data.totals.baseAnt),
        n(data.totals.variacioPct),
        data.totals.vendesPl,
        n(data.totals.desviacioPl),
      ],
      esSubtotal: true,
    },
  ];

  return {
    filename: slugFilename(`vendes-comparativa-${data.periode}`),
    title: opts?.title ?? "Vendes · comparativa restaurants",
    subtitle: data.periode,
    firstColLabel: "Restaurant",
    columns,
    rows,
    showTotal: false,
    sheetName: "Vendes",
  };
}

/** Vendes · un restaurant (evolució mensual o dies del mes). */
export function vendesInformeToExportInforme(
  data: InformeVendesRestaurant,
  opts?: { title?: string }
): ExportInforme {
  const isAny = data.ambit === "any";
  const columns: ExportColumn[] = isAny
    ? [
        { key: "base", label: "Base TPV" },
        { key: "unitats", label: "Unitats" },
      ]
    : [
        { key: "base", label: "Base TPV" },
        { key: "unitats", label: "Unitats" },
      ];

  const seriesRows: ExportRow[] = isAny
    ? data.evolucioMesos.map((m) => ({
        descripcio: m.etiqueta,
        valors: [m.base, m.unitats],
      }))
    : data.dies.map((d) => ({
        descripcio: d.dataIso,
        valors: [d.base, d.unitats],
      }));

  const rows: ExportRow[] = [
    {
      descripcio: "Resum període",
      valors: [data.base, data.unitats],
      esSubtotal: true,
    },
    {
      descripcio: "Any anterior",
      valors: [n(data.baseAnt), null],
    },
    {
      descripcio: "Variació %",
      valors: [n(data.variacioPct), null],
    },
    {
      descripcio: "Vendes P&L",
      valors: [data.vendesPl, null],
    },
    {
      descripcio: "Desviació P&L",
      valors: [n(data.desviacioPl), null],
    },
    ...seriesRows,
  ];

  return {
    filename: slugFilename(`vendes-${data.centre.etiqueta}-${data.periode}`),
    title: opts?.title ?? `Vendes · ${data.centre.etiqueta}`,
    subtitle: `${data.centre.codi} · ${data.periode}`,
    firstColLabel: isAny ? "Mes" : "Dia",
    columns,
    rows,
    showTotal: false,
    sheetName: "Vendes",
  };
}

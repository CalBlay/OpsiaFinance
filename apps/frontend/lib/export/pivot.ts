import type { ExportColumn, ExportInforme, ExportRow } from "./types";

type PivotLikeColumn = { key: string; label: string; sublabel?: string };
type PivotLikeRow = {
  descripcio: string;
  valors: number[];
  total: number;
  esSubtotal?: boolean;
};

/** Converteix un pivot de consultes al payload compartit d'exportació. */
export function pivotToExportInforme(input: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: PivotLikeColumn[];
  rows: PivotLikeRow[];
  firstColLabel?: string;
  showTotal?: boolean;
  totalLabel?: string;
  sheetName?: string;
}): ExportInforme {
  const columns: ExportColumn[] = input.columns.map((c) => ({
    key: c.key,
    label: c.label,
    sublabel: c.sublabel,
  }));
  const rows: ExportRow[] = input.rows.map((r) => ({
    descripcio: r.descripcio,
    valors: r.valors,
    total: r.total,
    esSubtotal: r.esSubtotal,
  }));

  return {
    filename: input.filename,
    title: input.title,
    subtitle: input.subtitle,
    firstColLabel: input.firstColLabel ?? "Concepte",
    columns,
    rows,
    showTotal: input.showTotal ?? true,
    totalLabel: input.totalLabel ?? "Total",
    sheetName: input.sheetName,
  };
}

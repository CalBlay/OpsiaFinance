/** Columna d'un informe tabular exportable. */
export interface ExportColumn {
  key: string;
  label: string;
  /** Etiqueta secundària (p.ex. nom de LN sota el codi). */
  sublabel?: string;
}

/** Valor de cel·la: número, text curt o buit. */
export type ExportCell = number | string | null;

/** Fila d'un informe tabular (compatible amb pivots de consultes). */
export interface ExportRow {
  descripcio: string;
  valors: ExportCell[];
  /** Opcional si `showTotal` és false o la fila ja és un total. */
  total?: number | null;
  esSubtotal?: boolean;
}

/** Payload únic que consumeixen XLSX i PDF/impressió. */
export interface ExportInforme {
  /** Nom base del fitxer sense extensió. */
  filename: string;
  title: string;
  subtitle?: string;
  firstColLabel?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  showTotal?: boolean;
  totalLabel?: string;
  /** Nom del full Excel (màx. 31 caràcters). */
  sheetName?: string;
}

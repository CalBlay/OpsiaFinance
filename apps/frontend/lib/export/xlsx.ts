import { withExtension } from "./filename";
import type { ExportCell, ExportInforme } from "./types";

type XlsxMod = typeof import("xlsx");

function columnHeader(label: string, sublabel?: string): string {
  return sublabel ? `${label} · ${sublabel}` : label;
}

function excelCell(v: ExportCell): string | number | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Informe";
}

async function loadXlsx(): Promise<XlsxMod> {
  const mod = await import("xlsx");
  // Alguns bundlers (Next/ESM) exposen la API a `.default`
  return ((mod as { default?: XlsxMod }).default ?? mod) as XlsxMod;
}

function buildWorkbook(XLSX: XlsxMod, informe: ExportInforme) {
  const firstCol = informe.firstColLabel ?? "Concepte";
  const showTotal = informe.showTotal !== false;
  const aoa: (string | number | null)[][] = [];

  aoa.push([informe.title]);
  if (informe.subtitle) aoa.push([informe.subtitle]);
  aoa.push([`Generat: ${new Date().toLocaleString("ca-ES")}`]);
  aoa.push([]);

  const header: (string | number | null)[] = [
    firstCol,
    ...informe.columns.map((c) => columnHeader(c.label, c.sublabel)),
  ];
  if (showTotal) header.push(informe.totalLabel ?? "Total");
  aoa.push(header);

  for (const row of informe.rows) {
    const line: (string | number | null)[] = [row.descripcio];
    for (let i = 0; i < informe.columns.length; i++) {
      line.push(excelCell(row.valors[i] ?? null));
    }
    if (showTotal) {
      line.push(excelCell(row.total ?? null));
    }
    aoa.push(line);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = Array.from({ length: header.length }, (_, i) => ({
    wch: i === 0 ? 36 : 14,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(informe.sheetName ?? "Informe"));
  return wb;
}

/** Bytes .xlsx (còpia independent de l'ArrayBuffer). */
export async function buildXlsxBytes(informe: ExportInforme): Promise<Uint8Array> {
  const XLSX = await loadXlsx();
  const wb = buildWorkbook(XLSX, informe);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true });
  // Còpia explícita: evita vistes parcials d'ArrayBuffer que corrompen el Blob
  return Uint8Array.from(out as ArrayLike<number>);
}

/** Genera i descarrega l'Excel de l'informe. */
export async function downloadXlsx(informe: ExportInforme): Promise<void> {
  const XLSX = await loadXlsx();
  const wb = buildWorkbook(XLSX, informe);
  const filename = withExtension(informe.filename, "xlsx");

  // writeFile al navegador gestiona el download sense corrompre el ZIP intern
  XLSX.writeFile(wb, filename, { bookType: "xlsx", compression: true });
}

import { formatNum } from "@/lib/utils";
import type { ExportCell, ExportInforme } from "./types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnHeader(label: string, sublabel?: string): string {
  return sublabel ? `${label} · ${sublabel}` : label;
}

function formatPrintCell(v: ExportCell): { text: string; neg: boolean } {
  if (v == null || v === "") return { text: "–", neg: false };
  if (typeof v === "string") return { text: v, neg: false };
  if (!Number.isFinite(v)) return { text: "–", neg: false };
  if (v === 0) return { text: "–", neg: false };
  const decimals = Number.isInteger(v) ? 0 : 1;
  return { text: formatNum(v, decimals), neg: v < 0 };
}

function buildPrintHtml(informe: ExportInforme): string {
  const firstCol = informe.firstColLabel ?? "Concepte";
  const showTotal = informe.showTotal !== false;
  const generated = new Date().toLocaleString("ca-ES");

  const headCells = [
    `<th class="left">${escapeHtml(firstCol)}</th>`,
    ...informe.columns.map((c) => `<th>${escapeHtml(columnHeader(c.label, c.sublabel))}</th>`),
  ];
  if (showTotal) {
    headCells.push(`<th>${escapeHtml(informe.totalLabel ?? "Total")}</th>`);
  }

  const bodyRows = informe.rows
    .map((row) => {
      const cls = row.esSubtotal ? ' class="subtotal"' : "";
      const cells = [
        `<td class="left">${escapeHtml(row.descripcio)}</td>`,
        ...informe.columns.map((_, i) => {
          const { text, neg } = formatPrintCell(row.valors[i] ?? null);
          return `<td${neg ? ' class="neg"' : ""}>${escapeHtml(text)}</td>`;
        }),
      ];
      if (showTotal) {
        const { text, neg } = formatPrintCell(row.total ?? null);
        cells.push(`<td${neg ? ' class="neg"' : ""}>${escapeHtml(text)}</td>`);
      }
      return `<tr${cls}>${cells.join("")}</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(informe.title)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Calibri, Arial, sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 16px;
      font-size: 10pt;
    }
    .brand {
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475569;
      margin: 0 0 0.35rem;
    }
    h1 {
      font-size: 16pt;
      font-weight: 700;
      margin: 0 0 0.25rem;
      letter-spacing: -0.01em;
    }
    .meta {
      font-size: 9pt;
      color: #64748b;
      margin: 0 0 1rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 0.28rem 0.4rem;
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    th {
      background: #f1f5f9;
      font-size: 8.5pt;
      font-weight: 700;
      color: #5c6b73;
    }
    td.left, th.left {
      text-align: left;
      white-space: normal;
      min-width: 12rem;
    }
    tr.subtotal td {
      font-weight: 700;
      background: #f8fafc;
    }
    td.neg { color: #c0392b; }
    .footer {
      margin-top: 0.85rem;
      font-size: 8pt;
      color: #94a3b8;
    }
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <p class="brand">OpsiaFinance</p>
  <h1>${escapeHtml(informe.title)}</h1>
  <p class="meta">
    ${informe.subtitle ? `${escapeHtml(informe.subtitle)} · ` : ""}Generat ${escapeHtml(generated)}
  </p>
  <table>
    <thead><tr>${headCells.join("")}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p class="footer">Document generat automàticament · OpsiaFinance</p>
  <script>
    function goPrint() {
      try { window.focus(); } catch (e) {}
      setTimeout(function () { window.print(); }, 250);
    }
    if (document.readyState === "complete") goPrint();
    else window.addEventListener("load", goPrint);
  </script>
</body>
</html>`;
}

/**
 * Obre una vista d'impressió corporativa (l'usuari pot desar com a PDF).
 * Retorna false si el navegador bloqueja la finestra emergent.
 */
export function printInforme(informe: ExportInforme): boolean {
  const html = buildPrintHtml(informe);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Sense noopener: necessitem que la pestanya carregui el Blob correctament.
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    return false;
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

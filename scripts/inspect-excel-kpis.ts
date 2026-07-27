/**
 * Inspecció d'Excel per planificació KPI.
 * Executar: npx tsx scripts\inspect-excel-kpis.ts
 */
import { readFileSync } from "node:fs";
import { type WorkBook, read, utils } from "xlsx";

const FILES = [
  {
    key: "hores",
    path: "C:/dev/OpsiaFinance/Hores Centres Treball.xlsx",
    mode: "first" as const,
  },
  {
    key: "quadre",
    path: "C:/dev/OpsiaFinance/Quadre mando RTE.xlsx",
    mode: "all" as const,
  },
];

function preview(wb: WorkBook, sheetName: string, maxRows = 22, maxCols = 14) {
  const sheet = wb.Sheets[sheetName];
  const matrix = utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as (string | number | null)[][];

  const rows = matrix.slice(0, maxRows).map((row, i) => {
    const cells = (row ?? []).slice(0, maxCols).map((c) => {
      if (c === null || c === undefined) return "";
      const s = String(c).trim();
      return s.length > 45 ? `${s.slice(0, 42)}...` : s;
    });
    return { row: i + 1, cells };
  });

  return {
    rows: matrix.length,
    cols: Math.max(...matrix.map((r) => r?.length ?? 0), 0),
    merges: (sheet["!merges"] ?? []).slice(0, 10).map((m) => utils.encode_range(m)),
    preview: rows,
  };
}

function guessHeader(matrix: (string | number | null)[][]) {
  let best = 0;
  let score = 0;
  for (let i = 0; i < Math.min(12, matrix.length); i++) {
    const s = (matrix[i] ?? []).filter((c) => c != null && String(c).trim()).length;
    if (s > score) {
      score = s;
      best = i;
    }
  }
  return {
    row: best + 1,
    headers: (matrix[best] ?? []).map((c) => (c == null ? "" : String(c).trim())),
  };
}

function pickMain(names: string[]) {
  for (const p of ["quadre", "mando", "dashboard", "resum", "principal", "rte"]) {
    const hit = names.find((n) => n.toLowerCase().includes(p));
    if (hit) return hit;
  }
  return names[0];
}

console.log("=".repeat(80));
console.log("ANALISI EXCEL - OpsiaFinance");
console.log("=".repeat(80));

for (const file of FILES) {
  console.log("\n" + "#".repeat(80));
  console.log(`FITXER: ${file.path}`);
  console.log("#".repeat(80));

  try {
    const wb = read(readFileSync(file.path));
    console.log("Fulls:", wb.SheetNames.join(" | "));

    if (file.mode === "first") {
      const name = wb.SheetNames[0];
      const matrix = utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[name], {
        header: 1,
        defval: null,
      }) as (string | number | null)[][];
      const hdr = guessHeader(matrix);
      const p = preview(wb, name);

      console.log(`\n--- PRIMERA PESTANYA: "${name}" ---`);
      console.log(`Dimensions: ${p.rows} files x ${p.cols} columnes`);
      if (p.merges.length) console.log("Cel·les fusionades:", p.merges.join(", "));
      console.log(`Capçalera detectada (fila ${hdr.row}):`);
      console.log(hdr.headers.filter(Boolean).slice(0, 14).join(" | "));
      console.log("\nPrimers 22 rows:");
      for (const r of p.preview) {
        if (r.cells.some(Boolean)) {
          console.log(`  ${String(r.row).padStart(2)}: ${r.cells.join(" | ")}`);
        }
      }
    } else {
      console.log("\n--- RESUM DE TOTS ELS FULLS ---");
      for (const name of wb.SheetNames) {
        const matrix = utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[name], {
          header: 1,
          defval: null,
        }) as (string | number | null)[][];
        const hdr = guessHeader(matrix);
        console.log(
          `  [${name}] ${matrix.length}x${Math.max(...matrix.map((r) => r?.length ?? 0), 0)} | capçalera fila ${hdr.row}: ${hdr.headers.filter(Boolean).slice(0, 8).join(" | ")}`
        );
      }

      const main = pickMain(wb.SheetNames);
      const matrix = utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[main], {
        header: 1,
        defval: null,
      }) as (string | number | null)[][];
      const hdr = guessHeader(matrix);
      const p = preview(wb, main, 25);

      console.log(`\n--- FULL PRINCIPAL: "${main}" ---`);
      console.log(`Dimensions: ${p.rows} files x ${p.cols} columnes`);
      if (p.merges.length) console.log("Cel·les fusionades:", p.merges.join(", "));
      console.log(`Capçalera detectada (fila ${hdr.row}):`);
      console.log(hdr.headers.filter(Boolean).slice(0, 14).join(" | "));
      console.log("\nPrimers 25 rows:");
      for (const r of p.preview) {
        if (r.cells.some(Boolean)) {
          console.log(`  ${String(r.row).padStart(2)}: ${r.cells.join(" | ")}`);
        }
      }
    }
  } catch (err) {
    console.log("ERROR:", err);
  }
}

console.log("\n" + "=".repeat(80));
console.log("FI. Copia tot el text d'aquesta finestra i enganxa'l al xat.");
console.log("=".repeat(80));

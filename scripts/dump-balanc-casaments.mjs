/**
 * Dump estructural del Balanç Casaments (fila 49+).
 * Executar des de apps/frontend (on hi ha xlsx):
 *   node ../../scripts/dump-balanc-casaments.mjs
 * o:
 *   node --experimental-modules scripts/dump-balanc-casaments.mjs
 * amb NODE_PATH apuntant a node_modules amb xlsx.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const target =
  process.argv[2] ??
  path.join(root, "12_2024 BALANÇ CASAMENTS Total.xlsx");

const requireCandidates = [
  path.join(root, "apps", "frontend", "node_modules"),
  path.join(root, "node_modules"),
  path.join(root, "apps", "frontend"),
];

let XLSX;
for (const base of requireCandidates) {
  try {
    const req = createRequire(path.join(base, "package.json"));
    XLSX = req("xlsx");
    break;
  } catch {
    try {
      const req = createRequire(path.join(base, "xlsx", "package.json"));
      XLSX = req(".");
      break;
    } catch {
      /* next */
    }
  }
}

if (!XLSX) {
  console.error("No s'ha trobat el paquet xlsx. Executa des de apps/frontend o instal·la xlsx.");
  process.exit(1);
}

console.log("EXISTS", fs.existsSync(target), target);
if (!fs.existsSync(target)) process.exit(1);

const wb = XLSX.read(fs.readFileSync(target), { cellDates: true });
console.log("SHEETS", JSON.stringify(wb.SheetNames));

const outDir = path.join(root, "scripts", "out");
fs.mkdirSync(outDir, { recursive: true });

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const summary = {
    sheetName,
    ref: ws["!ref"],
    totalRows: matrix.length,
    previewRows40to120: matrix.slice(39, 120).map((row, i) => ({
      row: i + 40,
      cells: (row ?? []).slice(0, 25),
    })),
    row49: { row: 49, cells: (matrix[48] ?? []).slice(0, 25) },
    firstNonEmptyRows: matrix
      .map((row, i) => ({ row: i + 1, cells: row }))
      .filter((r) => (r.cells ?? []).some((c) => c !== null && String(c).trim() !== ""))
      .slice(0, 15),
  };
  const outPath = path.join(outDir, `balanc-casaments-${sheetName.replace(/[^\w.-]+/g, "_")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
  console.log("WROTE", outPath);
}

console.log("DONE");

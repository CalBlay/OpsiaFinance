/**
 * Test del parser PyG Mensual per Centres.
 * Executa: node scripts/test-parser.mjs Restaurants_26.xlsx
 */

import { readFileSync } from "fs";
import { read, utils } from "xlsx";

const filePath = process.argv[2] ?? "Restaurants_26.xlsx";
const SKIP_SHEETS = new Set(["REST"]);

const workbook = read(readFileSync(filePath));
const rows = [];

for (const sheetName of workbook.SheetNames) {
  if (SKIP_SHEETS.has(sheetName)) continue;

  const sheet  = workbook.Sheets[sheetName];
  const matrix = utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (matrix.length < 3) continue;

  const centreNom = String(matrix[0]?.[0] ?? sheetName).trim();

  for (let rowIdx = 2; rowIdx < matrix.length; rowIdx++) {
    const row       = matrix[rowIdx];
    const nomCompte = String(row?.[0] ?? "").trim();
    if (!nomCompte) continue;

    // Columnes 1-12 = Gener-Desembre
    for (let col = 1; col <= 12; col++) {
      const rawVal = row?.[col];
      if (rawVal === null || rawVal === undefined) continue;
      const valor = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
      if (isNaN(valor) || valor === 0) continue;

      rows.push({ sheetName, centreNom, nomCompte, mes: col, import_: valor });
    }
  }
}

console.log(`\nTotal files generades: ${rows.length}`);
console.log(`Centres detectats: ${[...new Set(rows.map(r => r.sheetName))].join(", ")}`);
console.log("\nPrimeres 10 files:");
rows.slice(0, 10).forEach((r, i) => {
  console.log(`  ${i+1}. [${r.sheetName}] mes=${r.mes} compte="${r.nomCompte}" import=${r.import_}`);
});

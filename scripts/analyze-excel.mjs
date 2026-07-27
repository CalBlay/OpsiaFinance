/**
 * Script d'anàlisi d'Excel per OpsiaFinance.
 * Executa: node scripts/analyze-excel.mjs <ruta-fitxer.xlsx>
 */

import { readFileSync } from "fs";
import { read, utils } from "xlsx";

const filePath = process.argv[2] ?? "Restaurants_26.xlsx";
const workbook = read(readFileSync(filePath));

console.log("\n═══════════════════════════════════════");
console.log("  ANÀLISI RAW:", filePath);
console.log("═══════════════════════════════════════\n");

// Mostra NOMÉS el primer full amb detall màxim
const sheetName = workbook.SheetNames[1]; // "Nautic" (index 1)
const sheet = workbook.Sheets[sheetName];

console.log(`FULL: "${sheetName}"\n`);

// Mostra les primeres 10 files com a array raw
const rows = utils.sheet_to_json(sheet, { header: 1, defval: null });
console.log("=== ARRAYS CRUS (files 1-12) ===");
rows.slice(0, 12).forEach((row, i) => {
  console.log(`\nFila ${i + 1} (${row.length} cel·les):`);
  row.slice(0, 6).forEach((cell, j) => {
    console.log(`  [${j}] type=${typeof cell} value=${JSON.stringify(cell)}`);
  });
});

// Mostra també amb header: A (noms de columna Excel)
console.log("\n=== AMB header:A ===");
const rowsA = utils.sheet_to_json(sheet, { header: "A", defval: null });
if (rowsA.length > 0) {
  console.log("Claus de la primera fila:", Object.keys(rowsA[0]));
  console.log("Valors fila 1:", JSON.stringify(rowsA[0]).substring(0, 200));
  console.log("Valors fila 3:", JSON.stringify(rowsA[2]).substring(0, 200));
}

// Mostra range de cel·les
const range = sheet["!ref"];
console.log("\nRange del full:", range);

import { readFileSync } from "fs";
import { read, utils } from "xlsx";

const FILE = "01_2026.xlsx";
const wb = read(readFileSync(FILE));

console.log("═".repeat(80));
console.log(`  FITXER: ${FILE}`);
console.log("═".repeat(80));
console.log(`  Fulls (${wb.SheetNames.length}): ${wb.SheetNames.join(" | ")}\n`);

for (const sName of wb.SheetNames) {
  const sheet = wb.Sheets[sName];
  const range = sheet["!ref"] ?? "buit";
  const rows = utils.sheet_to_json(sheet, { header: 1, defval: null });

  console.log("\n" + "─".repeat(80));
  console.log(`  FULL: "${sName}"  ·  rang: ${range}  ·  files: ${rows.length}`);
  console.log("─".repeat(80));

  // Capçaleres: primeres 12 files, totes les columnes fins a la 20
  const maxRows = Math.min(rows.length, 45);
  for (let i = 0; i < maxRows; i++) {
    const row = rows[i] ?? [];
    const cells = [];
    for (let j = 0; j < 20; j++) {
      const v = row[j];
      if (v === null || v === undefined || v === "") continue;
      const colLetter = utils.encode_col(j); // A, B, C...
      cells.push(`${colLetter}=${String(v).substring(0, 22)}`);
    }
    if (cells.length) console.log(`  F${String(i + 1).padStart(3, "0")}: ${cells.join("  |  ")}`);
  }
  if (rows.length > maxRows) console.log(`  ... (${rows.length - maxRows} files més)`);
}

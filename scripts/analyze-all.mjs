import { readFileSync } from "fs";
import { read, utils } from "xlsx";

const files = [
  "Arbre de dimensions V030226.xlsx",
  "Conversio.xlsx",
  "01_2026.xlsx",
];

for (const fileName of files) {
  console.log("\n" + "═".repeat(60));
  console.log(`  FITXER: ${fileName}`);
  console.log("═".repeat(60));

  let wb;
  try { wb = read(readFileSync(fileName)); }
  catch (e) { console.log(`  ERROR: ${e.message}`); continue; }

  console.log(`  Fulls: ${wb.SheetNames.join(", ")}\n`);

  for (const sName of wb.SheetNames) {
    const sheet = wb.Sheets[sName];
    const range = sheet["!ref"] ?? "buit";
    const rows  = utils.sheet_to_json(sheet, { header: 1, defval: null });

    console.log(`  ── Full: "${sName}" (rang: ${range}, files: ${rows.length})`);

    // Primeres 5 files, primeres 10 columnes
    rows.slice(0, 5).forEach((row, i) => {
      const cells = (row ?? []).slice(0, 10).map((c, j) => {
        const v = c === null ? "∅" : String(c).substring(0, 18);
        return `[${j}]${v}`;
      });
      console.log(`    Fila ${i + 1}: ${cells.join("  ")}`);
    });

    if (rows.length > 5) console.log(`    ... (${rows.length - 5} files més)`);
    console.log();
  }
}

import { readFileSync } from "fs";
import { read, utils } from "xlsx";

const wb = read(readFileSync("Arbre de dimensions V030226.xlsx"));

console.log("Fulls:", wb.SheetNames.join(", "));

for (const sName of wb.SheetNames) {
  const sheet = wb.Sheets[sName];
  const rows  = utils.sheet_to_json(sheet, { header: 1, defval: null });

  console.log(`\n${"═".repeat(70)}`);
  console.log(`  Full: "${sName}" — ${rows.length} files`);
  console.log("═".repeat(70));

  // Totes les files (màx 300), primeres 15 columnes
  rows.slice(0, 300).forEach((row, i) => {
    const cells = (row ?? []).slice(0, 15).map((c, j) => {
      if (c === null || c === undefined || c === "") return null;
      return `[${j}]${String(c).substring(0, 25)}`;
    }).filter(Boolean);

    if (cells.length > 0) {
      console.log(`  F${String(i + 1).padStart(3, "0")}: ${cells.join("  ")}`);
    }
  });

  if (rows.length > 300) console.log(`  ... (${rows.length - 300} files més no mostrades)`);
}

const X = require("xlsx");
const path = require("node:path");
const fs = require("node:fs");

const file = path.resolve(__dirname, "../../Cost_Personal_07_26.xlsx");
if (!fs.existsSync(file)) {
  console.error("MISSING", file);
  process.exit(1);
}
const wb = X.readFile(file, { cellDates: true });
console.log("SHEETS", wb.SheetNames);
const name = wb.SheetNames[0];
const s = wb.Sheets[name];
const raw = X.utils.sheet_to_json(s, { header: 1, defval: null, raw: true });
const text = X.utils.sheet_to_json(s, { header: 1, defval: null, raw: false });
console.log("ROWS", raw.length, "COLS sample", (raw[0] || []).length);
for (let i = 0; i < Math.min(35, raw.length); i++) {
  const r = raw[i] || [];
  const t = text[i] || [];
  const slice = [];
  for (let c = 0; c < Math.min(8, Math.max(r.length, t.length)); c++) {
    slice.push({ raw: r[c], text: t[c] });
  }
  console.log("--- row", i, "---");
  console.log(JSON.stringify(slice));
}

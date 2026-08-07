const path = require("node:path");
const fs = require("node:fs");
const XLSX = require("xlsx");

const FILE = path.resolve(__dirname, "../../../Cost_Personal_07_26.xlsx");
console.log("FILE", FILE, fs.existsSync(FILE));
const wb = XLSX.readFile(FILE, { cellDates: true });
console.log("SHEETS", wb.SheetNames);
const name = wb.SheetNames[0];
const sheet = wb.Sheets[name];
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
const text = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
console.log("ROWS", raw.length, "COLS", Math.max(...raw.slice(0, 30).map((r) => (r || []).length)));

for (let i = 0; i < Math.min(20, raw.length); i++) {
  const cells = [];
  const r = raw[i] || [];
  const t = text[i] || [];
  for (let c = 0; c < Math.max(r.length, t.length, 14); c++) {
    if (r[c] == null && (t[c] == null || t[c] === "")) continue;
    cells.push(`c${c}:{raw:${JSON.stringify(r[c])},txt:${JSON.stringify(t[c])}}`);
  }
  console.log("---", i, "---");
  console.log(cells.join(" | "));
}

// Find header
for (let i = 0; i < 30; i++) {
  const row = (text[i] || []).map((x) => String(x || "").toLowerCase());
  const joined = row.join(" | ");
  if (joined.includes("bruto") || joined.includes("brut") || joined.includes("seguridad")) {
    console.log("HEADER ROW", i, joined.slice(0, 500));
    row.forEach((h, c) => {
      if (h) console.log("  ", c, h.slice(0, 60));
    });
  }
}

// Find Total Empresa and huge amounts
console.log("\n=== TOTALS / HUGE ===");
for (let i = 0; i < raw.length; i++) {
  const desc = String((text[i] || [])[0] ?? (raw[i] || [])[0] ?? "");
  const nums = [];
  for (let c = 0; c < (raw[i] || []).length; c++) {
    const n = Number((raw[i] || [])[c]);
    if (Number.isFinite(n) && Math.abs(n) > 500000) nums.push([c, n]);
  }
  if (/total/i.test(desc) || nums.length) {
    if (/total/i.test(desc) || nums.some(([, n]) => Math.abs(n) > 800000)) {
      console.log(`R${i}`, desc.slice(0, 80), nums);
    }
  }
}

// Column sums for 9-12
const sums = { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0 };
let counted = 0;
for (let i = 10; i < raw.length; i++) {
  const r = raw[i] || [];
  let any = false;
  for (const c of Object.keys(sums)) {
    const n = Number(r[c]);
    if (Number.isFinite(n) && Math.abs(n) > 0.5) {
      sums[c] += Math.abs(n);
      any = true;
    }
  }
  if (any) counted++;
}
console.log("\nSUM cols 8-13 over rows with amounts", counted, sums);

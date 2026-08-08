import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Inventari fi de compres / aprovisionaments Cal Blay ↔ FDLC.
 *
 * Mira:
 *  - FDLC (LN00007): nodes 7 Compres, 8 Altres aprovisionaments, 9 Consums interns
 *  - CCR00008 (Font de la Canya): mateixos nodes
 *  - LN00000 Central: tots els centres, nodes 7/8/9
 *  - Coincidències |import| per mes (exacte i amb tolerància)
 *
 *   cd C:\dev\OpsiaFinance
 *   npx tsx scripts/inventari-compres-fdlc.ts --any=2026
 */
import { config } from "dotenv";

config({ path: "apps/frontend/.env.local" });
config({ path: ".env.local" });
config({ path: ".env" });

const FDLC_LN = "LN00007";
const CENTRAL_LN = "LN00000";
const MIRALL = "CCR00008";
const NODES = [7, 8, 9] as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definit");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseArgs() {
  const anyArg = process.argv.find((a) => a.startsWith("--any="));
  return { any: anyArg ? Number(anyArg.split("=")[1]) : 2026 };
}

type Cell = {
  any: number;
  mes: number;
  node: number;
  lnCodi: string;
  centreCodi: string | null;
  centreNom: string | null;
  import: number;
  cara: "fdlc" | "mirall" | "central" | "altre_cb";
};

async function main() {
  const { any } = parseArgs();
  console.log(`Inventari compres Cal Blay ↔ FDLC · any=${any}\n`);

  const [lnCentral, lnFdlc, mirall, centresCentral] = await Promise.all([
    db.liniaNegoci.findUnique({ where: { codi: CENTRAL_LN }, select: { id: true, nom: true } }),
    db.liniaNegoci.findUnique({
      where: { codi: FDLC_LN },
      include: { centres: { select: { codi: true, nom: true } } },
    }),
    db.centre.findFirst({
      where: { codi: MIRALL },
      include: { liniaNegoci: { select: { codi: true, nom: true } } },
    }),
    db.centre.findMany({
      where: { liniaNegoci: { codi: CENTRAL_LN } },
      select: { codi: true, nom: true },
      orderBy: { codi: "asc" },
    }),
  ]);

  console.log("=== Perimeter ===");
  console.log(
    `LN00000 Central: ${lnCentral?.nom ?? "?"} · centres: ${centresCentral.map((c) => `${c.codi}(${c.nom})`).join(", ")}`
  );
  console.log(
    `CCR00008: ${mirall ? `${mirall.nom} · LN pròpia ${mirall.liniaNegoci.codi}` : "NO TROBAT"}`
  );
  console.log(
    `LN00007 FDLC: ${lnFdlc?.nom ?? "?"} · centres: ${lnFdlc?.centres.map((c) => c.codi).join(", ") ?? "-"}`
  );
  console.log(
    "Nota mapeig FDLC: comptes 600/601→node 7 Compres; 602→node 8 Altres aprovisionaments; no hi ha node 9 al P&L hotel.\n"
  );

  const dades = await db.dadaResultat.findMany({
    where: {
      period: { any },
      import_: { not: 0 },
      concepteResultat: { node: { in: [...NODES] } },
    },
    select: {
      import_: true,
      senseCentre: true,
      period: { select: { any: true, mes: true } },
      concepteResultat: { select: { node: true } },
      centre: {
        select: { codi: true, nom: true, liniaNegoci: { select: { codi: true } } },
      },
      liniaNegoci: { select: { codi: true } },
      importacio: { select: { liniaNegoci: { select: { codi: true } } } },
    },
  });

  const cells: Cell[] = [];
  for (const d of dades) {
    const lnCodi =
      d.liniaNegoci?.codi ?? d.importacio.liniaNegoci?.codi ?? d.centre?.liniaNegoci.codi ?? "?";
    const centreCodi = d.centre?.codi ?? (d.senseCentre ? "(sense centre)" : null);
    let cara: Cell["cara"] = "altre_cb";
    if (lnCodi === FDLC_LN) cara = "fdlc";
    else if (centreCodi === MIRALL) cara = "mirall";
    else if (lnCodi === CENTRAL_LN) cara = "central";

    cells.push({
      any: d.period.any,
      mes: d.period.mes,
      node: d.concepteResultat.node,
      lnCodi,
      centreCodi,
      centreNom: d.centre?.nom ?? null,
      import: Number(d.import_),
      cara,
    });
  }

  // Agregar
  const agg = new Map<string, Cell>();
  for (const c of cells) {
    const k = `${c.mes}|${c.node}|${c.lnCodi}|${c.centreCodi ?? ""}|${c.cara}`;
    const prev = agg.get(k);
    if (prev) prev.import = round2(prev.import + c.import);
    else agg.set(k, { ...c });
  }
  const rows = [...agg.values()].filter((r) => r.import !== 0);

  const byMes = (filtre: (r: Cell) => boolean, node: number) => {
    const m = new Map<number, number>();
    for (const r of rows) {
      if (!filtre(r) || r.node !== node) continue;
      m.set(r.mes, round2((m.get(r.mes) ?? 0) + r.import));
    }
    return m;
  };

  const mesos = [...new Set(rows.map((r) => r.mes))].sort((a, b) => a - b);

  const series = {
    fdlc7: byMes((r) => r.cara === "fdlc", 7),
    fdlc8: byMes((r) => r.cara === "fdlc", 8),
    fdlc9: byMes((r) => r.cara === "fdlc", 9),
    mirall7: byMes((r) => r.cara === "mirall", 7),
    mirall8: byMes((r) => r.cara === "mirall", 8),
    mirall9: byMes((r) => r.cara === "mirall", 9),
    central7: byMes((r) => r.cara === "central", 7),
    central8: byMes((r) => r.cara === "central", 8),
    central9: byMes((r) => r.cara === "central", 9),
  };

  console.log("=== Taula mensual (imports) ===");
  const tabla = mesos.map((mes) => ({
    mes,
    FDLC_7: series.fdlc7.get(mes) ?? 0,
    FDLC_8: series.fdlc8.get(mes) ?? 0,
    FDLC_9: series.fdlc9.get(mes) ?? 0,
    CCR08_7: series.mirall7.get(mes) ?? 0,
    CCR08_8: series.mirall8.get(mes) ?? 0,
    CCR08_9: series.mirall9.get(mes) ?? 0,
    LN00000_7: series.central7.get(mes) ?? 0,
    LN00000_8: series.central8.get(mes) ?? 0,
    LN00000_9: series.central9.get(mes) ?? 0,
  }));
  console.table(tabla);

  console.log("\n=== Totals any ===");
  const sumMap = (m: Map<number, number>) => round2([...m.values()].reduce((a, b) => a + b, 0));
  console.table([
    { cara: "FDLC node 7 Compres", total: sumMap(series.fdlc7) },
    { cara: "FDLC node 8 Altres aprov.", total: sumMap(series.fdlc8) },
    { cara: "FDLC node 9 Consums interns", total: sumMap(series.fdlc9) },
    { cara: "CCR00008 node 7", total: sumMap(series.mirall7) },
    { cara: "CCR00008 node 8", total: sumMap(series.mirall8) },
    { cara: "CCR00008 node 9", total: sumMap(series.mirall9) },
    { cara: "LN00000 node 7 (tots centres)", total: sumMap(series.central7) },
    { cara: "LN00000 node 8", total: sumMap(series.central8) },
    { cara: "LN00000 node 9", total: sumMap(series.central9) },
  ]);

  console.log("\n=== LN00000 · desglossament per centre (nodes 7/8/9, total any) ===");
  const perCentreCentral = new Map<
    string,
    { nom: string | null; n7: number; n8: number; n9: number }
  >();
  for (const r of rows.filter((x) => x.cara === "central")) {
    const key = r.centreCodi ?? "(null)";
    const prev = perCentreCentral.get(key) ?? { nom: r.centreNom, n7: 0, n8: 0, n9: 0 };
    if (r.node === 7) prev.n7 = round2(prev.n7 + r.import);
    if (r.node === 8) prev.n8 = round2(prev.n8 + r.import);
    if (r.node === 9) prev.n9 = round2(prev.n9 + r.import);
    perCentreCentral.set(key, prev);
  }
  console.table(
    [...perCentreCentral.entries()]
      .map(([codi, v]) => ({
        centre: codi,
        nom: v.nom,
        compres_7: v.n7,
        aprov_8: v.n8,
        consums_9: v.n9,
      }))
      .sort((a, b) => Math.abs(b.compres_7) - Math.abs(a.compres_7))
  );

  // Parells a provar
  type PairTry = { nom: string; left: Map<number, number>; right: Map<number, number> };
  const tries: PairTry[] = [
    { nom: "FDLC_8 ↔ CCR00008_7", left: series.fdlc8, right: series.mirall7 },
    { nom: "FDLC_8 ↔ CCR00008_8", left: series.fdlc8, right: series.mirall8 },
    { nom: "FDLC_7 ↔ CCR00008_7", left: series.fdlc7, right: series.mirall7 },
    { nom: "FDLC_8 ↔ LN00000_7 (tot)", left: series.fdlc8, right: series.central7 },
    { nom: "FDLC_8 ↔ LN00000_8 (tot)", left: series.fdlc8, right: series.central8 },
    { nom: "FDLC_9 ↔ LN00000_7 (tot)", left: series.fdlc9, right: series.central7 },
    { nom: "FDLC_9 ↔ CCR00008_7", left: series.fdlc9, right: series.mirall7 },
  ];

  // També cada centre Central vs FDLC_8
  for (const [codi] of perCentreCentral) {
    const n7 = byMes((r) => r.cara === "central" && r.centreCodi === codi, 7);
    const n8 = byMes((r) => r.cara === "central" && r.centreCodi === codi, 8);
    tries.push({ nom: `FDLC_8 ↔ ${codi}_7`, left: series.fdlc8, right: n7 });
    tries.push({ nom: `FDLC_8 ↔ ${codi}_8`, left: series.fdlc8, right: n8 });
    tries.push({ nom: `FDLC_7 ↔ ${codi}_7`, left: series.fdlc7, right: n7 });
  }

  console.log("\n=== Coincidències exactes |L|=|R| per mes (±0.05) ===");
  const exactes: { pair: string; mes: number; abs: number; L: number; R: number }[] = [];
  const proxims: {
    pair: string;
    mes: number;
    L: number;
    R: number;
    diff: number;
    ratio: number;
  }[] = [];

  for (const t of tries) {
    for (const mes of mesos) {
      const L = t.left.get(mes) ?? 0;
      const R = t.right.get(mes) ?? 0;
      if (Math.abs(L) < 1 && Math.abs(R) < 1) continue;
      const absL = Math.abs(L);
      const absR = Math.abs(R);
      const diff = round2(Math.abs(absL - absR));
      if (diff <= 0.05 && absL >= 1) {
        exactes.push({ pair: t.nom, mes, abs: absL, L, R });
      } else if (absL >= 50 && absR >= 50) {
        const ratio = absL > absR ? absR / absL : absL / absR;
        if (ratio >= 0.85) {
          proxims.push({ pair: t.nom, mes, L, R, diff, ratio: round2(ratio) });
        }
      }
    }
  }

  console.log(`Exactes: ${exactes.length}`);
  console.table(exactes.slice(0, 80));
  console.log(`\nPròxims (ratio ≥ 0.85, |imp|≥50): ${proxims.length}`);
  console.table(proxims.sort((a, b) => b.ratio - a.ratio || a.diff - b.diff).slice(0, 40));

  // Resum per parell: quants mesos exactes
  const freq = new Map<string, number>();
  for (const e of exactes) freq.set(e.pair, (freq.get(e.pair) ?? 0) + 1);
  console.log("\n=== Resum exactes per tipus de parell ===");
  console.table(
    [...freq.entries()]
      .map(([pair, mesosOk]) => ({ pair, mesosOk }))
      .sort((a, b) => b.mesosOk - a.mesosOk)
  );

  const out = {
    generat: new Date().toISOString(),
    any,
    tablaMensual: tabla,
    totals: {
      fdlc7: sumMap(series.fdlc7),
      fdlc8: sumMap(series.fdlc8),
      fdlc9: sumMap(series.fdlc9),
      mirall7: sumMap(series.mirall7),
      mirall8: sumMap(series.mirall8),
      central7: sumMap(series.central7),
      central8: sumMap(series.central8),
    },
    centresCentral: [...perCentreCentral.entries()].map(([codi, v]) => ({ codi, ...v })),
    exactes,
    proxims: proxims.slice(0, 100),
    freqExactes: [...freq.entries()].map(([pair, mesosOk]) => ({ pair, mesosOk })),
    notes: [
      "FDLC gairebé no usa node 7; el volum de cost material sol anar a node 8 (compte 602).",
      "CCR00008 és restaurant Cal Blay (LN00001), no el centre hotel FDLC (CCH00001).",
      "Si no hi ha match exacte, pot caldre mirar el compte PGC FDLC o vendes Central → FDLC (no només cost/cost).",
    ],
  };

  const outPath = resolve("scripts/inventari-compres-fdlc-out.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`\nJSON: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

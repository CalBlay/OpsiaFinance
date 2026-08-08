import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Inventari fi v2: separa els DOS centres CCR00008
 *  - LN00000 / CCR00008 «FDLC»  → centre Central de compres per a FDLC
 *  - LN00001 / CCR00008 «RESTAURANT…» → restaurant Font de la Canya
 * i els compara amb FDLC nodes 7/8.
 *
 *   npx tsx scripts/inventari-compres-fdlc-v2.ts --any=2026
 */
import { config } from "dotenv";

config({ path: "apps/frontend/.env.local" });
config({ path: ".env" });

const FDLC_LN = "LN00007";
const CENTRAL_LN = "LN00000";
const REST_LN = "LN00001";
const CODI_CCR08 = "CCR00008";
const NODES = [7, 8, 9] as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no definit (apps/frontend/.env.local)");
}
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type Cara = "fdlc" | "central_fdlc" | "rest_canya" | "central_altre";

async function main() {
  const anyArg = process.argv.find((a) => a.startsWith("--any="));
  const any = anyArg ? Number(anyArg.split("=")[1]) : 2026;

  const centresCcr08 = await db.centre.findMany({
    where: { codi: CODI_CCR08 },
    include: { liniaNegoci: { select: { codi: true, nom: true } } },
  });
  console.log("=== Centres amb codi CCR00008 (poden ser 2!) ===");
  console.table(
    centresCcr08.map((c) => ({
      id: c.id,
      ln: c.liniaNegoci.codi,
      lnNom: c.liniaNegoci.nom,
      centre: c.codi,
      nom: c.nom,
    }))
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
      period: { select: { mes: true } },
      concepteResultat: { select: { node: true } },
      centre: {
        select: { codi: true, nom: true, liniaNegoci: { select: { codi: true } } },
      },
      liniaNegoci: { select: { codi: true } },
      importacio: { select: { liniaNegoci: { select: { codi: true } } } },
    },
  });

  type Row = { mes: number; node: number; cara: Cara; centre: string; nom: string; import: number };
  const raw: Row[] = [];

  for (const d of dades) {
    const ln =
      d.liniaNegoci?.codi ?? d.importacio.liniaNegoci?.codi ?? d.centre?.liniaNegoci.codi ?? "?";
    const centre = d.centre?.codi ?? (d.senseCentre ? "(sense)" : "?");
    const nom = d.centre?.nom ?? "";
    let cara: Cara = "central_altre";
    if (ln === FDLC_LN) cara = "fdlc";
    else if (centre === CODI_CCR08 && ln === CENTRAL_LN) cara = "central_fdlc";
    else if (centre === CODI_CCR08 && ln === REST_LN) cara = "rest_canya";
    else if (ln === CENTRAL_LN) cara = "central_altre";
    else continue; // ignore other CB LNs for this inventari

    raw.push({
      mes: d.period.mes,
      node: d.concepteResultat.node,
      cara,
      centre: `${ln}/${centre}`,
      nom,
      import: Number(d.import_),
    });
  }

  const agg = new Map<string, Row>();
  for (const r of raw) {
    const k = `${r.mes}|${r.node}|${r.cara}|${r.centre}`;
    const p = agg.get(k);
    if (p) p.import = round2(p.import + r.import);
    else agg.set(k, { ...r });
  }
  const rows = [...agg.values()];

  const series = (cara: Cara, node: number) => {
    const m = new Map<number, number>();
    for (const r of rows) {
      if (r.cara !== cara || r.node !== node) continue;
      m.set(r.mes, round2((m.get(r.mes) ?? 0) + r.import));
    }
    return m;
  };

  const mesos = [...new Set(rows.map((r) => r.mes))].sort((a, b) => a - b);
  const S = {
    f7: series("fdlc", 7),
    f8: series("fdlc", 8),
    f9: series("fdlc", 9),
    cf7: series("central_fdlc", 7),
    cf8: series("central_fdlc", 8),
    cf9: series("central_fdlc", 9),
    rc7: series("rest_canya", 7),
    rc8: series("rest_canya", 8),
  };

  console.log("\n=== Taula mensual separada ===");
  const tabla = mesos.map((mes) => ({
    mes,
    FDLC_7: S.f7.get(mes) ?? 0,
    FDLC_8: S.f8.get(mes) ?? 0,
    "LN00/CCR08_FDLC_7": S.cf7.get(mes) ?? 0,
    "LN00/CCR08_FDLC_8": S.cf8.get(mes) ?? 0,
    "LN01/CCR08_REST_7": S.rc7.get(mes) ?? 0,
    "LN01/CCR08_REST_8": S.rc8.get(mes) ?? 0,
  }));
  console.table(tabla);

  const sum = (m: Map<number, number>) => round2([...m.values()].reduce((a, b) => a + b, 0));
  console.log("\n=== Totals any ===");
  console.table([
    { cara: "FDLC 7", t: sum(S.f7) },
    { cara: "FDLC 8", t: sum(S.f8) },
    { cara: "LN00000/CCR00008 FDLC 7", t: sum(S.cf7) },
    { cara: "LN00000/CCR00008 FDLC 8", t: sum(S.cf8) },
    { cara: "LN00001/CCR00008 Rest. 7", t: sum(S.rc7) },
    { cara: "LN00001/CCR00008 Rest. 8", t: sum(S.rc8) },
  ]);

  // Detall files LN00000/CCR00008
  console.log("\n=== Detall LN00000 / CCR00008 (FDLC) per mes × node ===");
  console.table(
    rows
      .filter((r) => r.cara === "central_fdlc")
      .sort((a, b) => a.mes - b.mes || a.node - b.node)
      .map((r) => ({ mes: r.mes, node: r.node, nom: r.nom, import: r.import }))
  );

  type Try = { nom: string; L: Map<number, number>; R: Map<number, number> };
  const tries: Try[] = [
    { nom: "FDLC_8 ↔ LN00/CCR08_7", L: S.f8, R: S.cf7 },
    { nom: "FDLC_8 ↔ LN00/CCR08_8", L: S.f8, R: S.cf8 },
    { nom: "FDLC_8 ↔ LN00/CCR08_7+8", L: S.f8, R: mergeAbs(S.cf7, S.cf8) },
    { nom: "FDLC_8 ↔ LN01/Rest_7", L: S.f8, R: S.rc7 },
    { nom: "FDLC_7+8 ↔ LN00/CCR08_7+8", L: mergeAbs(S.f7, S.f8), R: mergeAbs(S.cf7, S.cf8) },
    { nom: "FDLC_8 ↔ LN01/Rest_7+8", L: S.f8, R: mergeAbs(S.rc7, S.rc8) },
  ];

  function mergeAbs(a: Map<number, number>, b: Map<number, number>) {
    const m = new Map<number, number>();
    for (const mes of new Set([...a.keys(), ...b.keys()])) {
      m.set(mes, round2((a.get(mes) ?? 0) + (b.get(mes) ?? 0)));
    }
    return m;
  }

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
      const L = t.L.get(mes) ?? 0;
      const R = t.R.get(mes) ?? 0;
      const absL = Math.abs(L);
      const absR = Math.abs(R);
      if (absL < 1 && absR < 1) continue;
      const diff = round2(Math.abs(absL - absR));
      if (diff <= 0.05 && absL >= 1) exactes.push({ pair: t.nom, mes, abs: absL, L, R });
      else if (absL >= 50 && absR >= 50) {
        const ratio = absL > absR ? absR / absL : absL / absR;
        if (ratio >= 0.7) proxims.push({ pair: t.nom, mes, L, R, diff, ratio: round2(ratio) });
      }
    }
  }

  console.log(`\n=== Exactes (±0.05): ${exactes.length} ===`);
  console.table(exactes);
  console.log(`\n=== Pròxims (ratio≥0.70): ${proxims.length} ===`);
  console.table(proxims.sort((a, b) => b.ratio - a.ratio).slice(0, 40));

  // Diff mes a mes FDLC_8 vs LN00/CCR08_7
  console.log("\n=== Diff FDLC_8 vs LN00000/CCR00008_7 ===");
  console.table(
    mesos.map((mes) => {
      const L = S.f8.get(mes) ?? 0;
      const R = S.cf7.get(mes) ?? 0;
      return {
        mes,
        FDLC_8: L,
        CCR08_Central_7: R,
        diff_abs: round2(Math.abs(Math.abs(L) - Math.abs(R))),
        ratio:
          L !== 0 && R !== 0
            ? round2(Math.min(Math.abs(L), Math.abs(R)) / Math.max(Math.abs(L), Math.abs(R)))
            : 0,
      };
    })
  );

  const outPath = resolve("scripts/inventari-compres-fdlc-v2-out.json");
  writeFileSync(
    outPath,
    JSON.stringify({ any, centresCcr08, tabla, exactes, proxims }, null, 2),
    "utf8"
  );
  console.log(`\nJSON: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

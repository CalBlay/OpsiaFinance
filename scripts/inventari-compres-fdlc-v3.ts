import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Inventari compres v3 — criteri correcte (com lnInformePerAgregacio):
 * «Compres des de Central a CCR00008» =
 *   importació LN00000 (fitxer Central) + centre codi CCR00008
 * (tant si el centre és el de Restaurants com el «FDLC» de Central).
 *
 *   npx tsx scripts/inventari-compres-fdlc-v3.ts --any=2026
 */
import { config } from "dotenv";

config({ path: "apps/frontend/.env.local" });
config({ path: ".env" });

const FDLC_LN = "LN00007";
const CENTRAL_LN = "LN00000";
const CODI_CCR08 = "CCR00008";
const NODES = [7, 8] as const;

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

async function main() {
  const anyArg = process.argv.find((a) => a.startsWith("--any="));
  const any = anyArg ? Number(anyArg.split("=")[1]) : 2026;

  const [lnCentral, lnFdlc] = await Promise.all([
    db.liniaNegoci.findUnique({ where: { codi: CENTRAL_LN }, select: { id: true } }),
    db.liniaNegoci.findUnique({ where: { codi: FDLC_LN }, select: { id: true } }),
  ]);
  if (!lnCentral || !lnFdlc) throw new Error("Falten LN00000 o LN00007");

  const dades = await db.dadaResultat.findMany({
    where: {
      period: { any },
      import_: { not: 0 },
      concepteResultat: { node: { in: [...NODES] } },
      OR: [
        // Cara Cal Blay: fitxer Central + centre CCR00008
        {
          importacio: { liniaNegociId: lnCentral.id },
          centre: { codi: CODI_CCR08 },
        },
        // Cara FDLC
        {
          OR: [
            { liniaNegociId: lnFdlc.id },
            { importacio: { liniaNegociId: lnFdlc.id } },
            { centre: { liniaNegociId: lnFdlc.id } },
          ],
        },
      ],
    },
    select: {
      import_: true,
      period: { select: { mes: true } },
      concepteResultat: { select: { node: true } },
      centre: {
        select: { codi: true, nom: true, liniaNegoci: { select: { codi: true } } },
      },
      liniaNegoci: { select: { codi: true } },
      importacio: { select: { liniaNegoci: { select: { codi: true, id: true } } } },
    },
  });

  type Cara = "central_ccr08" | "fdlc";
  type Row = {
    mes: number;
    node: number;
    cara: Cara;
    centreLn: string;
    centreNom: string;
    import: number;
  };

  const raw: Row[] = [];
  for (const d of dades) {
    const lnInforme = d.importacio.liniaNegoci?.codi ?? null;
    const centreCodi = d.centre?.codi ?? null;
    const centreLn = d.centre?.liniaNegoci.codi ?? "?";

    let cara: Cara | null = null;
    if (lnInforme === CENTRAL_LN && centreCodi === CODI_CCR08) cara = "central_ccr08";
    else if (lnInforme === FDLC_LN || d.liniaNegoci?.codi === FDLC_LN || centreLn === FDLC_LN) {
      cara = "fdlc";
    }
    if (!cara) continue;

    raw.push({
      mes: d.period.mes,
      node: d.concepteResultat.node,
      cara,
      centreLn,
      centreNom: d.centre?.nom ?? "",
      import: Number(d.import_),
    });
  }

  const agg = new Map<string, Row>();
  for (const r of raw) {
    const k = `${r.mes}|${r.node}|${r.cara}|${r.centreLn}`;
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
  const cb7 = series("central_ccr08", 7);
  const cb8 = series("central_ccr08", 8);
  const f7 = series("fdlc", 7);
  const f8 = series("fdlc", 8);

  const merge = (a: Map<number, number>, b: Map<number, number>) => {
    const m = new Map<number, number>();
    for (const mes of new Set([...a.keys(), ...b.keys()])) {
      m.set(mes, round2((a.get(mes) ?? 0) + (b.get(mes) ?? 0)));
    }
    return m;
  };
  const cb78 = merge(cb7, cb8);
  const f78 = merge(f7, f8);

  console.log(
    "Criteri: importació LN00000 + centre CCR00008  (independent de la LN dimensional del centre)\n"
  );

  console.log("=== Quins CCR00008 entren (LN dimensional del centre) ===");
  const byDim = new Map<string, number>();
  for (const r of rows.filter((x) => x.cara === "central_ccr08")) {
    const k = `${r.centreLn} · ${r.centreNom}`;
    byDim.set(k, round2((byDim.get(k) ?? 0) + r.import));
  }
  console.table([...byDim.entries()].map(([k, t]) => ({ centre_dimensional: k, total: t })));

  console.log("\n=== Taula mensual ===");
  console.table(
    mesos.map((mes) => ({
      mes,
      "Central→CCR08_7": cb7.get(mes) ?? 0,
      "Central→CCR08_8": cb8.get(mes) ?? 0,
      "Central→CCR08_7+8": cb78.get(mes) ?? 0,
      FDLC_7: f7.get(mes) ?? 0,
      FDLC_8: f8.get(mes) ?? 0,
      "FDLC_7+8": f78.get(mes) ?? 0,
      diff_78: round2(Math.abs(Math.abs(cb78.get(mes) ?? 0) - Math.abs(f78.get(mes) ?? 0))),
      ratio_78: (() => {
        const cb = Math.abs(cb78.get(mes) ?? 0);
        const f = Math.abs(f78.get(mes) ?? 0);
        if (cb === 0 || f === 0) return 0;
        return round2(Math.min(cb, f) / Math.max(cb, f));
      })(),
    }))
  );

  console.log("\n=== Detall Central→CCR00008 per mes ===");
  console.table(
    rows
      .filter((r) => r.cara === "central_ccr08")
      .sort((a, b) => a.mes - b.mes || a.node - b.node)
      .map((r) => ({
        mes: r.mes,
        node: r.node,
        centreLn: r.centreLn,
        nom: r.centreNom,
        import: r.import,
      }))
  );

  const exactes: { mes: number; pair: string; abs: number; L: number; R: number }[] = [];
  for (const mes of mesos) {
    for (const [pair, L, R] of [
      ["CB_7 ↔ FDLC_8", cb7.get(mes) ?? 0, f8.get(mes) ?? 0],
      ["CB_7+8 ↔ FDLC_8", cb78.get(mes) ?? 0, f8.get(mes) ?? 0],
      ["CB_7+8 ↔ FDLC_7+8", cb78.get(mes) ?? 0, f78.get(mes) ?? 0],
      ["CB_7 ↔ FDLC_7+8", cb7.get(mes) ?? 0, f78.get(mes) ?? 0],
    ] as const) {
      const absL = Math.abs(L);
      const absR = Math.abs(R);
      if (absL < 1 || absR < 1) continue;
      if (Math.abs(absL - absR) <= 0.05) exactes.push({ mes, pair, abs: absL, L, R });
    }
  }
  console.log(`\n=== Exactes: ${exactes.length} ===`);
  console.table(exactes);

  const outPath = resolve("scripts/inventari-compres-fdlc-v3-out.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        any,
        byDim: [...byDim],
        mesos: mesos.map((m) => ({ mes: m, cb7: cb7.get(m), cb8: cb8.get(m), f8: f8.get(m) })),
        exactes,
      },
      null,
      2
    )
  );
  console.log(`\nJSON: ${outPath}`);
  console.log("\nFebrer esperat (UI): Central→CCR08 node 7 ≈ -5384.25");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

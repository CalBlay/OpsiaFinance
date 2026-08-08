import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Cerca factura CB → FDLC / Masia la Blayeta.
 *   npx tsx scripts/cerca-factura-fdlc.ts --any=2026 --mes=5 --base=10414.38
 *   npx tsx scripts/cerca-factura-fdlc.ts --any=2026 --mes=5 --base=10414.38 --ambit=tot
 */
import { config } from "dotenv";

config({ path: "apps/frontend/.env.local" });
config({ path: ".env" });

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

function arg(name: string, def?: string) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
}

async function main() {
  const any = Number(arg("any", "2026"));
  const mes = Number(arg("mes", "5"));
  const base = Number(arg("base", "10414.38"));
  const ambitTot = arg("ambit", "mes") === "tot";
  const brut21 = round2(base * 1.21);
  const brut10 = round2(base * 1.1);
  const net21 = round2(base / 1.21);
  const net10 = round2(base / 1.1);

  const targets = [
    { label: "import tal qual", v: base },
    { label: "si és net → brut 21%", v: brut21 },
    { label: "si és net → brut 10%", v: brut10 },
    { label: "si és brut → net 21%", v: net21 },
    { label: "si és brut → net 10%", v: net10 },
  ];

  console.log("Factura Cal Blay → Masia la Blayeta (FDLC)");
  console.log(`  Import indicat = ${base}`);
  console.log(`  Si neta +21%   = ${brut21}`);
  console.log(`  Si neta +10%   = ${brut10}`);
  console.log(`  Si bruta /21%  = ${net21}`);
  console.log(`  Si bruta /10%  = ${net10}`);
  console.log(`  Període        = ${ambitTot ? `tot ${any}` : `${any}-${mes}`}\n`);

  const periodWhere = ambitTot ? { any } : { any, mes };

  const dades = await db.dadaResultat.findMany({
    where: { period: periodWhere, import_: { not: 0 } },
    select: {
      import_: true,
      period: { select: { mes: true } },
      concepteResultat: { select: { node: true, descripcio: true } },
      centre: {
        select: { codi: true, nom: true, liniaNegoci: { select: { codi: true } } },
      },
      liniaNegoci: { select: { codi: true } },
      importacio: {
        select: { liniaNegoci: { select: { codi: true } }, nomFitxer: true },
      },
    },
  });

  console.log(`Files llegides: ${dades.length}`);

  const hits = [];
  const prox = [];

  for (const d of dades) {
    const v = Number(d.import_);
    const abs = Math.abs(v);
    const lnInf = d.importacio.liniaNegoci?.codi ?? "";
    const row = {
      mes: d.period.mes,
      import: v,
      node: d.concepteResultat.node,
      concepte: d.concepteResultat.descripcio,
      centre: d.centre ? `${d.centre.codi} · ${d.centre.nom}` : "(sense)",
      centreLn: d.centre?.liniaNegoci.codi ?? "",
      lnInf,
      fitxer: d.importacio.nomFitxer ?? "",
    };

    for (const t of targets) {
      if (Math.abs(abs - t.v) <= 0.05) {
        hits.push({ ...row, match: t.label });
      }
    }

    const diff = round2(Math.abs(abs - base));
    if (diff > 0.05 && diff <= 50) {
      prox.push({ ...row, diff_vs_import: diff });
    }
  }

  console.log(`\n=== Hits (±0.05 vs variants) : ${hits.length} ===`);
  console.table(hits.sort((a, b) => a.mes - b.mes));

  console.log(`\n=== Pròxims a ${base} (diff≤50): ${prox.length} ===`);
  console.table(prox.sort((a, b) => a.diff_vs_import - b.diff_vs_import).slice(0, 30));

  const fdlc78 = dades
    .filter(
      (d) =>
        d.period.mes === mes &&
        (d.concepteResultat.node === 7 || d.concepteResultat.node === 8) &&
        (d.importacio.liniaNegoci?.codi === "LN00007" || d.liniaNegoci?.codi === "LN00007")
    )
    .reduce((a, d) => a + Number(d.import_), 0);
  console.log(`\nFDLC ${any}-${mes} nodes 7+8 = ${round2(fdlc78)}`);
  console.log(`  vs factura ${base} → diff ${round2(Math.abs(Math.abs(fdlc78) - base))}`);
  console.log(
    `  Si FDLC_8 maig era -12111.06 (inventari), residu altres = ${round2(12111.06 - base)}`
  );

  console.log("\n=== Centres Blayeta/FDLC/Canya · nodes 2/3/4/7/8 ===");
  const named = dades.filter((d) => /blayeta|fdlc|canya|font/i.test(d.centre?.nom ?? ""));
  const byKey = new Map<string, number>();
  for (const d of named) {
    if (![2, 3, 4, 7, 8].includes(d.concepteResultat.node)) continue;
    if (!ambitTot && d.period.mes !== mes) continue;
    const k = `${d.period.mes}|${d.concepteResultat.node}|${d.importacio.liniaNegoci?.codi}|${d.centre?.codi}|${d.centre?.nom}`;
    byKey.set(k, round2((byKey.get(k) ?? 0) + Number(d.import_)));
  }
  console.table(
    [...byKey.entries()]
      .map(([k, imp]) => {
        const [m, node, ln, codi, nom] = k.split("|");
        return {
          mes: Number(m),
          node: Number(node),
          lnInf: ln,
          centre: `${codi} · ${nom}`,
          import: imp,
        };
      })
      .sort((a, b) => a.mes - b.mes || a.node - b.node)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Prova: CCC00002 · Vendes (LN00000) ≥ cost IC / FDLC cada mes?
 *
 *   npx tsx scripts/prova-ccc00002-vs-fdlc.ts --any=2026
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

async function main() {
  const anyArg = process.argv.find((a) => a.startsWith("--any="));
  const any = anyArg ? Number(anyArg.split("=")[1]) : 2026;

  const lnCentral = await db.liniaNegoci.findUniqueOrThrow({
    where: { codi: "LN00000" },
    select: { id: true },
  });
  const lnFdlc = await db.liniaNegoci.findUniqueOrThrow({
    where: { codi: "LN00007" },
    select: { id: true },
  });

  const dades = await db.dadaResultat.findMany({
    where: {
      period: { any },
      import_: { not: 0 },
      OR: [
        // Vendes CCC00002 a informe Central
        {
          importacio: { liniaNegociId: lnCentral.id },
          centre: { codi: "CCC00002" },
          concepteResultat: { node: 2 },
        },
        // Cost Central → CCR00008 nodes 7+8
        {
          importacio: { liniaNegociId: lnCentral.id },
          centre: { codi: "CCR00008" },
          concepteResultat: { node: { in: [7, 8] } },
        },
        // FDLC 7+8
        {
          OR: [{ importacio: { liniaNegociId: lnFdlc.id } }, { liniaNegociId: lnFdlc.id }],
          concepteResultat: { node: { in: [7, 8] } },
        },
      ],
    },
    select: {
      import_: true,
      period: { select: { mes: true } },
      concepteResultat: { select: { node: true } },
      centre: { select: { codi: true } },
      importacio: { select: { liniaNegoci: { select: { codi: true } } } },
      liniaNegoci: { select: { codi: true } },
    },
  });

  const vendesCcc2 = new Map<number, number>();
  const costCcr08 = new Map<number, number>();
  const costFdlc = new Map<number, number>();

  for (const d of dades) {
    const mes = d.period.mes;
    const v = Number(d.import_);
    const lnInf = d.importacio.liniaNegoci?.codi;
    const centre = d.centre?.codi;
    const node = d.concepteResultat.node;

    if (lnInf === "LN00000" && centre === "CCC00002" && node === 2) {
      vendesCcc2.set(mes, round2((vendesCcc2.get(mes) ?? 0) + v));
    }
    if (lnInf === "LN00000" && centre === "CCR00008" && (node === 7 || node === 8)) {
      costCcr08.set(mes, round2((costCcr08.get(mes) ?? 0) + v));
    }
    if ((lnInf === "LN00007" || d.liniaNegoci?.codi === "LN00007") && (node === 7 || node === 8)) {
      costFdlc.set(mes, round2((costFdlc.get(mes) ?? 0) + v));
    }
  }

  const mesos = [...new Set([...vendesCcc2.keys(), ...costCcr08.keys(), ...costFdlc.keys()])].sort(
    (a, b) => a - b
  );

  console.log(
    "Prova: la venda CCC00002 (Central) pot contenir la factura a FDLC si és ≥ cost IC / despesa FDLC\n"
  );

  const tabla = mesos.map((mes) => {
    const vendes = vendesCcc2.get(mes) ?? 0;
    const ccr = costCcr08.get(mes) ?? 0;
    const fdlc = costFdlc.get(mes) ?? 0;
    const absCcr = Math.abs(ccr);
    const absFdlc = Math.abs(fdlc);
    const elim = round2(Math.min(absCcr, absFdlc));
    return {
      mes,
      CCC00002_Vendes: vendes,
      CCR08_cost_7_8: ccr,
      FDLC_7_8: fdlc,
      elim_min: elim,
      "vendes≥|CCR08|": vendes >= absCcr - 0.01,
      "vendes≥|FDLC|": vendes >= absFdlc - 0.01,
      "vendes≥elim": vendes >= elim - 0.01,
      sobra_vs_CCR08: round2(vendes - absCcr),
      sobra_vs_FDLC: round2(vendes - absFdlc),
      sobra_vs_elim: round2(vendes - elim),
    };
  });

  console.table(tabla);

  const n = tabla.filter((r) => r.CCC00002_Vendes !== 0 || r.elim_min !== 0);
  const okCcr = n.filter((r) => r["vendes≥|CCR08|"]).length;
  const okFdlc = n.filter((r) => r["vendes≥|FDLC|"]).length;
  const okElim = n.filter((r) => r["vendes≥elim"]).length;

  console.log("\n=== Resum ===");
  console.log(`Mesos amb dades: ${n.length}`);
  console.log(`CCC00002 Vendes ≥ |CCR08 cost| : ${okCcr}/${n.length}`);
  console.log(`CCC00002 Vendes ≥ |FDLC 7+8|   : ${okFdlc}/${n.length}`);
  console.log(`CCC00002 Vendes ≥ elim_min     : ${okElim}/${n.length}`);

  // Referència factura maig coneguda
  const facturaMaig = 10414.38;
  const v5 = vendesCcc2.get(5) ?? 0;
  console.log(`\nMaig · factura Blayeta ${facturaMaig}:`);
  console.log(`  CCC00002 Vendes = ${v5}`);
  console.log(`  vendes ≥ factura? ${v5 >= facturaMaig}`);
  console.log(`  sobra = ${round2(v5 - facturaMaig)}`);

  const outPath = resolve("scripts/prova-ccc00002-vs-fdlc-out.json");
  writeFileSync(outPath, JSON.stringify({ any, tabla, facturaMaig }, null, 2));
  console.log(`\nJSON: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
/**
 * Cerca import concret a LN00000 (i opcionalment tot Cal Blay).
 *   npx tsx scripts/cerca-import-ln.ts --any=2026 --mes=5 --import=3580.34
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
  const target = Number(arg("import", "3580.34"));
  const tol = Number(arg("tol", "0.05"));
  const onlyLn00 = arg("nomes-ln00", "1") !== "0";

  const lnCentral = await db.liniaNegoci.findUniqueOrThrow({
    where: { codi: "LN00000" },
    select: { id: true },
  });

  const dades = await db.dadaResultat.findMany({
    where: {
      period: { any, mes },
      import_: { not: 0 },
      ...(onlyLn00
        ? {
            OR: [{ importacio: { liniaNegociId: lnCentral.id } }, { liniaNegociId: lnCentral.id }],
          }
        : {}),
    },
    select: {
      import_: true,
      concepteResultat: { select: { node: true, descripcio: true } },
      centre: {
        select: { codi: true, nom: true, liniaNegoci: { select: { codi: true } } },
      },
      liniaNegoci: { select: { codi: true } },
      importacio: { select: { liniaNegoci: { select: { codi: true } }, nomFitxer: true } },
    },
  });

  console.log(
    `Cerca |import|≈${target} (±${tol}) · ${any}-${mes}${onlyLn00 ? " · filtre LN00000 (informe o dada)" : " · totes LN"}\nFiles llegides: ${dades.length}\n`
  );

  const hits = [];
  for (const d of dades) {
    const v = Number(d.import_);
    if (Math.abs(Math.abs(v) - Math.abs(target)) <= tol) {
      hits.push({
        import: v,
        node: d.concepteResultat.node,
        concepte: d.concepteResultat.descripcio,
        centre: d.centre ? `${d.centre.codi} · ${d.centre.nom}` : "(sense)",
        centreLn: d.centre?.liniaNegoci.codi ?? "",
        lnDada: d.liniaNegoci?.codi ?? "",
        lnInforme: d.importacio.liniaNegoci?.codi ?? "",
        fitxer: d.importacio.nomFitxer ?? "",
      });
    }
  }

  console.log(`Hits exactes: ${hits.length}`);
  console.table(hits);

  // Proxims a LN00000 informe, node 2/4
  const prox = [];
  for (const d of dades) {
    if (d.importacio.liniaNegoci?.codi !== "LN00000") continue;
    const node = d.concepteResultat.node;
    if (node !== 2 && node !== 4) continue;
    const v = Number(d.import_);
    if (v <= 0) continue;
    const diff = round2(Math.abs(v - target));
    if (diff > 0.05 && diff <= 800) {
      prox.push({
        import: v,
        diff_vs_target: diff,
        node,
        concepte: d.concepteResultat.descripcio,
        centre: d.centre ? `${d.centre.codi} · ${d.centre.nom}` : "(sense)",
      });
    }
  }
  console.log(`\nPròxims positius LN00000 node 2/4 (diff≤800): ${prox.length}`);
  console.table(prox.sort((a, b) => a.diff_vs_target - b.diff_vs_target).slice(0, 30));

  // Resum vendes LN00000 maig per centre
  console.log("\n=== LN00000 · Vendes (2) maig per centre ===");
  const byC = new Map<string, number>();
  for (const d of dades) {
    if (d.importacio.liniaNegoci?.codi !== "LN00000") continue;
    if (d.concepteResultat.node !== 2) continue;
    const k = d.centre ? `${d.centre.codi} · ${d.centre.nom}` : "(sense)";
    byC.set(k, round2((byC.get(k) ?? 0) + Number(d.import_)));
  }
  console.table(
    [...byC.entries()]
      .map(([centre, import_]) => ({ centre, import: import_ }))
      .sort((a, b) => Math.abs(b.import) - Math.abs(a.import))
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

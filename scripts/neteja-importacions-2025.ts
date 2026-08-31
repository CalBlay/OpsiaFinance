/**
 * Esborra importacions SAP (i fitxers a uploads) de l'exercici 2025,
 * més les execucions de repartiment dels períodes 2025.
 *
 * Conserva: normes de repartiment, ajustos manuals, vendes TPV, cost personal/salarial.
 *
 * Executar: npx tsx scripts/neteja-importacions-2025.ts
 * Dry-run:  npx tsx scripts/neteja-importacions-2025.ts --dry-run
 * O doble-clic a: scripts/neteja-importacions-2025.bat
 */
import { unlink } from "node:fs/promises";
import { config } from "dotenv";

config({ path: "apps/frontend/.env.local" });
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const dryRun = process.argv.includes("--dry-run");
const ANY = 2025;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definit");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const periods = await prisma.period.findMany({
    where: { any: ANY },
    select: { id: true, mes: true, nom: true },
    orderBy: { mes: "asc" },
  });
  const periodIds = periods.map((p) => p.id);

  const imports = await prisma.importacio.findMany({
    where: {
      OR: [
        { periodId: { in: periodIds } },
        { dades: { some: { periodId: { in: periodIds } } } },
        { nomFitxer: { contains: String(ANY) } },
      ],
    },
    select: {
      id: true,
      nomFitxer: true,
      rutaStorage: true,
      estat: true,
      period: { select: { nom: true, any: true, mes: true } },
      liniaNegoci: { select: { codi: true, nom: true } },
      formatInforme: { select: { tipusInforme: true, nom: true } },
      _count: { select: { dades: true } },
    },
    orderBy: [{ period: { mes: "asc" } }, { nomFitxer: "asc" }],
  });

  const repartiments = periodIds.length
    ? await prisma.execucioRepartiment.findMany({
        where: { periodId: { in: periodIds } },
        select: {
          id: true,
          estat: true,
          period: { select: { nom: true } },
          _count: { select: { moviments: true } },
        },
      })
    : [];

  const totalDades = imports.reduce((s, i) => s + i._count.dades, 0);

  console.log(`\n=== Neteja importacions ${ANY} ${dryRun ? "(DRY-RUN)" : "(APLICAR)"} ===\n`);
  console.log(`Períodes ${ANY}: ${periods.map((p) => p.nom).join(", ") || "(cap)"}`);
  console.log(`Importacions a esborrar: ${imports.length}`);
  console.log(`Files DadaResultat (cascada): ${totalDades}`);
  console.log(`Execucions repartiment ${ANY}: ${repartiments.length}`);
  console.log("");

  for (const imp of imports) {
    const ln = imp.liniaNegoci ? `${imp.liniaNegoci.codi}` : "sense-LN";
    const per = imp.period?.nom ?? "sense-període";
    console.log(
      `  - ${imp.nomFitxer} | ${ln} | ${per} | ${imp.estat} | ${imp._count.dades} dades | ${imp.formatInforme?.tipusInforme ?? "?"}`
    );
  }

  if (repartiments.length) {
    console.log("\nRepartiment:");
    for (const r of repartiments) {
      console.log(`  - ${r.period.nom} | ${r.estat} | ${r._count.moviments} moviments`);
    }
  }

  if (dryRun) {
    console.log("\nDry-run: no s'ha esborrat res. Torna a executar sense --dry-run per aplicar.\n");
    return;
  }

  let fitxersEsborrats = 0;
  let fitxersAbsents = 0;
  for (const imp of imports) {
    if (!imp.rutaStorage || imp.rutaStorage === "db" || imp.rutaStorage.startsWith("db:")) continue;
    try {
      await unlink(imp.rutaStorage);
      fitxersEsborrats++;
    } catch {
      fitxersAbsents++;
    }
  }

  const delRep = periodIds.length
    ? await prisma.execucioRepartiment.deleteMany({ where: { periodId: { in: periodIds } } })
    : { count: 0 };

  const delImp = await prisma.importacio.deleteMany({
    where: { id: { in: imports.map((i) => i.id) } },
  });

  console.log("\n✓ Fet:");
  console.log(`  Importacions esborrades: ${delImp.count}`);
  console.log(`  Fitxers disc eliminats:  ${fitxersEsborrats} (absents: ${fitxersAbsents})`);
  console.log(`  Repartiments ${ANY}:     ${delRep.count}`);
  console.log("  DadaResultat: esborrades en cascada amb les importacions");
  console.log(`\nPots tornar a importar els Excel ${ANY} des de Dades → Nova importació.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

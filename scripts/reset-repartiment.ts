/**
 * Esborra normes i execucions de repartiment.
 * Executar: npx tsx scripts/reset-repartiment.ts
 */
import { config } from "dotenv";
config({ path: "apps/frontend/.env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definit");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const execucions = await prisma.execucioRepartiment.deleteMany();
  const normes = await prisma.normaRepartiment.deleteMany();

  console.log(`\n✓ Repartiment esborrat:`);
  console.log(`  Execucions: ${execucions.count}`);
  console.log(`  Normes:     ${normes.count}`);
  console.log(`  Grups:      conservats (per quan afegim normes)\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

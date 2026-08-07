/**
 * Esborra tots els mapeigs de cost personal (un sol cop).
 * Executar des de apps/frontend:
 *   npx tsx ../../scripts/esborrar-mapeig-cost-personal.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const r = await db.mapeigCodiCostPersonal.deleteMany({});
  console.log(`Esborrats: ${r.count} mapeigs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

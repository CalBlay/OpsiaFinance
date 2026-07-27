/**
 * Seed inicial: crea l'usuari admin per defecte si no existeix.
 * Executar amb: npm run prisma:seed
 *
 * IMPORTANT: Canvia la contrasenya immediatament després del primer accés.
 */

import { config } from "dotenv";
config({ path: "apps/frontend/.env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definit");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "admin@opsia.local";
  const passwordHash = await bcrypt.hash("Admin1234!", 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin",
      role: "ADMIN",
      passwordHash,
      isActive: true,
    },
  });

  console.log(`\n✓ Usuari admin preparat:`);
  console.log(`  Email:       ${admin.email}`);
  console.log(`  Contrasenya: Admin1234!`);
  console.log(`  → Canvia la contrasenya en el primer accés.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: "apps/frontend/.env.local" });

/**
 * Migracions: DIRECT_URL obligatori si DATABASE_URL és pooler Neon.
 * L'app pot seguir usant DATABASE_URL amb pooler.
 */
const directUrl = process.env["DIRECT_URL"]?.trim();
const databaseUrl = process.env["DATABASE_URL"]?.trim();

const migrateUrl = directUrl ?? databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrateUrl,
  },
});

import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: "apps/frontend/.env.local" });

/**
 * Migracions: preferir DIRECT_URL (host Neon sense `-pooler`).
 * El pooler trenca pg_advisory_lock → P1002 timeout.
 * L'app pot seguir usant DATABASE_URL amb pooler.
 */
const migrateUrl = process.env["DIRECT_URL"] || process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrateUrl,
  },
});

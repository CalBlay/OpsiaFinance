#!/usr/bin/env node
/**
 * prisma migrate deploy amb connexió directa (no pooler).
 * Neon/PgBouncer no suporta pg_advisory_lock → P1002 si s'usa el pooler.
 */
import { spawnSync } from "node:child_process";

const directUrl = process.env.DIRECT_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();

function fail(msg) {
  console.error(`\n[prisma-deploy] ${msg}\n`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`[prisma-deploy] ${msg}`);
}

function isPoolerUrl(url) {
  return /-pooler[\.\-]/i.test(url) || url.includes("-pooler.");
}

let migrateUrl = directUrl;

if (!migrateUrl) {
  if (databaseUrl && isPoolerUrl(databaseUrl)) {
    fail(
      "DIRECT_URL no està definit i DATABASE_URL usa el pooler de Neon.\n" +
        "A Vercel: Project → Settings → Environment Variables\n" +
        "  • DATABASE_URL = connection string amb «-pooler» (per l'app)\n" +
        "  • DIRECT_URL   = connection string sense «-pooler» (per migracions)\n" +
        "Copia-ho des de Neon → Connect → «Direct connection»."
    );
  }
  migrateUrl = databaseUrl;
  if (migrateUrl) {
    warn("DIRECT_URL no definit; s'usa DATABASE_URL (ok només si no és pooler).");
  }
}

if (!migrateUrl) {
  fail("Cap URL de base de dades (DATABASE_URL o DIRECT_URL).");
}

if (isPoolerUrl(migrateUrl)) {
  fail(
    "L'URL de migració sembla un pooler (conté «-pooler»).\n" +
      "Configura DIRECT_URL amb la connexió directa de Neon."
  );
}

const maxAttempts = Number(process.env.PRISMA_DEPLOY_RETRIES ?? "3");
const retryDelayMs = Number(process.env.PRISMA_DEPLOY_RETRY_DELAY_MS ?? "15000");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runMigrate() {
  const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: migrateUrl },
    shell: process.platform === "win32",
  });
  return r.status ?? 1;
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      console.log(`[prisma-deploy] Reintent ${attempt}/${maxAttempts}…`);
    }
    const code = runMigrate();
    if (code === 0) {
      console.log("[prisma-deploy] Migracions aplicades.");
      return;
    }
    const isLockError = code !== 0;
    if (attempt < maxAttempts && isLockError) {
      console.warn(
        `[prisma-deploy] Ha fallat (codi ${code}). Pot ser lock concurrent; esperant ${retryDelayMs}ms…`
      );
      await sleep(retryDelayMs);
      continue;
    }
    process.exit(code);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

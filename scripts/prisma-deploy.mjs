#!/usr/bin/env node
/**
 * prisma migrate deploy amb connexió directa (no pooler).
 * Serialitza desplegaments concurrents amb un lock PostgreSQL que pot esperar
 * més que el timeout fix de 10 segons de Prisma.
 */
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "prisma", "migrations");

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

/** Neon: ep-xxx-pooler.region… → ep-xxx.region… (mateix user/password/db). */
function deriveNeonDirectUrl(poolerUrl) {
  if (!poolerUrl || !isPoolerUrl(poolerUrl)) return null;
  const direct = poolerUrl.replace(/-pooler(?=\.)/i, "");
  return direct !== poolerUrl ? direct : null;
}

let migrateUrl = directUrl;

if (!migrateUrl && databaseUrl && isPoolerUrl(databaseUrl)) {
  const derived = deriveNeonDirectUrl(databaseUrl);
  if (derived) {
    migrateUrl = derived;
    warn(
      "DIRECT_URL no definit; s'ha derivat la connexió directa de Neon des de DATABASE_URL " +
        "(recomanat: afegir DIRECT_URL explícit a Vercel)."
    );
  } else {
    fail(
      "DIRECT_URL no està definit i no s'ha pogut derivar des del pooler de Neon.\n" +
        "A Vercel: Project → Settings → Environment Variables\n" +
        "  • DATABASE_URL = connection string amb «-pooler» (per l'app)\n" +
        "  • DIRECT_URL   = connection string sense «-pooler» (per migracions)\n" +
        "Copia-ho des de Neon → Connect → «Direct connection»."
    );
  }
}

if (!migrateUrl) {
  migrateUrl = databaseUrl;
  if (migrateUrl && !directUrl) {
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

const lockId = 72707369;
const lockTimeoutMs = Number(process.env.PRISMA_DEPLOY_LOCK_TIMEOUT_MS ?? "300000");

if (!Number.isFinite(lockTimeoutMs) || lockTimeoutMs <= 0) {
  fail("PRISMA_DEPLOY_LOCK_TIMEOUT_MS ha de ser un nombre positiu de mil·lisegons.");
}

function runMigrate() {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: migrateUrl,
        // L'outer lock es manté durant tota la migració.
        PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
      },
      shell: process.platform === "win32",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`prisma migrate deploy finalitzat pel senyal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function pendingMigrationNames(client) {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const localNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  try {
    const { rows } = await client.query(
      `SELECT migration_name
       FROM _prisma_migrations
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
    );
    const appliedNames = new Set(rows.map((row) => row.migration_name));
    return localNames.filter((name) => !appliedNames.has(name));
  } catch (error) {
    // Primera migració: Prisma encara no ha creat la seva taula de control.
    if (error?.code === "42P01") return localNames;
    throw error;
  }
}

async function main() {
  const client = new Client({
    connectionString: migrateUrl,
    application_name: "opsia-prisma-deploy",
  });
  let locked = false;

  try {
    await client.connect();

    const pendingBeforeLock = await pendingMigrationNames(client);
    if (pendingBeforeLock.length === 0) {
      console.log("[prisma-deploy] No hi ha migracions pendents; no cal adquirir el lock.");
      return;
    }

    console.log(
      `[prisma-deploy] ${pendingBeforeLock.length} migració(ns) pendent(s): ${pendingBeforeLock.join(", ")}`
    );
    await client.query("SELECT set_config('statement_timeout', $1, false)", [`${lockTimeoutMs}ms`]);
    console.log(
      `[prisma-deploy] Esperant el lock de migracions (màxim ${Math.ceil(lockTimeoutMs / 1000)}s)…`
    );
    await client.query("SELECT pg_advisory_lock($1)", [lockId]);
    locked = true;
    console.log("[prisma-deploy] Lock adquirit; comprovant de nou l'estat…");

    const pendingAfterLock = await pendingMigrationNames(client);
    if (pendingAfterLock.length === 0) {
      console.log("[prisma-deploy] Un altre desplegament ja ha aplicat les migracions.");
      return;
    }

    console.log("[prisma-deploy] Aplicant migracions…");

    const code = await runMigrate();
    if (code !== 0) {
      process.exitCode = code;
      return;
    }

    console.log("[prisma-deploy] Migracions aplicades.");
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
      console.log("[prisma-deploy] Lock alliberat.");
    }
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

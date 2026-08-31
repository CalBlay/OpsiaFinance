#!/usr/bin/env node
/**
 * Build de Vercel: migracions (prod) + next build.
 * Preview: només next build (evita locks concurrents amb prod).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendDir = path.join(root, "apps", "frontend");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: opts.cwd ?? root,
    env: process.env,
    shell: process.platform === "win32",
  });
  if ((r.status ?? 1) !== 0) {
    process.exit(r.status ?? 1);
  }
}

const isVercel = process.env.VERCEL === "1";
const vercelEnv = process.env.VERCEL_ENV ?? "development";
const skipMigrate = process.env.SKIP_PRISMA_MIGRATE === "1";

// Prod a Vercel: aplica migracions abans del build.
// Preview/development: skip (mateixa BD → lock advisory concurrent amb prod).
const shouldMigrate = !skipMigrate && (!isVercel || vercelEnv === "production");

if (shouldMigrate) {
  console.log("[vercel-build] Aplicant migracions Prisma…");
  run("node", ["scripts/prisma-deploy.mjs"]);
} else if (isVercel && vercelEnv !== "production") {
  console.log("[vercel-build] Preview: saltant migracions (s'apliquen només a production).");
} else if (skipMigrate) {
  console.log("[vercel-build] SKIP_PRISMA_MIGRATE=1: saltant migracions.");
}

console.log("[vercel-build] next build…");
run("npx", ["next", "build"], { cwd: frontendDir });

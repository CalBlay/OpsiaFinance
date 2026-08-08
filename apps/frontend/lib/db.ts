import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/*
 * Singleton del client Prisma (Prisma 7 + adapter pg).
 *
 * Prisma 7 requereix un adapter explícit en lloc de llegir la URL
 * directament del schema. La URL es llegeix de DATABASE_URL.
 */

/**
 * El driver `pg` avisa si sslmode és prefer/require/verify-ca (avui són alias
 * de verify-full; a pg v9 canviaran). Neon ja verifica el certificat: usem
 * verify-full explícitament per silenciar l'avís i mantenir el comportament actual.
 *
 * Només toquem el query param (sense `new URL`) per no alterar passwords amb caràcters especials.
 */
export function normalitzarSslConnectionString(url: string): string {
  if (/[?&]sslmode=verify-full\b/i.test(url)) return url;
  if (/[?&]sslmode=(prefer|require|verify-ca)\b/i.test(url)) {
    return url.replace(/([?&])sslmode=(prefer|require|verify-ca)\b/gi, "$1sslmode=verify-full");
  }
  if (/[?&]sslmode=/i.test(url)) return url;
  return url.includes("?") ? `${url}&sslmode=verify-full` : `${url}?sslmode=verify-full`;
}

function createPrismaClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL no està definit. Comprova el fitxer .env.local");
  }
  const connectionString = normalitzarSslConnectionString(raw);
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

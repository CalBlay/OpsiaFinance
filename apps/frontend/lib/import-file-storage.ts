import { existsSync, readFileSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";

/** Marca a `rutaStorage` quan el fitxer només viu a la BBDD (Vercel). */
export const STORAGE_DB_MARKER = "db";

type ImportacioFitxerDelegate = {
  findUnique: (args: {
    where: { importacioId: string };
    select: { contingut: true };
  }) => Promise<{ contingut: Uint8Array | Buffer } | null>;
  upsert: (args: {
    where: { importacioId: string };
    create: { importacioId: string; contingut: Uint8Array };
    update: { contingut: Uint8Array };
  }) => Promise<unknown>;
};

function importacioFitxerDelegate(): ImportacioFitxerDelegate | null {
  const delegate = (db as PrismaClient & { importacioFitxer?: ImportacioFitxerDelegate })
    .importacioFitxer;
  return delegate ?? null;
}

export function esRutaDisc(ruta: string | null | undefined): boolean {
  if (!ruta || ruta === STORAGE_DB_MARKER) return false;
  if (ruta.startsWith("db:")) return false;
  return true;
}

function candidatUploadsDirs(): string[] {
  const envDir = process.env.UPLOADS_DIR?.trim();
  const dirs = [
    envDir ? resolve(envDir) : null,
    resolve(process.cwd(), "uploads"),
    resolve(process.cwd(), "..", "uploads"),
    resolve(process.cwd(), "..", "..", "uploads"),
  ].filter((value): value is string => !!value);

  return [...new Set(dirs)];
}

async function provarDesarADisc(id: string, ext: string, buffer: Buffer): Promise<string | null> {
  if (process.env.VERCEL) return null;

  for (const uploadsDir of candidatUploadsDirs()) {
    try {
      await mkdir(uploadsDir, { recursive: true });
      const filePath = join(uploadsDir, `${id}.${ext}`);
      await writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`import-file-storage: no s'ha pogut escriure a ${uploadsDir}: ${detail}`);
    }
  }
  return null;
}

async function llegirContingutDb(importId: string): Promise<Buffer | null> {
  const delegate = importacioFitxerDelegate();
  if (delegate) {
    const row = await delegate.findUnique({
      where: { importacioId: importId },
      select: { contingut: true },
    });
    if (row?.contingut && row.contingut.length > 0) {
      return Buffer.from(row.contingut);
    }
    return null;
  }

  try {
    const rows = await db.$queryRaw<Array<{ contingut: Uint8Array | Buffer }>>`
      SELECT contingut FROM "ImportacioFitxer" WHERE "importacioId" = ${importId}
    `;
    const contingut = rows[0]?.contingut;
    if (contingut && contingut.length > 0) return Buffer.from(contingut);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/relation .*ImportacioFitxer.* does not exist/i.test(detail)) {
      console.warn(
        "import-file-storage: taula ImportacioFitxer absent; executa prisma migrate deploy"
      );
    } else {
      console.warn(`import-file-storage: no s'ha pogut llegir de la BBDD (${importId}):`, detail);
    }
  }
  return null;
}

async function desarContingutDb(importId: string, buffer: Buffer): Promise<void> {
  const bytes = new Uint8Array(buffer);
  const delegate = importacioFitxerDelegate();
  if (delegate) {
    await delegate.upsert({
      where: { importacioId: importId },
      create: { importacioId: importId, contingut: bytes },
      update: { contingut: bytes },
    });
    return;
  }

  await db.$executeRaw`
    INSERT INTO "ImportacioFitxer" ("importacioId", "contingut")
    VALUES (${importId}, ${buffer})
    ON CONFLICT ("importacioId") DO UPDATE SET "contingut" = EXCLUDED."contingut"
  `;
}

/**
 * Desa l'Excel a la BBDD (sempre) i, si el disc ho permet, també en local.
 * A Vercel el disc és de només lectura: la BBDD és la font de veritat.
 */
export async function persistirFitxerImportacio(
  id: string,
  ext: string,
  buffer: Buffer
): Promise<{ ok: true; rutaStorage: string } | { ok: false; message: string }> {
  try {
    await desarContingutDb(id, buffer);
    const diskPath = await provarDesarADisc(id, ext, buffer);
    const rutaStorage = diskPath ?? STORAGE_DB_MARKER;
    await db.importacio.update({
      where: { id },
      data: { rutaStorage },
    });
    return { ok: true, rutaStorage };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`persistirFitxerImportacio(${id}):`, detail);
    if (/relation .*ImportacioFitxer.* does not exist/i.test(detail)) {
      return {
        ok: false,
        message:
          "Falta aplicar la migració de la base de dades (ImportacioFitxer). Executa «npm run prisma:deploy» i torna-ho a provar.",
      };
    }
    return {
      ok: false,
      message:
        "No s'ha pogut desar el fitxer. Comprova la connexió a la base de dades i torna-ho a provar.",
    };
  }
}

export async function carregarFitxerImportacio(
  importId: string,
  rutaStorage: string | null = null
): Promise<Buffer | null> {
  const fromDb = await llegirContingutDb(importId);
  if (fromDb) return fromDb;

  if (esRutaDisc(rutaStorage) && rutaStorage && existsSync(rutaStorage)) {
    return Buffer.from(readFileSync(rutaStorage));
  }
  return null;
}

export async function esborrarFitxerDisc(rutaStorage: string | null | undefined): Promise<void> {
  if (!esRutaDisc(rutaStorage) || !rutaStorage) return;
  try {
    await unlink(rutaStorage);
  } catch {
    /* ja no existia */
  }
}

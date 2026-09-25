import { db } from "@/lib/db";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS "UploadPendent" (
  "uploadId" TEXT NOT NULL,
  "ordre" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "nom" TEXT NOT NULL,
  "contingut" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadPendent_pkey" PRIMARY KEY ("uploadId", "ordre")
)`;

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = db
      .$executeRawUnsafe(CREATE_TABLE)
      .then(() => undefined)
      .catch((error: unknown) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

function asBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string" && value.startsWith("\\x")) {
    return Buffer.from(value.slice(2), "hex");
  }
  return null;
}

export async function desarTros(input: {
  uploadId: string;
  index: number;
  total: number;
  nom: string;
  contingut: Buffer;
}): Promise<void> {
  await ensureTable();
  if (input.index === 0) {
    await db
      .$executeRawUnsafe(`DELETE FROM "UploadPendent" WHERE "createdAt" < NOW() - INTERVAL '1 day'`)
      .catch((error: unknown) => {
        console.warn("upload-parts: no s'han pogut netejar pujades antigues", error);
      });
  }

  await db.$executeRaw`
    INSERT INTO "UploadPendent" ("uploadId", "ordre", "total", "nom", "contingut")
    VALUES (${input.uploadId}, ${input.index}, ${input.total}, ${input.nom}, ${input.contingut})
    ON CONFLICT ("uploadId", "ordre") DO UPDATE SET
      "contingut" = EXCLUDED."contingut",
      "total" = EXCLUDED."total",
      "nom" = EXCLUDED."nom"
  `;
}

export async function llegirFitxerComplet(uploadId: string, total: number): Promise<Buffer | null> {
  await ensureTable();
  const rows = await db.$queryRaw<Array<{ ordre: number; contingut: unknown }>>`
    SELECT "ordre", "contingut" FROM "UploadPendent"
    WHERE "uploadId" = ${uploadId}
    ORDER BY "ordre" ASC
  `;
  if (rows.length !== total) return null;

  const parts: Buffer[] = [];
  for (let i = 0; i < total; i++) {
    const row = rows.find((item) => Number(item.ordre) === i);
    const buffer = row ? asBuffer(row.contingut) : null;
    if (!buffer) return null;
    parts.push(buffer);
  }
  return Buffer.concat(parts);
}

export async function eliminarPujada(uploadId: string): Promise<void> {
  await ensureTable();
  await db.$executeRaw`DELETE FROM "UploadPendent" WHERE "uploadId" = ${uploadId}`;
}

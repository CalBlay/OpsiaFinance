-- CreateEnum
CREATE TYPE "FontImportConsolidacio" AS ENUM ('MIN_COINCIDENT', 'IMPORT_FIX_MENSUAL');

-- AlterTable NormaConsolidacio
ALTER TABLE "NormaConsolidacio" ADD COLUMN "nodesOrigen" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "NormaConsolidacio" ADD COLUMN "nodesDesti" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "NormaConsolidacio" ADD COLUMN "fontImport" "FontImportConsolidacio" NOT NULL DEFAULT 'MIN_COINCIDENT';
ALTER TABLE "NormaConsolidacio" ADD COLUMN "notaOrigen" TEXT;
ALTER TABLE "NormaConsolidacio" ADD COLUMN "notaDesti" TEXT;

-- CreateTable
CREATE TABLE "NormaConsolidacioImport" (
    "id" TEXT NOT NULL,
    "normaId" TEXT NOT NULL,
    "any" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "import" DECIMAL(18,2) NOT NULL,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormaConsolidacioImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NormaConsolidacioImport_normaId_any_idx" ON "NormaConsolidacioImport"("normaId", "any");

-- CreateIndex
CREATE UNIQUE INDEX "NormaConsolidacioImport_normaId_any_mes_key" ON "NormaConsolidacioImport"("normaId", "any", "mes");

-- AddForeignKey
ALTER TABLE "NormaConsolidacioImport" ADD CONSTRAINT "NormaConsolidacioImport_normaId_fkey" FOREIGN KEY ("normaId") REFERENCES "NormaConsolidacio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

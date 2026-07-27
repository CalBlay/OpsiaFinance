/*
  Warnings:

  - You are about to drop the column `importId` on the `ImportRow` table. All the data in the column will be lost.
  - You are about to drop the `Import` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `importacioId` to the `ImportRow` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Import" DROP CONSTRAINT "Import_creatPer_fkey";

-- DropForeignKey
ALTER TABLE "Import" DROP CONSTRAINT "Import_formatInformeId_fkey";

-- DropForeignKey
ALTER TABLE "Import" DROP CONSTRAINT "Import_periodId_fkey";

-- DropForeignKey
ALTER TABLE "ImportRow" DROP CONSTRAINT "ImportRow_importId_fkey";

-- DropIndex
DROP INDEX "ImportRow_importId_idx";

-- AlterTable
ALTER TABLE "ImportRow" DROP COLUMN "importId",
ADD COLUMN     "importacioId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Import";

-- CreateTable
CREATE TABLE "Importacio" (
    "id" TEXT NOT NULL,
    "nomFitxer" TEXT NOT NULL,
    "rutaStorage" TEXT,
    "mida" INTEGER,
    "estat" "EstatImport" NOT NULL DEFAULT 'PENDENT',
    "notes" TEXT,
    "formatInformeId" TEXT,
    "periodId" TEXT,
    "creatPer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmatAt" TIMESTAMP(3),

    CONSTRAINT "Importacio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportRow_importacioId_idx" ON "ImportRow"("importacioId");

-- AddForeignKey
ALTER TABLE "Importacio" ADD CONSTRAINT "Importacio_formatInformeId_fkey" FOREIGN KEY ("formatInformeId") REFERENCES "FormatInforme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Importacio" ADD CONSTRAINT "Importacio_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Importacio" ADD CONSTRAINT "Importacio_creatPer_fkey" FOREIGN KEY ("creatPer") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importacioId_fkey" FOREIGN KEY ("importacioId") REFERENCES "Importacio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

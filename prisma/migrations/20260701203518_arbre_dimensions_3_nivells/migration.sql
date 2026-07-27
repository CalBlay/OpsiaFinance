/*
  Warnings:

  - A unique constraint covering the columns `[liniaNegociId,codi]` on the table `Centre` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Centre` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `LiniaNegoci` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Centre" DROP CONSTRAINT "Centre_liniaNegociId_fkey";

-- DropIndex
DROP INDEX "Centre_codi_key";

-- AlterTable
ALTER TABLE "Centre" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ordre" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ImportRow" ADD COLUMN     "departamentId" TEXT;

-- AlterTable
ALTER TABLE "LiniaNegoci" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Departament" (
    "id" TEXT NOT NULL,
    "codi" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "centreId" TEXT NOT NULL,

    CONSTRAINT "Departament_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Departament_centreId_idx" ON "Departament"("centreId");

-- CreateIndex
CREATE UNIQUE INDEX "Departament_centreId_codi_key" ON "Departament"("centreId", "codi");

-- CreateIndex
CREATE INDEX "Centre_liniaNegociId_idx" ON "Centre"("liniaNegociId");

-- CreateIndex
CREATE UNIQUE INDEX "Centre_liniaNegociId_codi_key" ON "Centre"("liniaNegociId", "codi");

-- CreateIndex
CREATE INDEX "ImportRow_departamentId_idx" ON "ImportRow"("departamentId");

-- AddForeignKey
ALTER TABLE "Centre" ADD CONSTRAINT "Centre_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Departament" ADD CONSTRAINT "Departament_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_departamentId_fkey" FOREIGN KEY ("departamentId") REFERENCES "Departament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

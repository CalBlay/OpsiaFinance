-- CreateEnum
CREATE TYPE "GrupConsolidacio" AS ENUM ('CALBLAY_INTRA', 'GRUP_EMPRESARIAL');

-- CreateEnum
CREATE TYPE "TipusNormaConsolidacio" AS ENUM ('EXCLURE_NODE', 'ELIMINAR_PARELL_INTER');

-- CreateTable
CREATE TABLE "NormaConsolidacio" (
    "id" TEXT NOT NULL,
    "codi" TEXT,
    "nom" TEXT NOT NULL,
    "descripcio" TEXT,
    "grup" "GrupConsolidacio" NOT NULL,
    "tipus" "TipusNormaConsolidacio" NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actiu" BOOLEAN NOT NULL DEFAULT true,
    "nodeExcloure" INTEGER,
    "nodesAjust" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "grupEmpresaOrigen" TEXT,
    "nodeOrigen" INTEGER,
    "grupEmpresaDesti" TEXT,
    "nodeDesti" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormaConsolidacio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NormaConsolidacio_codi_key" ON "NormaConsolidacio"("codi");

-- CreateIndex
CREATE INDEX "NormaConsolidacio_grup_idx" ON "NormaConsolidacio"("grup");

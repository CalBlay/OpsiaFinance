-- AlterEnum
ALTER TYPE "TipusCarregaFitxer" ADD VALUE IF NOT EXISTS 'PLANTILLA_RRHH';

-- CreateTable
CREATE TABLE "PlantillaRrhh" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "departamentId" TEXT,
    "nombrePersones" INTEGER NOT NULL,
    "textOrigen" TEXT,
    "carregaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaRrhh_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantillaRrhh_periodId_idx" ON "PlantillaRrhh"("periodId");

-- CreateIndex
CREATE INDEX "PlantillaRrhh_centreId_idx" ON "PlantillaRrhh"("centreId");

-- CreateIndex
CREATE INDEX "PlantillaRrhh_departamentId_idx" ON "PlantillaRrhh"("departamentId");

-- CreateIndex
CREATE INDEX "PlantillaRrhh_carregaId_idx" ON "PlantillaRrhh"("carregaId");

-- CreateIndex
CREATE INDEX "PlantillaRrhh_periodId_centreId_idx" ON "PlantillaRrhh"("periodId", "centreId");

-- AddForeignKey
ALTER TABLE "PlantillaRrhh" ADD CONSTRAINT "PlantillaRrhh_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaRrhh" ADD CONSTRAINT "PlantillaRrhh_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaRrhh" ADD CONSTRAINT "PlantillaRrhh_departamentId_fkey" FOREIGN KEY ("departamentId") REFERENCES "Departament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaRrhh" ADD CONSTRAINT "PlantillaRrhh_carregaId_fkey" FOREIGN KEY ("carregaId") REFERENCES "CarregaFitxer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

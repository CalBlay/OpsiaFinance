-- AlterTable
ALTER TABLE "Importacio" ADD COLUMN "liniaNegociId" TEXT;

-- CreateIndex
CREATE INDEX "Importacio_liniaNegociId_idx" ON "Importacio"("liniaNegociId");

-- CreateIndex
CREATE INDEX "Importacio_periodId_liniaNegociId_formatInformeId_idx" ON "Importacio"("periodId", "liniaNegociId", "formatInformeId");

-- AddForeignKey
ALTER TABLE "Importacio" ADD CONSTRAINT "Importacio_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

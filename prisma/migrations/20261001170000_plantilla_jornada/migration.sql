-- Plantilla jornada (caps + hores setmanals per codi imputació)

ALTER TYPE "TipusCarregaFitxer" ADD VALUE IF NOT EXISTS 'PLANTILLA_JORNADA';

CREATE TABLE "PlantillaJornada" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "departamentId" TEXT,
    "nombrePersones" INTEGER NOT NULL DEFAULT 0,
    "horesSetmanals" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "carregaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaJornada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlantillaJornada_periodId_idx" ON "PlantillaJornada"("periodId");
CREATE INDEX "PlantillaJornada_centreId_idx" ON "PlantillaJornada"("centreId");
CREATE INDEX "PlantillaJornada_departamentId_idx" ON "PlantillaJornada"("departamentId");
CREATE INDEX "PlantillaJornada_carregaId_idx" ON "PlantillaJornada"("carregaId");
CREATE INDEX "PlantillaJornada_periodId_centreId_idx" ON "PlantillaJornada"("periodId", "centreId");

ALTER TABLE "PlantillaJornada" ADD CONSTRAINT "PlantillaJornada_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantillaJornada" ADD CONSTRAINT "PlantillaJornada_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantillaJornada" ADD CONSTRAINT "PlantillaJornada_departamentId_fkey" FOREIGN KEY ("departamentId") REFERENCES "Departament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlantillaJornada" ADD CONSTRAINT "PlantillaJornada_carregaId_fkey" FOREIGN KEY ("carregaId") REFERENCES "CarregaFitxer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

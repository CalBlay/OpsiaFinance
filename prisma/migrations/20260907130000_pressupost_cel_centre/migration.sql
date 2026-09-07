-- AlterTable
ALTER TABLE "PressupostLn" ADD COLUMN "generalDesDeCentres" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PressupostCelCentre" (
    "id" TEXT NOT NULL,
    "pressupostId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "concepteResultatId" TEXT NOT NULL,
    "import" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressupostCelCentre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PressupostCelCentre_pressupostId_idx" ON "PressupostCelCentre"("pressupostId");

-- CreateIndex
CREATE INDEX "PressupostCelCentre_centreId_idx" ON "PressupostCelCentre"("centreId");

-- CreateIndex
CREATE INDEX "PressupostCelCentre_concepteResultatId_idx" ON "PressupostCelCentre"("concepteResultatId");

-- CreateIndex
CREATE UNIQUE INDEX "PressupostCelCentre_pressupostId_centreId_mes_concepteResultatId_key" ON "PressupostCelCentre"("pressupostId", "centreId", "mes", "concepteResultatId");

-- AddForeignKey
ALTER TABLE "PressupostCelCentre" ADD CONSTRAINT "PressupostCelCentre_pressupostId_fkey" FOREIGN KEY ("pressupostId") REFERENCES "PressupostLn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressupostCelCentre" ADD CONSTRAINT "PressupostCelCentre_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressupostCelCentre" ADD CONSTRAINT "PressupostCelCentre_concepteResultatId_fkey" FOREIGN KEY ("concepteResultatId") REFERENCES "ConcepteResultat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

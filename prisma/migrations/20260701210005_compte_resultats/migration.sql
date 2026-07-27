-- CreateTable
CREATE TABLE "ConcepteResultat" (
    "id" TEXT NOT NULL,
    "node" INTEGER NOT NULL,
    "descripcio" TEXT NOT NULL,
    "esSubtotal" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcepteResultat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DadaResultat" (
    "id" TEXT NOT NULL,
    "importacioId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "concepteResultatId" TEXT NOT NULL,
    "centreId" TEXT,
    "liniaNegociId" TEXT,
    "senseCentre" BOOLEAN NOT NULL DEFAULT false,
    "import" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DadaResultat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConcepteResultat_node_key" ON "ConcepteResultat"("node");

-- CreateIndex
CREATE INDEX "DadaResultat_importacioId_idx" ON "DadaResultat"("importacioId");

-- CreateIndex
CREATE INDEX "DadaResultat_periodId_idx" ON "DadaResultat"("periodId");

-- CreateIndex
CREATE INDEX "DadaResultat_concepteResultatId_idx" ON "DadaResultat"("concepteResultatId");

-- CreateIndex
CREATE INDEX "DadaResultat_centreId_idx" ON "DadaResultat"("centreId");

-- CreateIndex
CREATE INDEX "DadaResultat_liniaNegociId_idx" ON "DadaResultat"("liniaNegociId");

-- AddForeignKey
ALTER TABLE "DadaResultat" ADD CONSTRAINT "DadaResultat_importacioId_fkey" FOREIGN KEY ("importacioId") REFERENCES "Importacio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DadaResultat" ADD CONSTRAINT "DadaResultat_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DadaResultat" ADD CONSTRAINT "DadaResultat_concepteResultatId_fkey" FOREIGN KEY ("concepteResultatId") REFERENCES "ConcepteResultat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DadaResultat" ADD CONSTRAINT "DadaResultat_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DadaResultat" ADD CONSTRAINT "DadaResultat_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

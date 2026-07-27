-- CreateTable
CREATE TABLE "Ajust" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "concepteResultatId" TEXT NOT NULL,
    "centreId" TEXT,
    "liniaNegociId" TEXT,
    "import" DECIMAL(18,2) NOT NULL,
    "motiu" TEXT NOT NULL,
    "creatPer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ajust_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ajust_periodId_idx" ON "Ajust"("periodId");

-- CreateIndex
CREATE INDEX "Ajust_concepteResultatId_idx" ON "Ajust"("concepteResultatId");

-- CreateIndex
CREATE INDEX "Ajust_centreId_idx" ON "Ajust"("centreId");

-- CreateIndex
CREATE INDEX "Ajust_liniaNegociId_idx" ON "Ajust"("liniaNegociId");

-- AddForeignKey
ALTER TABLE "Ajust" ADD CONSTRAINT "Ajust_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ajust" ADD CONSTRAINT "Ajust_concepteResultatId_fkey" FOREIGN KEY ("concepteResultatId") REFERENCES "ConcepteResultat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ajust" ADD CONSTRAINT "Ajust_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ajust" ADD CONSTRAINT "Ajust_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ajust" ADD CONSTRAINT "Ajust_creatPer_fkey" FOREIGN KEY ("creatPer") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

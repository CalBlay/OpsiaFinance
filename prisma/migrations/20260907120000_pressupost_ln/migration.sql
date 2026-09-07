-- CreateEnum
CREATE TYPE "PressupostEstat" AS ENUM ('ESBORRANY', 'CONFIRMAT');

-- CreateTable
CREATE TABLE "PressupostLn" (
    "id" TEXT NOT NULL,
    "any" INTEGER NOT NULL,
    "liniaNegociId" TEXT NOT NULL,
    "estat" "PressupostEstat" NOT NULL DEFAULT 'ESBORRANY',
    "notes" TEXT,
    "creatPer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressupostLn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressupostCelLn" (
    "id" TEXT NOT NULL,
    "pressupostId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "concepteResultatId" TEXT NOT NULL,
    "import" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressupostCelLn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PressupostLn_any_idx" ON "PressupostLn"("any");

-- CreateIndex
CREATE INDEX "PressupostLn_liniaNegociId_idx" ON "PressupostLn"("liniaNegociId");

-- CreateIndex
CREATE UNIQUE INDEX "PressupostLn_any_liniaNegociId_key" ON "PressupostLn"("any", "liniaNegociId");

-- CreateIndex
CREATE INDEX "PressupostCelLn_pressupostId_idx" ON "PressupostCelLn"("pressupostId");

-- CreateIndex
CREATE INDEX "PressupostCelLn_concepteResultatId_idx" ON "PressupostCelLn"("concepteResultatId");

-- CreateIndex
CREATE UNIQUE INDEX "PressupostCelLn_pressupostId_mes_concepteResultatId_key" ON "PressupostCelLn"("pressupostId", "mes", "concepteResultatId");

-- AddForeignKey
ALTER TABLE "PressupostLn" ADD CONSTRAINT "PressupostLn_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressupostLn" ADD CONSTRAINT "PressupostLn_creatPer_fkey" FOREIGN KEY ("creatPer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressupostCelLn" ADD CONSTRAINT "PressupostCelLn_pressupostId_fkey" FOREIGN KEY ("pressupostId") REFERENCES "PressupostLn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressupostCelLn" ADD CONSTRAINT "PressupostCelLn_concepteResultatId_fkey" FOREIGN KEY ("concepteResultatId") REFERENCES "ConcepteResultat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

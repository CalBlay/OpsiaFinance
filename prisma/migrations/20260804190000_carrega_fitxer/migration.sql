-- CreateEnum
CREATE TYPE "TipusCarregaFitxer" AS ENUM ('COST_SALARIAL', 'VENDES_V', 'VENDES_DETALL', 'VENDES_PACK');

-- CreateTable
CREATE TABLE "CarregaFitxer" (
    "id" TEXT NOT NULL,
    "tipus" "TipusCarregaFitxer" NOT NULL,
    "nomFitxer" TEXT NOT NULL,
    "mida" INTEGER,
    "periodId" TEXT,
    "resum" TEXT,
    "notes" TEXT,
    "creatPer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarregaFitxer_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CostSalarialRestaurant" ADD COLUMN "carregaId" TEXT;
ALTER TABLE "VendaDiariaRestaurant" ADD COLUMN "carregaId" TEXT;
ALTER TABLE "VendaArticleRestaurant" ADD COLUMN "carregaId" TEXT;

-- CreateIndex
CREATE INDEX "CarregaFitxer_tipus_createdAt_idx" ON "CarregaFitxer"("tipus", "createdAt");
CREATE INDEX "CarregaFitxer_periodId_idx" ON "CarregaFitxer"("periodId");
CREATE INDEX "CostSalarialRestaurant_carregaId_idx" ON "CostSalarialRestaurant"("carregaId");
CREATE INDEX "VendaDiariaRestaurant_carregaId_idx" ON "VendaDiariaRestaurant"("carregaId");
CREATE INDEX "VendaArticleRestaurant_carregaId_idx" ON "VendaArticleRestaurant"("carregaId");

-- AddForeignKey
ALTER TABLE "CarregaFitxer" ADD CONSTRAINT "CarregaFitxer_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CarregaFitxer" ADD CONSTRAINT "CarregaFitxer_creatPer_fkey" FOREIGN KEY ("creatPer") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostSalarialRestaurant" ADD CONSTRAINT "CostSalarialRestaurant_carregaId_fkey" FOREIGN KEY ("carregaId") REFERENCES "CarregaFitxer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendaDiariaRestaurant" ADD CONSTRAINT "VendaDiariaRestaurant_carregaId_fkey" FOREIGN KEY ("carregaId") REFERENCES "CarregaFitxer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendaArticleRestaurant" ADD CONSTRAINT "VendaArticleRestaurant_carregaId_fkey" FOREIGN KEY ("carregaId") REFERENCES "CarregaFitxer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "OrigenVendaArticle" AS ENUM ('DETALL', 'PACK');

-- CreateTable
CREATE TABLE "VendaDiariaRestaurant" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "dia" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "unitats" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "base" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendaDiariaRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendaArticleRestaurant" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "origen" "OrigenVendaArticle" NOT NULL,
    "article" TEXT NOT NULL,
    "tipusArticle" TEXT,
    "unitats" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "base" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendaArticleRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendaDiariaRestaurant_periodId_idx" ON "VendaDiariaRestaurant"("periodId");

-- CreateIndex
CREATE INDEX "VendaDiariaRestaurant_centreId_idx" ON "VendaDiariaRestaurant"("centreId");

-- CreateIndex
CREATE UNIQUE INDEX "VendaDiariaRestaurant_periodId_centreId_dia_key" ON "VendaDiariaRestaurant"("periodId", "centreId", "dia");

-- CreateIndex
CREATE INDEX "VendaArticleRestaurant_periodId_idx" ON "VendaArticleRestaurant"("periodId");

-- CreateIndex
CREATE INDEX "VendaArticleRestaurant_centreId_idx" ON "VendaArticleRestaurant"("centreId");

-- CreateIndex
CREATE INDEX "VendaArticleRestaurant_origen_idx" ON "VendaArticleRestaurant"("origen");

-- CreateIndex
CREATE UNIQUE INDEX "VendaArticleRestaurant_periodId_centreId_origen_article_key" ON "VendaArticleRestaurant"("periodId", "centreId", "origen", "article");

-- AddForeignKey
ALTER TABLE "VendaDiariaRestaurant" ADD CONSTRAINT "VendaDiariaRestaurant_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaDiariaRestaurant" ADD CONSTRAINT "VendaDiariaRestaurant_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaArticleRestaurant" ADD CONSTRAINT "VendaArticleRestaurant_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendaArticleRestaurant" ADD CONSTRAINT "VendaArticleRestaurant_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

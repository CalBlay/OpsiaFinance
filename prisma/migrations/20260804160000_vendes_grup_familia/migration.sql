-- AlterTable
ALTER TABLE "VendaArticleRestaurant" ADD COLUMN "grup" TEXT;
ALTER TABLE "VendaArticleRestaurant" ADD COLUMN "familia" TEXT;
ALTER TABLE "VendaArticleRestaurant" ADD COLUMN "subfamilia" TEXT;

-- CreateEnum
CREATE TYPE "CategoriaVenda" AS ENUM ('MENJAR', 'BEGUDA');

-- AlterTable
ALTER TABLE "VendaArticleRestaurant" ADD COLUMN "categoria" "CategoriaVenda";

-- CreateIndex
CREATE INDEX "VendaArticleRestaurant_categoria_idx" ON "VendaArticleRestaurant"("categoria");

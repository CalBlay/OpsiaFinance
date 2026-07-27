-- CreateEnum
CREATE TYPE "TipusInforme" AS ENUM ('PYG_MENSUAL_CENTRES', 'PYG_MENSUAL_LN', 'PYG_EXERCICI_LN', 'PYG_EXERCICI_CENTRE', 'PYG_CENTRES', 'PYG_LN', 'EVALUACIO_NEGOCI', 'ALTRE');

-- CreateEnum
CREATE TYPE "EstatImport" AS ENUM ('PENDENT', 'CLASSIFICAT', 'REVISAT', 'CONFIRMAT', 'ERROR', 'ARXIVAT');

-- CreateTable
CREATE TABLE "LiniaNegoci" (
    "id" TEXT NOT NULL,
    "codi" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LiniaNegoci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Centre" (
    "id" TEXT NOT NULL,
    "codi" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "liniaNegociId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Centre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "any" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormatInforme" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "descripcio" TEXT,
    "tipusInforme" "TipusInforme" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormatInforme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL,
    "nomFitxer" TEXT NOT NULL,
    "rutaStorage" TEXT,
    "mida" INTEGER,
    "estat" "EstatImport" NOT NULL DEFAULT 'PENDENT',
    "notes" TEXT,
    "formatInformeId" TEXT,
    "periodId" TEXT,
    "creatPer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmatAt" TIMESTAMP(3),

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "liniaNegociId" TEXT,
    "centreId" TEXT,
    "codiCompte" TEXT,
    "nomCompte" TEXT NOT NULL,
    "familiaCompte" TEXT,
    "import" DECIMAL(18,2) NOT NULL,
    "esAjust" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiniaNegoci_codi_key" ON "LiniaNegoci"("codi");

-- CreateIndex
CREATE UNIQUE INDEX "Centre_codi_key" ON "Centre"("codi");

-- CreateIndex
CREATE UNIQUE INDEX "Period_any_mes_key" ON "Period"("any", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "FormatInforme_nom_key" ON "FormatInforme"("nom");

-- CreateIndex
CREATE INDEX "ImportRow_importId_idx" ON "ImportRow"("importId");

-- CreateIndex
CREATE INDEX "ImportRow_periodId_idx" ON "ImportRow"("periodId");

-- CreateIndex
CREATE INDEX "ImportRow_liniaNegociId_idx" ON "ImportRow"("liniaNegociId");

-- CreateIndex
CREATE INDEX "ImportRow_centreId_idx" ON "ImportRow"("centreId");

-- AddForeignKey
ALTER TABLE "Centre" ADD CONSTRAINT "Centre_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_formatInformeId_fkey" FOREIGN KEY ("formatInformeId") REFERENCES "FormatInforme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_creatPer_fkey" FOREIGN KEY ("creatPer") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

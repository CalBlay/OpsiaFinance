-- CreateEnum
CREATE TYPE "TipusNormaRepartiment" AS ENUM ('PERCENT_VENDES_PROPIES', 'PERCENT_POOL_CENTRAL', 'IMPORT_FIX', 'RESTEM', 'REPARTIMENT_PROPORCIONAL');

-- CreateEnum
CREATE TYPE "EstatExecucioRepartiment" AS ENUM ('BORRADOR', 'CONFIRMAT');

-- CreateTable
CREATE TABLE "RepartimentGrup" (
    "id" TEXT NOT NULL,
    "codi" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepartimentGrup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepartimentGrupMembre" (
    "id" TEXT NOT NULL,
    "grupId" TEXT NOT NULL,
    "liniaNegociId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RepartimentGrupMembre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormaRepartiment" (
    "id" TEXT NOT NULL,
    "nom" TEXT,
    "tipus" "TipusNormaRepartiment" NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actiu" BOOLEAN NOT NULL DEFAULT true,
    "liniaNegociDestiId" TEXT,
    "liniaNegociOrigenId" TEXT,
    "concepteNode" INTEGER NOT NULL,
    "grupId" TEXT,
    "valorPercent" DECIMAL(9,4),
    "valorImport" DECIMAL(18,2),
    "vigentDesDe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigentFins" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormaRepartiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecucioRepartiment" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "estat" "EstatExecucioRepartiment" NOT NULL DEFAULT 'BORRADOR',
    "calculatAt" TIMESTAMP(3),
    "confirmatAt" TIMESTAMP(3),
    "confirmatPer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecucioRepartiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesRepartiment" (
    "id" TEXT NOT NULL,
    "execucioId" TEXT NOT NULL,
    "grupId" TEXT NOT NULL,
    "liniaNegociId" TEXT NOT NULL,
    "vendesBase" DECIMAL(18,2) NOT NULL,
    "pesCalculat" DECIMAL(9,6) NOT NULL,
    "pesOverride" DECIMAL(9,6),

    CONSTRAINT "PesRepartiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentRepartiment" (
    "id" TEXT NOT NULL,
    "execucioId" TEXT NOT NULL,
    "normaId" TEXT,
    "liniaNegociDestiId" TEXT NOT NULL,
    "concepteNode" INTEGER NOT NULL,
    "importCalculat" DECIMAL(18,2) NOT NULL,
    "importOverride" DECIMAL(18,2),
    "detallCalcul" TEXT,

    CONSTRAINT "MovimentRepartiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepartimentGrup_codi_key" ON "RepartimentGrup"("codi");

-- CreateIndex
CREATE INDEX "RepartimentGrupMembre_liniaNegociId_idx" ON "RepartimentGrupMembre"("liniaNegociId");

-- CreateIndex
CREATE UNIQUE INDEX "RepartimentGrupMembre_grupId_liniaNegociId_key" ON "RepartimentGrupMembre"("grupId", "liniaNegociId");

-- CreateIndex
CREATE INDEX "NormaRepartiment_liniaNegociDestiId_idx" ON "NormaRepartiment"("liniaNegociDestiId");

-- CreateIndex
CREATE INDEX "NormaRepartiment_liniaNegociOrigenId_idx" ON "NormaRepartiment"("liniaNegociOrigenId");

-- CreateIndex
CREATE INDEX "NormaRepartiment_grupId_idx" ON "NormaRepartiment"("grupId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecucioRepartiment_periodId_key" ON "ExecucioRepartiment"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "PesRepartiment_execucioId_grupId_liniaNegociId_key" ON "PesRepartiment"("execucioId", "grupId", "liniaNegociId");

-- CreateIndex
CREATE INDEX "MovimentRepartiment_execucioId_idx" ON "MovimentRepartiment"("execucioId");

-- CreateIndex
CREATE INDEX "MovimentRepartiment_liniaNegociDestiId_idx" ON "MovimentRepartiment"("liniaNegociDestiId");

-- AddForeignKey
ALTER TABLE "RepartimentGrupMembre" ADD CONSTRAINT "RepartimentGrupMembre_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "RepartimentGrup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepartimentGrupMembre" ADD CONSTRAINT "RepartimentGrupMembre_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormaRepartiment" ADD CONSTRAINT "NormaRepartiment_liniaNegociDestiId_fkey" FOREIGN KEY ("liniaNegociDestiId") REFERENCES "LiniaNegoci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormaRepartiment" ADD CONSTRAINT "NormaRepartiment_liniaNegociOrigenId_fkey" FOREIGN KEY ("liniaNegociOrigenId") REFERENCES "LiniaNegoci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormaRepartiment" ADD CONSTRAINT "NormaRepartiment_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "RepartimentGrup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucioRepartiment" ADD CONSTRAINT "ExecucioRepartiment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesRepartiment" ADD CONSTRAINT "PesRepartiment_execucioId_fkey" FOREIGN KEY ("execucioId") REFERENCES "ExecucioRepartiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesRepartiment" ADD CONSTRAINT "PesRepartiment_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "RepartimentGrup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesRepartiment" ADD CONSTRAINT "PesRepartiment_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentRepartiment" ADD CONSTRAINT "MovimentRepartiment_execucioId_fkey" FOREIGN KEY ("execucioId") REFERENCES "ExecucioRepartiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentRepartiment" ADD CONSTRAINT "MovimentRepartiment_normaId_fkey" FOREIGN KEY ("normaId") REFERENCES "NormaRepartiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentRepartiment" ADD CONSTRAINT "MovimentRepartiment_liniaNegociDestiId_fkey" FOREIGN KEY ("liniaNegociDestiId") REFERENCES "LiniaNegoci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

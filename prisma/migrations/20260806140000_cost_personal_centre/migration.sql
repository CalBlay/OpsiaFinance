-- CreateEnum
ALTER TYPE "TipusCarregaFitxer" ADD VALUE IF NOT EXISTS 'COST_PERSONAL_CENTRE';

-- CreateTable
CREATE TABLE IF NOT EXISTS "MapeigCodiCostPersonal" (
    "id" TEXT NOT NULL,
    "codi" TEXT NOT NULL,
    "text" TEXT,
    "centreId" TEXT NOT NULL,
    "departamentSalarial" "DepartamentSalarial",
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapeigCodiCostPersonal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MapeigCodiCostPersonal_codi_key" ON "MapeigCodiCostPersonal"("codi");
CREATE INDEX IF NOT EXISTS "MapeigCodiCostPersonal_centreId_idx" ON "MapeigCodiCostPersonal"("centreId");
CREATE INDEX IF NOT EXISTS "MapeigCodiCostPersonal_departamentSalarial_idx" ON "MapeigCodiCostPersonal"("departamentSalarial");

-- CreateTable
CREATE TABLE IF NOT EXISTS "CostPersonalCentre" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "departamentSalarial" "DepartamentSalarial",
    "carregaId" TEXT,
    "codiOrigen" TEXT,
    "textOrigen" TEXT,
    "importBrut" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "segSocialEmpresa" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalSegSocial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costPersonal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostPersonalCentre_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CostPersonalCentre_periodId_idx" ON "CostPersonalCentre"("periodId");
CREATE INDEX IF NOT EXISTS "CostPersonalCentre_centreId_idx" ON "CostPersonalCentre"("centreId");
CREATE INDEX IF NOT EXISTS "CostPersonalCentre_carregaId_idx" ON "CostPersonalCentre"("carregaId");
CREATE INDEX IF NOT EXISTS "CostPersonalCentre_periodId_centreId_idx" ON "CostPersonalCentre"("periodId", "centreId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MapeigCodiCostPersonal" ADD CONSTRAINT "MapeigCodiCostPersonal_centreId_fkey"
    FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CostPersonalCentre" ADD CONSTRAINT "CostPersonalCentre_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CostPersonalCentre" ADD CONSTRAINT "CostPersonalCentre_centreId_fkey"
    FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CostPersonalCentre" ADD CONSTRAINT "CostPersonalCentre_carregaId_fkey"
    FOREIGN KEY ("carregaId") REFERENCES "CarregaFitxer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

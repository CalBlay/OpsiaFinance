-- Tipus de càrrega i origen nòmina vs millores (coexisteixen el mateix mes).

ALTER TYPE "TipusCarregaFitxer" ADD VALUE IF NOT EXISTS 'COST_PERSONAL_MILLORES';

DO $$ BEGIN
  CREATE TYPE "OrigenCostPersonalCentre" AS ENUM ('NOMINA', 'MILLORES');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CostPersonalCentre"
  ADD COLUMN IF NOT EXISTS "origen" "OrigenCostPersonalCentre" NOT NULL DEFAULT 'NOMINA';

CREATE INDEX IF NOT EXISTS "CostPersonalCentre_periodId_origen_idx"
  ON "CostPersonalCentre"("periodId", "origen");

-- Cost personal importat: lligar fets al departament de Dimensions (arbre).
ALTER TABLE "CostPersonalCentre" ADD COLUMN IF NOT EXISTS "departamentId" TEXT;

CREATE INDEX IF NOT EXISTS "CostPersonalCentre_departamentId_idx" ON "CostPersonalCentre"("departamentId");

DO $$ BEGIN
  ALTER TABLE "CostPersonalCentre" ADD CONSTRAINT "CostPersonalCentre_departamentId_fkey"
    FOREIGN KEY ("departamentId") REFERENCES "Departament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

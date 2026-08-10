-- Mapeig cost personal: destí pot ser un departament de l'arbre de dimensions.
ALTER TABLE "MapeigCodiCostPersonal" ADD COLUMN IF NOT EXISTS "departamentId" TEXT;

CREATE INDEX IF NOT EXISTS "MapeigCodiCostPersonal_departamentId_idx"
  ON "MapeigCodiCostPersonal"("departamentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MapeigCodiCostPersonal_departamentId_fkey'
  ) THEN
    ALTER TABLE "MapeigCodiCostPersonal"
      ADD CONSTRAINT "MapeigCodiCostPersonal_departamentId_fkey"
      FOREIGN KEY ("departamentId") REFERENCES "Departament"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

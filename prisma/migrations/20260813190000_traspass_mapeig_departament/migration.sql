-- Mapeig traspassos personal: destí pot ser un departament de l'arbre de dimensions.
ALTER TABLE "MapeigTextCentreTreball" ADD COLUMN IF NOT EXISTS "departamentId" TEXT;

CREATE INDEX IF NOT EXISTS "MapeigTextCentreTreball_departamentId_idx"
  ON "MapeigTextCentreTreball"("departamentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MapeigTextCentreTreball_departamentId_fkey'
  ) THEN
    ALTER TABLE "MapeigTextCentreTreball"
      ADD CONSTRAINT "MapeigTextCentreTreball_departamentId_fkey"
      FOREIGN KEY ("departamentId") REFERENCES "Departament"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Moviments de traspass: departament d'origen i destí de l'arbre (informatiu).
ALTER TABLE "MovimentTraspassPersonal" ADD COLUMN IF NOT EXISTS "departamentOrigenId" TEXT;
ALTER TABLE "MovimentTraspassPersonal" ADD COLUMN IF NOT EXISTS "departamentDestiId" TEXT;

CREATE INDEX IF NOT EXISTS "MovimentTraspassPersonal_departamentOrigenId_idx"
  ON "MovimentTraspassPersonal"("departamentOrigenId");

CREATE INDEX IF NOT EXISTS "MovimentTraspassPersonal_departamentDestiId_idx"
  ON "MovimentTraspassPersonal"("departamentDestiId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MovimentTraspassPersonal_departamentOrigenId_fkey'
  ) THEN
    ALTER TABLE "MovimentTraspassPersonal"
      ADD CONSTRAINT "MovimentTraspassPersonal_departamentOrigenId_fkey"
      FOREIGN KEY ("departamentOrigenId") REFERENCES "Departament"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MovimentTraspassPersonal_departamentDestiId_fkey'
  ) THEN
    ALTER TABLE "MovimentTraspassPersonal"
      ADD CONSTRAINT "MovimentTraspassPersonal_departamentDestiId_fkey"
      FOREIGN KEY ("departamentDestiId") REFERENCES "Departament"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

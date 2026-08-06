-- Minuts agregats des de l'Excel d'hores (font de veritat temporal).
ALTER TABLE "MovimentTraspassPersonal" ADD COLUMN IF NOT EXISTS "minuts" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Backfill aproximat per files antigues (hores × 60).
UPDATE "MovimentTraspassPersonal"
SET "minuts" = ROUND("hores" * 60, 2)
WHERE "minuts" = 0 AND "hores" <> 0;

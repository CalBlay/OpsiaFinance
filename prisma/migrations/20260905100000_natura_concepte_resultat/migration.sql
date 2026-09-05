-- CreateEnum
CREATE TYPE "NaturaConcepte" AS ENUM ('INGRES', 'VARIABLE', 'FIX', 'ALIE');

-- AlterTable
ALTER TABLE "ConcepteResultat" ADD COLUMN "natura" "NaturaConcepte";

-- Seed inicial (acord V1): editable després des de Configuració → Compte de resultats.
-- Ingressos
UPDATE "ConcepteResultat" SET "natura" = 'INGRES' WHERE "node" IN (2, 3, 4, 5);
-- Variables
UPDATE "ConcepteResultat" SET "natura" = 'VARIABLE' WHERE "node" IN (7, 8, 9, 10, 21, 44);
-- Fixos (inclou personal; antics «mixtos» com a FIX de moment)
UPDATE "ConcepteResultat" SET "natura" = 'FIX' WHERE "node" IN (13, 14, 15, 16, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 39, 46, 47);
-- Aliè (fora PE d'explotació)
UPDATE "ConcepteResultat" SET "natura" = 'ALIE' WHERE "node" IN (29, 33, 34, 36, 37, 41);
-- Subtotals i títols resten NULL (no apliquen)

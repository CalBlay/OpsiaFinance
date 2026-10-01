-- Elimina Plantilla RRHH (taules + càrregues + valor enum).

DELETE FROM "CarregaFitxer" WHERE "tipus" = 'PLANTILLA_RRHH';

DROP TABLE IF EXISTS "PlantillaRrhh";
DROP TABLE IF EXISTS "MapeigOrgPlantilla";

-- PostgreSQL: recrear enum TipusCarregaFitxer sense PLANTILLA_RRHH
CREATE TYPE "TipusCarregaFitxer_new" AS ENUM (
  'COST_SALARIAL',
  'VENDES_V',
  'VENDES_DETALL',
  'VENDES_PACK',
  'COST_PERSONAL_CENTRE',
  'COST_PERSONAL_MILLORES'
);

ALTER TABLE "CarregaFitxer"
  ALTER COLUMN "tipus" TYPE "TipusCarregaFitxer_new"
  USING ("tipus"::text::"TipusCarregaFitxer_new");

DROP TYPE "TipusCarregaFitxer";
ALTER TYPE "TipusCarregaFitxer_new" RENAME TO "TipusCarregaFitxer";

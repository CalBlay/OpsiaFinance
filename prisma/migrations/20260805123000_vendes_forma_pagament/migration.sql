-- Forma de pagament a vendes diàries (tickets CCR00008)
ALTER TABLE "VendaDiariaRestaurant" ADD COLUMN "formaPagament" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "VendaDiariaRestaurant_periodId_centreId_dia_key";

CREATE UNIQUE INDEX "VendaDiariaRestaurant_periodId_centreId_dia_formaPagament_key"
  ON "VendaDiariaRestaurant"("periodId", "centreId", "dia", "formaPagament");

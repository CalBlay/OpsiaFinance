-- Sprint 2: índexs compostos per filtres calents de consultes / imports
CREATE INDEX IF NOT EXISTS "DadaResultat_periodId_centreId_idx" ON "DadaResultat"("periodId", "centreId");
CREATE INDEX IF NOT EXISTS "DadaResultat_periodId_liniaNegociId_idx" ON "DadaResultat"("periodId", "liniaNegociId");
CREATE INDEX IF NOT EXISTS "DadaResultat_periodId_concepteResultatId_idx" ON "DadaResultat"("periodId", "concepteResultatId");

CREATE INDEX IF NOT EXISTS "CostSalarialRestaurant_centreId_periodId_idx" ON "CostSalarialRestaurant"("centreId", "periodId");

CREATE INDEX IF NOT EXISTS "VendaDiariaRestaurant_centreId_periodId_idx" ON "VendaDiariaRestaurant"("centreId", "periodId");

CREATE INDEX IF NOT EXISTS "VendaArticleRestaurant_centreId_periodId_origen_idx" ON "VendaArticleRestaurant"("centreId", "periodId", "origen");
CREATE INDEX IF NOT EXISTS "VendaArticleRestaurant_centreId_periodId_categoria_idx" ON "VendaArticleRestaurant"("centreId", "periodId", "categoria");

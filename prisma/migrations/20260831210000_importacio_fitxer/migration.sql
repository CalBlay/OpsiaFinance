-- Contingut de l'Excel a la BBDD (Vercel no té disc persistent)
CREATE TABLE "ImportacioFitxer" (
    "importacioId" TEXT NOT NULL,
    "contingut" BYTEA NOT NULL,

    CONSTRAINT "ImportacioFitxer_pkey" PRIMARY KEY ("importacioId")
);

ALTER TABLE "ImportacioFitxer" ADD CONSTRAINT "ImportacioFitxer_importacioId_fkey" FOREIGN KEY ("importacioId") REFERENCES "Importacio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

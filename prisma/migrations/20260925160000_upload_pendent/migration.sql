-- Trossos temporals: cada petició es queda per sota del límit de 4,5 MB de Vercel.
CREATE TABLE IF NOT EXISTS "UploadPendent" (
    "uploadId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "contingut" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadPendent_pkey" PRIMARY KEY ("uploadId", "ordre")
);

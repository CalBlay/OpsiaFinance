-- AlterTable
ALTER TABLE "PressupostLiniaDept" ADD COLUMN "partidaCatalogId" TEXT;

-- CreateTable
CREATE TABLE "PressupostPartidaCatalog" (
    "id" TEXT NOT NULL,
    "codi" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'altres',
    "notes" TEXT,
    "totsDepartaments" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressupostPartidaCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressupostPartidaCatalogDept" (
    "id" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "departamentId" TEXT NOT NULL,

    CONSTRAINT "PressupostPartidaCatalogDept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PressupostPartidaCatalog_codi_key" ON "PressupostPartidaCatalog"("codi");

-- CreateIndex
CREATE INDEX "PressupostPartidaCatalog_isActive_idx" ON "PressupostPartidaCatalog"("isActive");

-- CreateIndex
CREATE INDEX "PressupostPartidaCatalog_categoria_idx" ON "PressupostPartidaCatalog"("categoria");

-- CreateIndex
CREATE INDEX "PressupostPartidaCatalogDept_departamentId_idx" ON "PressupostPartidaCatalogDept"("departamentId");

-- CreateIndex
CREATE UNIQUE INDEX "PressupostPartidaCatalogDept_partidaId_departamentId_key" ON "PressupostPartidaCatalogDept"("partidaId", "departamentId");

-- CreateIndex
CREATE INDEX "PressupostLiniaDept_partidaCatalogId_idx" ON "PressupostLiniaDept"("partidaCatalogId");

-- AddForeignKey
ALTER TABLE "PressupostLiniaDept" ADD CONSTRAINT "PressupostLiniaDept_partidaCatalogId_fkey" FOREIGN KEY ("partidaCatalogId") REFERENCES "PressupostPartidaCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressupostPartidaCatalogDept" ADD CONSTRAINT "PressupostPartidaCatalogDept_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "PressupostPartidaCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressupostPartidaCatalogDept" ADD CONSTRAINT "PressupostPartidaCatalogDept_departamentId_fkey" FOREIGN KEY ("departamentId") REFERENCES "Departament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

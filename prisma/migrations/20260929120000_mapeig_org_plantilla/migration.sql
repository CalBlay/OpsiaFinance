-- CreateTable
CREATE TABLE "MapeigOrgPlantilla" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "departamentId" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapeigOrgPlantilla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MapeigOrgPlantilla_text_key" ON "MapeigOrgPlantilla"("text");

-- CreateIndex
CREATE INDEX "MapeigOrgPlantilla_centreId_idx" ON "MapeigOrgPlantilla"("centreId");

-- CreateIndex
CREATE INDEX "MapeigOrgPlantilla_departamentId_idx" ON "MapeigOrgPlantilla"("departamentId");

-- AddForeignKey
ALTER TABLE "MapeigOrgPlantilla" ADD CONSTRAINT "MapeigOrgPlantilla_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapeigOrgPlantilla" ADD CONSTRAINT "MapeigOrgPlantilla_departamentId_fkey" FOREIGN KEY ("departamentId") REFERENCES "Departament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

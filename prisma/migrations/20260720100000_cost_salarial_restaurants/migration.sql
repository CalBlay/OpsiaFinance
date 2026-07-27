-- CreateEnum
CREATE TYPE "DepartamentSalarial" AS ENUM ('SALA', 'CUINA');

-- CreateTable
CREATE TABLE "CostSalarialRestaurant" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "departament" "DepartamentSalarial" NOT NULL,
    "totalSalari" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "incentiusMensual" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "incentiuTrimestral" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "horesExtres" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "altres" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baixes" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "indemnitzacions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "foraCentre" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostSalarialRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostSalarialRestaurant_periodId_idx" ON "CostSalarialRestaurant"("periodId");

-- CreateIndex
CREATE INDEX "CostSalarialRestaurant_centreId_idx" ON "CostSalarialRestaurant"("centreId");

-- CreateIndex
CREATE UNIQUE INDEX "CostSalarialRestaurant_periodId_centreId_departament_key" ON "CostSalarialRestaurant"("periodId", "centreId", "departament");

-- AddForeignKey
ALTER TABLE "CostSalarialRestaurant" ADD CONSTRAINT "CostSalarialRestaurant_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostSalarialRestaurant" ADD CONSTRAINT "CostSalarialRestaurant_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "PressupostPeriodicitatDept" AS ENUM ('MENSUAL', 'TRIMESTRAL', 'ANUAL', 'PUNTUAL', 'PERSONALITZAT');

-- CreateTable
CREATE TABLE "PressupostLiniaDept" (
    "id" TEXT NOT NULL,
    "pressupostId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcio" TEXT NOT NULL,
    "premissa" TEXT,
    "periodicitat" "PressupostPeriodicitatDept" NOT NULL DEFAULT 'MENSUAL',
    "importUnitari" DECIMAL(18,2) NOT NULL,
    "mesos" JSONB NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressupostLiniaDept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PressupostLiniaDept_pressupostId_idx" ON "PressupostLiniaDept"("pressupostId");

-- AddForeignKey
ALTER TABLE "PressupostLiniaDept" ADD CONSTRAINT "PressupostLiniaDept_pressupostId_fkey" FOREIGN KEY ("pressupostId") REFERENCES "PressupostDept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

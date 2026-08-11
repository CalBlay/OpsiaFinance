-- CreateEnum
CREATE TYPE "ModeRepartimentPersonalLn" AS ENUM ('PERCENT_DEPT', 'FIX_TOTAL');

-- CreateTable
CREATE TABLE "ConfigPersonalLn" (
    "id" TEXT NOT NULL,
    "liniaNegociId" TEXT NOT NULL,
    "mode" "ModeRepartimentPersonalLn" NOT NULL DEFAULT 'PERCENT_DEPT',
    "importFixTotal" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigPersonalLn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigPersonalDept" (
    "id" TEXT NOT NULL,
    "liniaNegociId" TEXT NOT NULL,
    "departamentId" TEXT NOT NULL,
    "actiu" BOOLEAN NOT NULL DEFAULT true,
    "percentDept" DECIMAL(9,4),
    "pesInternFix" DECIMAL(9,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigPersonalDept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesDefectePersonalComercial" (
    "id" TEXT NOT NULL,
    "liniaNegociId" TEXT NOT NULL,
    "pesDefecte" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "PesDefectePersonalComercial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigPersonalLn_liniaNegociId_key" ON "ConfigPersonalLn"("liniaNegociId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigPersonalDept_liniaNegociId_departamentId_key" ON "ConfigPersonalDept"("liniaNegociId", "departamentId");

-- CreateIndex
CREATE INDEX "ConfigPersonalDept_departamentId_idx" ON "ConfigPersonalDept"("departamentId");

-- CreateIndex
CREATE UNIQUE INDEX "PesDefectePersonalComercial_liniaNegociId_key" ON "PesDefectePersonalComercial"("liniaNegociId");

-- AddForeignKey
ALTER TABLE "ConfigPersonalLn" ADD CONSTRAINT "ConfigPersonalLn_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigPersonalDept" ADD CONSTRAINT "ConfigPersonalDept_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigPersonalDept" ADD CONSTRAINT "ConfigPersonalDept_departamentId_fkey" FOREIGN KEY ("departamentId") REFERENCES "Departament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesDefectePersonalComercial" ADD CONSTRAINT "PesDefectePersonalComercial_liniaNegociId_fkey" FOREIGN KEY ("liniaNegociId") REFERENCES "LiniaNegoci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

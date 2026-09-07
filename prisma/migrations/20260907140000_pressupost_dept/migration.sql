-- CreateTable
CREATE TABLE "PressupostDept" (
    "id" TEXT NOT NULL,
    "any" INTEGER NOT NULL,
    "departamentId" TEXT NOT NULL,
    "estat" "PressupostEstat" NOT NULL DEFAULT 'ESBORRANY',
    "notes" TEXT,
    "creatPer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressupostDept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressupostCelDept" (
    "id" TEXT NOT NULL,
    "pressupostId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "partida" TEXT NOT NULL,
    "import" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressupostCelDept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PressupostDept_any_idx" ON "PressupostDept"("any");

-- CreateIndex
CREATE INDEX "PressupostDept_departamentId_idx" ON "PressupostDept"("departamentId");

-- CreateIndex
CREATE UNIQUE INDEX "PressupostDept_any_departamentId_key" ON "PressupostDept"("any", "departamentId");

-- CreateIndex
CREATE INDEX "PressupostCelDept_pressupostId_idx" ON "PressupostCelDept"("pressupostId");

-- CreateIndex
CREATE UNIQUE INDEX "PressupostCelDept_pressupostId_mes_partida_key" ON "PressupostCelDept"("pressupostId", "mes", "partida");

-- AddForeignKey
ALTER TABLE "PressupostDept" ADD CONSTRAINT "PressupostDept_departamentId_fkey" FOREIGN KEY ("departamentId") REFERENCES "Departament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressupostDept" ADD CONSTRAINT "PressupostDept_creatPer_fkey" FOREIGN KEY ("creatPer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressupostCelDept" ADD CONSTRAINT "PressupostCelDept_pressupostId_fkey" FOREIGN KEY ("pressupostId") REFERENCES "PressupostDept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

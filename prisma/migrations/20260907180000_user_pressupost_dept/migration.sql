-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PRESSUPOST_DEPT';

-- CreateTable
CREATE TABLE "UserDepartament" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departamentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDepartament_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDepartament_departamentId_idx" ON "UserDepartament"("departamentId");

-- CreateIndex
CREATE INDEX "UserDepartament_userId_idx" ON "UserDepartament"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDepartament_userId_departamentId_key" ON "UserDepartament"("userId", "departamentId");

-- AddForeignKey
ALTER TABLE "UserDepartament" ADD CONSTRAINT "UserDepartament_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartament" ADD CONSTRAINT "UserDepartament_departamentId_fkey" FOREIGN KEY ("departamentId") REFERENCES "Departament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

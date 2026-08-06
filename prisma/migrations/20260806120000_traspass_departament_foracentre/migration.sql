-- AlterTable ExecucioTraspassPersonal
ALTER TABLE "ExecucioTraspassPersonal" ADD COLUMN IF NOT EXISTS "foraCentreSnapshotJson" TEXT;

-- AlterTable MovimentTraspassPersonal
ALTER TABLE "MovimentTraspassPersonal" ADD COLUMN IF NOT EXISTS "departament" "DepartamentSalarial" NOT NULL DEFAULT 'SALA';
CREATE INDEX IF NOT EXISTS "MovimentTraspassPersonal_departament_idx" ON "MovimentTraspassPersonal"("departament");

-- AlterTable MapeigTextCentreTreball (font de veritat del departament)
ALTER TABLE "MapeigTextCentreTreball" ADD COLUMN IF NOT EXISTS "departament" "DepartamentSalarial" NOT NULL DEFAULT 'SALA';
CREATE INDEX IF NOT EXISTS "MapeigTextCentreTreball_departament_idx" ON "MapeigTextCentreTreball"("departament");

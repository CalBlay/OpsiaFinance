-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'RESTAURACIO';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "navExtra" JSONB;

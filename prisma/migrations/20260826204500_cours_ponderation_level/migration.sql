-- AlterTable
ALTER TABLE "CoursOptionPonderation" ADD COLUMN "level" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX IF EXISTS "CoursOptionPonderation_branchId_coursId_optionId_key";

-- CreateIndex
CREATE UNIQUE INDEX "CoursOptionPonderation_branchId_coursId_optionId_level_key" ON "CoursOptionPonderation"("branchId", "coursId", "optionId", "level");

-- CreateIndex
CREATE INDEX "CoursOptionPonderation_branchId_optionId_level_idx" ON "CoursOptionPonderation"("branchId", "optionId", "level");

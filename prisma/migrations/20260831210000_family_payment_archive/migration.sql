-- AlterTable
ALTER TABLE "FamilyPayment" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FamilyPayment" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "FamilyPayment" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FamilyPayment_branchId_isArchived_createdAt_idx" ON "FamilyPayment"("branchId", "isArchived", "createdAt");

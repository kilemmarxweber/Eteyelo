-- AlterTable
ALTER TABLE "BranchMember" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BranchMember" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BranchMember_branchId_isActive_idx" ON "BranchMember"("branchId", "isActive");

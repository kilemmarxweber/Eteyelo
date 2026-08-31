-- AlterTable
ALTER TABLE "CashierExpense" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CashierExpense" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "CashierExpense" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashierExpense_branchId_isArchived_createdAt_idx" ON "CashierExpense"("branchId", "isArchived", "createdAt");

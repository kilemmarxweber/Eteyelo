-- AlterTable
ALTER TABLE "FamilyPayment" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "CashierExpense" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FamilyPayment_branchId_createdByUserId_createdAt_idx" ON "FamilyPayment"("branchId", "createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashierExpense_branchId_createdByUserId_createdAt_idx" ON "CashierExpense"("branchId", "createdByUserId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FamilyPayment_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "FamilyPayment"
      ADD CONSTRAINT "FamilyPayment_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CashierExpense_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "CashierExpense"
      ADD CONSTRAINT "CashierExpense_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

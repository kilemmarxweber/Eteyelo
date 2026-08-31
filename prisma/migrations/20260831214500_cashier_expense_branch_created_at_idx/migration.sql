-- CreateIndex: filtre journalier / période sur les dépenses
CREATE INDEX IF NOT EXISTS "CashierExpense_branchId_createdAt_idx" ON "CashierExpense"("branchId", "createdAt");

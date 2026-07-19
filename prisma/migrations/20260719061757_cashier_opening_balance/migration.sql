-- CreateTable
CREATE TABLE "CashierOpeningBalance" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "CashierOpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashierOpeningBalance_branchId_date_idx" ON "CashierOpeningBalance"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CashierOpeningBalance_branchId_date_key" ON "CashierOpeningBalance"("branchId", "date");

-- AddForeignKey
ALTER TABLE "CashierOpeningBalance" ADD CONSTRAINT "CashierOpeningBalance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

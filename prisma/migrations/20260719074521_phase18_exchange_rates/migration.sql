-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('USD', 'CDF', 'AOA');

-- AlterTable
ALTER TABLE "FamilyPayment" ADD COLUMN     "exchangeRateUsed" DOUBLE PRECISION,
ADD COLUMN     "receivedAmount" DOUBLE PRECISION,
ADD COLUMN     "receivedCurrency" "CurrencyCode" NOT NULL DEFAULT 'USD';

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" "CurrencyCode" NOT NULL,
    "toCurrency" "CurrencyCode" NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_organizationId_isActive_idx" ON "ExchangeRate"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_organizationId_fromCurrency_toCurrency_key" ON "ExchangeRate"("organizationId", "fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "FamilyPayment_branchId_receivedCurrency_idx" ON "FamilyPayment"("branchId", "receivedCurrency");

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

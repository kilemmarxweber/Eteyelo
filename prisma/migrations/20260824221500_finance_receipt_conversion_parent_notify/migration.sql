-- AlterEnum
ALTER TYPE "AppNotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "showReceiptConversion" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "notifyParentOnPayment" BOOLEAN NOT NULL DEFAULT true;

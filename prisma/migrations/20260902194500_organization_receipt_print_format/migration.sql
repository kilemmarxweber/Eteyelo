CREATE TYPE "ReceiptPrintFormat" AS ENUM ('A4', 'POS_80MM');

ALTER TABLE "organization"
ADD COLUMN IF NOT EXISTS "receiptPrintFormat" "ReceiptPrintFormat" NOT NULL DEFAULT 'A4';

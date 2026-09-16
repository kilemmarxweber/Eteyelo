-- Dual WhatsApp provider (zindua | klambo) + base URL Klambo par organisation.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "whatsappProvider" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "whatsappBaseUrl" TEXT;

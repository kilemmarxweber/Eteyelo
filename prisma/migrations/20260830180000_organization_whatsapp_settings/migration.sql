-- WhatsApp (Zindua) : interrupteur + template + URL site, par organisation.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "whatsappTemplate" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "whatsappSiteUrl" TEXT;

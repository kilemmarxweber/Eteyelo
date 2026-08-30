-- Clé API WhatsApp (Zindua) saisissable depuis Paramètres.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "whatsappApiKey" TEXT;

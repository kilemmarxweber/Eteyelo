-- Maître e-mail + matrice Mail/WhatsApp par flux, par organisation.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "notificationChannels" JSONB;

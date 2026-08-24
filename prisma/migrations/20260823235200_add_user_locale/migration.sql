-- Prefer locale per authenticated user (fr | en | pt).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locale" TEXT DEFAULT 'fr';

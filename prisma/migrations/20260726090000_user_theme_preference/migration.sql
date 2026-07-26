-- Prefer theme per authenticated user (does not affect other accounts).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "theme" TEXT DEFAULT 'light';

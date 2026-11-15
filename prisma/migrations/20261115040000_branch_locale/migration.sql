-- Langue UI par branche (Apparence). Null = défaut CONGOLAIS→fr / ANGOLAIS→pt / ANGLAIS→en.
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "locale" TEXT;

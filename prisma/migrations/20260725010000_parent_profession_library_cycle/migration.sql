-- Additive / non-destructive: keeps all existing rows.

-- Parent.profession (optional job / workplace from registration)
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "profession" TEXT;

-- LibraryCycle: extend for centre de formation / université
ALTER TYPE "LibraryCycle" ADD VALUE IF NOT EXISTS 'FORMATION';
ALTER TYPE "LibraryCycle" ADD VALUE IF NOT EXISTS 'UNIVERSITE';

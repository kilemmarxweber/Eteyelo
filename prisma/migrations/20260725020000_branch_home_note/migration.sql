-- Additive: optional homepage spotlight text for branches (no data loss).
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "note" TEXT;

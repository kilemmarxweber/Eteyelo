ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "archivedEmail" TEXT;

CREATE INDEX IF NOT EXISTS "user_archivedEmail_idx" ON "user"("archivedEmail");

-- Soft-deactivate scoped to Teacher / Personnel profiles (dual-role safe).
ALTER TABLE "Personnel" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Personnel" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Personnel_isActive_idx" ON "Personnel"("isActive");
CREATE INDEX IF NOT EXISTS "Teacher_isActive_idx" ON "Teacher"("isActive");

-- Postes d'horaire (composantes) sous un cours bulletin.
CREATE TYPE "CoursKind" AS ENUM ('SUBJECT', 'SCHEDULE_COMPONENT');

ALTER TABLE "Cours" ADD COLUMN IF NOT EXISTS "kind" "CoursKind" NOT NULL DEFAULT 'SUBJECT';
ALTER TABLE "Cours" ADD COLUMN IF NOT EXISTS "parentCoursId" TEXT;
ALTER TABLE "Cours" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Cours_parentCoursId_fkey'
  ) THEN
    ALTER TABLE "Cours"
      ADD CONSTRAINT "Cours_parentCoursId_fkey"
      FOREIGN KEY ("parentCoursId") REFERENCES "Cours"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Cours_parentCoursId_idx" ON "Cours"("parentCoursId");
CREATE INDEX IF NOT EXISTS "Cours_branchId_kind_idx" ON "Cours"("branchId", "kind");

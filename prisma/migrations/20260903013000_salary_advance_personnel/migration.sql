-- Agents personnels : avance optionnelle enseignant ou personnel.

ALTER TABLE "Personnel"
  ADD COLUMN IF NOT EXISTS "canRequestSalaryAdvance" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SalaryAdvance"
  ALTER COLUMN "teacherId" DROP NOT NULL;

ALTER TABLE "SalaryAdvance"
  ADD COLUMN IF NOT EXISTS "personnelId" TEXT;

CREATE INDEX IF NOT EXISTS "SalaryAdvance_personnelId_status_idx"
  ON "SalaryAdvance"("personnelId", "status");

CREATE INDEX IF NOT EXISTS "SalaryAdvance_branchId_personnelId_idx"
  ON "SalaryAdvance"("branchId", "personnelId");

ALTER TABLE "SalaryAdvance"
  DROP CONSTRAINT IF EXISTS "SalaryAdvance_personnelId_fkey";

ALTER TABLE "SalaryAdvance"
  ADD CONSTRAINT "SalaryAdvance_personnelId_fkey"
  FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

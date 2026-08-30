-- Cycle demandé sur candidature (filtre ACL multi-cycle, comme personnel).
ALTER TABLE "JobApplication" ADD COLUMN IF NOT EXISTS "desiredCycle" "Cycle";

CREATE INDEX IF NOT EXISTS "JobApplication_branchId_desiredCycle_idx"
  ON "JobApplication"("branchId", "desiredCycle");

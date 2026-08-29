-- AlterTable Teaching: heures / semaine
ALTER TABLE "Teaching" ADD COLUMN IF NOT EXISTS "weeklyHours" DOUBLE PRECISION;

-- AlterTable Schedule: source MANUAL | AUTO
DO $$ BEGIN
  CREATE TYPE "ScheduleSource" AS ENUM ('MANUAL', 'AUTO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "source" "ScheduleSource" NOT NULL DEFAULT 'MANUAL';

CREATE INDEX IF NOT EXISTS "Schedule_source_idx" ON "Schedule"("source");

-- CreateTable BranchMemberCycle
CREATE TABLE IF NOT EXISTS "BranchMemberCycle" (
    "id" TEXT NOT NULL,
    "branchMemberId" TEXT NOT NULL,
    "cycle" "Cycle" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BranchMemberCycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BranchMemberCycle_branchMemberId_cycle_key"
  ON "BranchMemberCycle"("branchMemberId", "cycle");

CREATE INDEX IF NOT EXISTS "BranchMemberCycle_branchMemberId_idx"
  ON "BranchMemberCycle"("branchMemberId");

CREATE INDEX IF NOT EXISTS "BranchMemberCycle_cycle_idx"
  ON "BranchMemberCycle"("cycle");

DO $$ BEGIN
  ALTER TABLE "BranchMemberCycle"
    ADD CONSTRAINT "BranchMemberCycle_branchMemberId_fkey"
    FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Franchise de retard paie : 5 minutes autorisées (signalées), au-delà retenues.

ALTER TABLE "BranchPayrollPolicy"
  ALTER COLUMN "lateGraceMinutes" SET DEFAULT 5;

UPDATE "BranchPayrollPolicy"
SET "lateGraceMinutes" = 5
WHERE "lateGraceMinutes" = 10;

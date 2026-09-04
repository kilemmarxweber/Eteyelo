-- Forfait maternelle 100 000 + barème personnel (brut / prime par rôle).

ALTER TABLE "BranchPayrollPolicy"
  ADD COLUMN "maternelleSessionMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "maternelleMatriculeMonthly" DOUBLE PRECISION NOT NULL DEFAULT 100000,
  ADD COLUMN "maternelleNonMatriculeMonthly" DOUBLE PRECISION NOT NULL DEFAULT 100000,
  ADD COLUMN "personnelDayMinutes" INTEGER NOT NULL DEFAULT 480,
  ADD COLUMN "personnelScales" JSONB;

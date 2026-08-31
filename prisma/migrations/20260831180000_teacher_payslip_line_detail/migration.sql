-- Snapshot détaillé des séances sur chaque ligne de bulletin de paie.
ALTER TABLE "TeacherPayslipLine" ADD COLUMN IF NOT EXISTS "detail" JSONB;

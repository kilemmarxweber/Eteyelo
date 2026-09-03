-- Paie unifiée : forfait personnel + un bulletin par agent (BranchMember).

CREATE TYPE "PayrollAgentKind" AS ENUM ('TEACHER', 'PERSONNEL', 'BOTH');

ALTER TABLE "Personnel"
  ADD COLUMN "monthlyForfait" DOUBLE PRECISION,
  ADD COLUMN "payrollStartedOn" TIMESTAMP(3);

ALTER TABLE "TeacherPayslip"
  ADD COLUMN "branchMemberId" TEXT,
  ADD COLUMN "personnelId" TEXT,
  ADD COLUMN "agentKind" "PayrollAgentKind" NOT NULL DEFAULT 'TEACHER';

UPDATE "TeacherPayslip" AS tp
SET "branchMemberId" = t."branchMemberId"
FROM "Teacher" AS t
WHERE t."id" = tp."teacherId"
  AND t."branchMemberId" IS NOT NULL;

DELETE FROM "TeacherPayslip" WHERE "branchMemberId" IS NULL;

ALTER TABLE "TeacherPayslip" ALTER COLUMN "branchMemberId" SET NOT NULL;
ALTER TABLE "TeacherPayslip" ALTER COLUMN "teacherId" DROP NOT NULL;

ALTER TABLE "TeacherPayslip" DROP CONSTRAINT "TeacherPayslip_teacherId_fkey";
ALTER TABLE "TeacherPayslip"
  ADD CONSTRAINT "TeacherPayslip_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeacherPayslip"
  ADD CONSTRAINT "TeacherPayslip_branchMemberId_fkey"
  FOREIGN KEY ("branchMemberId") REFERENCES "BranchMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherPayslip"
  ADD CONSTRAINT "TeacherPayslip_personnelId_fkey"
  FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "TeacherPayslip_branchId_teacherId_year_month_key";

CREATE UNIQUE INDEX "TeacherPayslip_branchId_branchMemberId_year_month_key"
  ON "TeacherPayslip"("branchId", "branchMemberId", "year", "month");
CREATE INDEX "TeacherPayslip_personnelId_year_month_idx"
  ON "TeacherPayslip"("personnelId", "year", "month");
CREATE INDEX "TeacherPayslip_branchMemberId_year_month_idx"
  ON "TeacherPayslip"("branchMemberId", "year", "month");

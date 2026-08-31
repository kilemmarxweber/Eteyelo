-- V1 paie enseignants : statut, politique par branche et bulletins mensuels figés.

ALTER TYPE "AppNotificationType" ADD VALUE IF NOT EXISTS 'PAYROLL_DEDUCTION';
ALTER TYPE "AppNotificationType" ADD VALUE IF NOT EXISTS 'PAYROLL';

CREATE TYPE "TeacherEmploymentKind" AS ENUM ('MATRICULE', 'NON_MATRICULE');
CREATE TYPE "TeacherPayslipStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PAID', 'CANCELLED');
CREATE TYPE "TeacherPayslipLineKind" AS ENUM ('GROSS', 'ABSENCE', 'LATE', 'EARLY_EXIT', 'ADJUSTMENT');

ALTER TABLE "Teacher"
  ADD COLUMN "employmentKind" "TeacherEmploymentKind" NOT NULL DEFAULT 'NON_MATRICULE',
  ADD COLUMN "matriculeEtat" TEXT,
  ADD COLUMN "payrollStartedOn" TIMESTAMP(3);

CREATE TABLE "BranchPayrollPolicy" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "secondarySessionMinutes" INTEGER NOT NULL DEFAULT 45,
  "primarySessionMinutes" INTEGER NOT NULL DEFAULT 30,
  "secondaryHourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 1500,
  "secondaryMatriculePrimePercent" DOUBLE PRECISION NOT NULL DEFAULT 30,
  "secondaryNonMatriculeSessionRate" DOUBLE PRECISION NOT NULL DEFAULT 1500,
  "primaryMatriculeMonthly" DOUBLE PRECISION NOT NULL DEFAULT 15000,
  "primaryNonMatriculeMonthly" DOUBLE PRECISION NOT NULL DEFAULT 70000,
  "lateGraceMinutes" INTEGER NOT NULL DEFAULT 10,
  "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BranchPayrollPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherPayslip" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "schoolYearId" TEXT,
  "policyId" TEXT,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" "TeacherPayslipStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" "CurrencyCode" NOT NULL,
  "quoteCurrency" "CurrencyCode",
  "exchangeRateId" TEXT,
  "rateSnapshot" DOUBLE PRECISION,
  "gross" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "net" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "policySnapshot" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "validatedById" TEXT,
  "paidById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherPayslip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeacherPayslipLine" (
  "id" TEXT NOT NULL,
  "payslipId" TEXT NOT NULL,
  "cycle" "Cycle",
  "kind" "TeacherPayslipLineKind" NOT NULL,
  "occurredOn" TIMESTAMP(3),
  "sessionId" TEXT,
  "label" TEXT NOT NULL,
  "sessions" INTEGER NOT NULL DEFAULT 0,
  "minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherPayslipLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchPayrollPolicy_branchId_key" ON "BranchPayrollPolicy"("branchId");
CREATE INDEX "TeacherPayslip_branchId_year_month_idx" ON "TeacherPayslip"("branchId", "year", "month");
CREATE INDEX "TeacherPayslip_branchId_status_idx" ON "TeacherPayslip"("branchId", "status");
CREATE INDEX "TeacherPayslip_teacherId_year_month_idx" ON "TeacherPayslip"("teacherId", "year", "month");
CREATE UNIQUE INDEX "TeacherPayslip_branchId_teacherId_year_month_key"
  ON "TeacherPayslip"("branchId", "teacherId", "year", "month");
CREATE INDEX "TeacherPayslipLine_payslipId_idx" ON "TeacherPayslipLine"("payslipId");
CREATE INDEX "TeacherPayslipLine_sessionId_idx" ON "TeacherPayslipLine"("sessionId");

ALTER TABLE "BranchPayrollPolicy"
  ADD CONSTRAINT "BranchPayrollPolicy_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherPayslip"
  ADD CONSTRAINT "TeacherPayslip_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TeacherPayslip_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TeacherPayslip_schoolYearId_fkey"
  FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TeacherPayslip_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "BranchPayrollPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TeacherPayslip_exchangeRateId_fkey"
  FOREIGN KEY ("exchangeRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeacherPayslipLine"
  ADD CONSTRAINT "TeacherPayslipLine_payslipId_fkey"
  FOREIGN KEY ("payslipId") REFERENCES "TeacherPayslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

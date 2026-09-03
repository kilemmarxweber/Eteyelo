-- CreateEnum
CREATE TYPE "SalaryAdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'SETTLED');

-- CreateEnum
CREATE TYPE "SalaryAdvanceInstallmentStatus" AS ENUM ('PLANNED', 'DEDUCTED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "TeacherPayslipLineKind" ADD VALUE 'ADVANCE';

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "canRequestSalaryAdvance" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "reason" TEXT,
    "status" "SalaryAdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "firstYear" INTEGER NOT NULL,
    "firstMonth" INTEGER NOT NULL,
    "expenseRef" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAdvanceInstallment" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "SalaryAdvanceInstallmentStatus" NOT NULL DEFAULT 'PLANNED',
    "payslipId" TEXT,
    "deductedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryAdvanceInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryAdvance_branchId_status_createdAt_idx" ON "SalaryAdvance"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SalaryAdvance_teacherId_status_idx" ON "SalaryAdvance"("teacherId", "status");

-- CreateIndex
CREATE INDEX "SalaryAdvance_branchId_teacherId_idx" ON "SalaryAdvance"("branchId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAdvanceInstallment_advanceId_sequence_key" ON "SalaryAdvanceInstallment"("advanceId", "sequence");

-- CreateIndex
CREATE INDEX "SalaryAdvanceInstallment_advanceId_year_month_idx" ON "SalaryAdvanceInstallment"("advanceId", "year", "month");

-- CreateIndex
CREATE INDEX "SalaryAdvanceInstallment_payslipId_idx" ON "SalaryAdvanceInstallment"("payslipId");

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvanceInstallment" ADD CONSTRAINT "SalaryAdvanceInstallment_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "SalaryAdvance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvanceInstallment" ADD CONSTRAINT "SalaryAdvanceInstallment_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "TeacherPayslip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

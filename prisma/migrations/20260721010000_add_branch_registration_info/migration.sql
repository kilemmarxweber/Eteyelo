-- CreateTable
CREATE TABLE "BranchRegistrationInfo" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "schoolYearId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "termsTitle" TEXT NOT NULL DEFAULT 'Conditions d''inscription',
    "termsContent" TEXT NOT NULL,
    "registrationFeeRequired" BOOLEAN NOT NULL DEFAULT true,
    "registrationFeeAmount" DECIMAL(12,2),
    "registrationFeeCurrency" TEXT NOT NULL DEFAULT 'CDF',
    "registrationFeeLabel" TEXT,
    "registrationFeeDueNote" TEXT,
    "registrationFeeTypeId" TEXT,
    "rentreeProgram" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchRegistrationInfo_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "RegistrationRequest" ADD COLUMN IF NOT EXISTS "termsInfoId" TEXT;

-- CreateIndex
CREATE INDEX "BranchRegistrationInfo_branchId_isPublished_idx" ON "BranchRegistrationInfo"("branchId", "isPublished");

-- CreateIndex
CREATE INDEX "BranchRegistrationInfo_schoolYearId_idx" ON "BranchRegistrationInfo"("schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchRegistrationInfo_branchId_schoolYearId_key" ON "BranchRegistrationInfo"("branchId", "schoolYearId");

-- AddForeignKey
ALTER TABLE "BranchRegistrationInfo" ADD CONSTRAINT "BranchRegistrationInfo_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchRegistrationInfo" ADD CONSTRAINT "BranchRegistrationInfo_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

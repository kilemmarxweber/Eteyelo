-- CreateEnum
CREATE TYPE "JobApplicationType" AS ENUM ('TEACHER', 'PERSONNEL');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED', 'HIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationType" "JobApplicationType" NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "nom" TEXT NOT NULL,
    "postnom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "sexe" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "photoUrl" TEXT,
    "desiredSubjects" TEXT,
    "desiredLevels" TEXT,
    "yearsOfExperience" INTEGER,
    "desiredOrgRole" TEXT,
    "experienceSummary" TEXT,
    "educationSummary" TEXT,
    "skills" TEXT,
    "availability" TEXT,
    "motivation" TEXT,
    "cvUrl" TEXT NOT NULL,
    "coverLetterUrl" TEXT NOT NULL,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "hiredById" TEXT,
    "hiredAt" TIMESTAMP(3),
    "teacherId" TEXT,
    "personnelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_reference_key" ON "JobApplication"("reference");

-- CreateIndex
CREATE INDEX "JobApplication_branchId_status_createdAt_idx" ON "JobApplication"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "JobApplication_organizationId_branchId_idx" ON "JobApplication"("organizationId", "branchId");

-- CreateIndex
CREATE INDEX "JobApplication_email_idx" ON "JobApplication"("email");

-- CreateIndex
CREATE INDEX "JobApplication_applicationType_idx" ON "JobApplication"("applicationType");

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "StudentLinkType" AS ENUM ('IMPORTED', 'NATIVE');

-- CreateEnum
CREATE TYPE "IssuedDocumentType" AS ENUM ('BULLETIN', 'BREVET', 'RELEVE_NOTES', 'ATTESTATION', 'ATTESTATION_PARTICIPATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeBrache" ADD VALUE 'ATELIER';
ALTER TYPE "TypeBrache" ADD VALUE 'CENTRE_FORMATION';
ALTER TYPE "TypeBrache" ADD VALUE 'UNIVERSITE';

-- CreateTable
CREATE TABLE "StudentBranchLink" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetBranchId" TEXT NOT NULL,
    "sourceBranchId" TEXT NOT NULL,
    "linkType" "StudentLinkType" NOT NULL DEFAULT 'IMPORTED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentBranchLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssuedDocument" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolYearId" TEXT,
    "documentType" "IssuedDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "metadata" JSONB,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssuedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentBranchLink_targetBranchId_idx" ON "StudentBranchLink"("targetBranchId");

-- CreateIndex
CREATE INDEX "StudentBranchLink_sourceBranchId_idx" ON "StudentBranchLink"("sourceBranchId");

-- CreateIndex
CREATE INDEX "StudentBranchLink_studentId_idx" ON "StudentBranchLink"("studentId");

-- CreateIndex
CREATE INDEX "StudentBranchLink_targetBranchId_isActive_idx" ON "StudentBranchLink"("targetBranchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBranchLink_studentId_targetBranchId_key" ON "StudentBranchLink"("studentId", "targetBranchId");

-- CreateIndex
CREATE INDEX "IssuedDocument_branchId_documentType_idx" ON "IssuedDocument"("branchId", "documentType");

-- CreateIndex
CREATE INDEX "IssuedDocument_studentId_idx" ON "IssuedDocument"("studentId");

-- CreateIndex
CREATE INDEX "IssuedDocument_branchId_studentId_idx" ON "IssuedDocument"("branchId", "studentId");

-- CreateIndex
CREATE INDEX "IssuedDocument_schoolYearId_idx" ON "IssuedDocument"("schoolYearId");

-- AddForeignKey
ALTER TABLE "StudentBranchLink" ADD CONSTRAINT "StudentBranchLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBranchLink" ADD CONSTRAINT "StudentBranchLink_targetBranchId_fkey" FOREIGN KEY ("targetBranchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBranchLink" ADD CONSTRAINT "StudentBranchLink_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

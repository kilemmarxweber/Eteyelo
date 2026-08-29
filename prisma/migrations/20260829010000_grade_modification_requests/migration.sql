-- Demande de modification de notes + notifications direction

ALTER TYPE "AppNotificationType" ADD VALUE IF NOT EXISTS 'GRADE_MODIFICATION_SUBMITTED';
ALTER TYPE "AppNotificationType" ADD VALUE IF NOT EXISTS 'GRADE_MODIFICATION_DECISION';

DO $$ BEGIN
  CREATE TYPE "GradeModificationStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GradeModificationRequest" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "GradeModificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "justification" TEXT NOT NULL,
    "evidenceUrl" TEXT NOT NULL,
    "previousNotes" TEXT NOT NULL,
    "proposedNotes" TEXT NOT NULL,
    "contextLabel" TEXT NOT NULL,
    "reviewComment" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeModificationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GradeModificationRequest_branchId_status_idx" ON "GradeModificationRequest"("branchId", "status");
CREATE INDEX IF NOT EXISTS "GradeModificationRequest_ficheId_status_idx" ON "GradeModificationRequest"("ficheId", "status");
CREATE INDEX IF NOT EXISTS "GradeModificationRequest_requestedById_status_idx" ON "GradeModificationRequest"("requestedById", "status");
CREATE INDEX IF NOT EXISTS "GradeModificationRequest_organizationId_status_idx" ON "GradeModificationRequest"("organizationId", "status");

DO $$ BEGIN
  ALTER TABLE "GradeModificationRequest" ADD CONSTRAINT "GradeModificationRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GradeModificationRequest" ADD CONSTRAINT "GradeModificationRequest_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "fiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GradeModificationRequest" ADD CONSTRAINT "GradeModificationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GradeModificationRequest" ADD CONSTRAINT "GradeModificationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AppNotification" ADD COLUMN IF NOT EXISTS "gradeModificationRequestId" TEXT;

CREATE INDEX IF NOT EXISTS "AppNotification_gradeModificationRequestId_idx" ON "AppNotification"("gradeModificationRequestId");

DO $$ BEGIN
  ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_gradeModificationRequestId_fkey" FOREIGN KEY ("gradeModificationRequestId") REFERENCES "GradeModificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

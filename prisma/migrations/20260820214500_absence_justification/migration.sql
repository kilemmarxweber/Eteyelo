-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AttendanceSubjectType" AS ENUM ('STUDENT', 'TEACHER', 'PERSONNEL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AbsenceCaseStatus" AS ENUM ('OPEN', 'PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'CLEARED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AppNotificationType" AS ENUM ('ABSENCE', 'JUSTIFICATION_SUBMITTED', 'JUSTIFICATION_DECISION', 'RETURN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AbsenceCase" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectType" "AttendanceSubjectType" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "personnelId" TEXT,
    "sessionId" TEXT,
    "studentAttendanceId" TEXT,
    "teacherAttendanceId" TEXT,
    "personnelAttendanceId" TEXT,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "contextLabel" TEXT NOT NULL,
    "status" "AbsenceCaseStatus" NOT NULL DEFAULT 'OPEN',
    "justification" TEXT,
    "justifiedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "absenceNotifiedAt" TIMESTAMP(3),
    "returnNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AppNotification" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AppNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "absenceCaseId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AbsenceCase_studentAttendanceId_key" ON "AbsenceCase"("studentAttendanceId");
CREATE UNIQUE INDEX IF NOT EXISTS "AbsenceCase_teacherAttendanceId_key" ON "AbsenceCase"("teacherAttendanceId");
CREATE UNIQUE INDEX IF NOT EXISTS "AbsenceCase_personnelAttendanceId_key" ON "AbsenceCase"("personnelAttendanceId");
CREATE UNIQUE INDEX IF NOT EXISTS "AbsenceCase_branchId_sourceKey_key" ON "AbsenceCase"("branchId", "sourceKey");
CREATE INDEX IF NOT EXISTS "AbsenceCase_branchId_status_idx" ON "AbsenceCase"("branchId", "status");
CREATE INDEX IF NOT EXISTS "AbsenceCase_userId_status_idx" ON "AbsenceCase"("userId", "status");
CREATE INDEX IF NOT EXISTS "AbsenceCase_organizationId_status_idx" ON "AbsenceCase"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "AbsenceCase_occurredOn_idx" ON "AbsenceCase"("occurredOn");

CREATE INDEX IF NOT EXISTS "AppNotification_userId_readAt_idx" ON "AppNotification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "AppNotification_branchId_userId_createdAt_idx" ON "AppNotification"("branchId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AppNotification_absenceCaseId_idx" ON "AppNotification"("absenceCaseId");

DO $$ BEGIN
  ALTER TABLE "AbsenceCase" ADD CONSTRAINT "AbsenceCase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AbsenceCase" ADD CONSTRAINT "AbsenceCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AbsenceCase" ADD CONSTRAINT "AbsenceCase_studentAttendanceId_fkey" FOREIGN KEY ("studentAttendanceId") REFERENCES "StudentAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AbsenceCase" ADD CONSTRAINT "AbsenceCase_teacherAttendanceId_fkey" FOREIGN KEY ("teacherAttendanceId") REFERENCES "TeacherAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AbsenceCase" ADD CONSTRAINT "AbsenceCase_personnelAttendanceId_fkey" FOREIGN KEY ("personnelAttendanceId") REFERENCES "PersonnelAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AbsenceCase" ADD CONSTRAINT "AbsenceCase_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_absenceCaseId_fkey" FOREIGN KEY ("absenceCaseId") REFERENCES "AbsenceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

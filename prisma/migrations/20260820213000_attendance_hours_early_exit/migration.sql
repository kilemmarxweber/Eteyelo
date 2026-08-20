-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AttendanceExitReason" AS ENUM ('MALADIE', 'URGENCE', 'AUTORISE', 'AUTRE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- StudentAttendance
ALTER TABLE "StudentAttendance" ADD COLUMN IF NOT EXISTS "checkIn" TIMESTAMP(3);
ALTER TABLE "StudentAttendance" ADD COLUMN IF NOT EXISTS "checkOut" TIMESTAMP(3);
ALTER TABLE "StudentAttendance" ADD COLUMN IF NOT EXISTS "earlyExit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentAttendance" ADD COLUMN IF NOT EXISTS "exitReason" TEXT;
ALTER TABLE "StudentAttendance" ADD COLUMN IF NOT EXISTS "exitReasonCode" "AttendanceExitReason";

-- TeacherAttendance
ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkIn" TIMESTAMP(3);
ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "checkOut" TIMESTAMP(3);
ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "earlyExit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "exitReason" TEXT;
ALTER TABLE "TeacherAttendance" ADD COLUMN IF NOT EXISTS "exitReasonCode" "AttendanceExitReason";

-- PersonnelAttendance
ALTER TABLE "PersonnelAttendance" ADD COLUMN IF NOT EXISTS "earlyExit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PersonnelAttendance" ADD COLUMN IF NOT EXISTS "exitReason" TEXT;
ALTER TABLE "PersonnelAttendance" ADD COLUMN IF NOT EXISTS "exitReasonCode" "AttendanceExitReason";

CREATE INDEX IF NOT EXISTS "StudentAttendance_branchId_earlyExit_idx" ON "StudentAttendance"("branchId", "earlyExit");
CREATE INDEX IF NOT EXISTS "TeacherAttendance_branchId_earlyExit_idx" ON "TeacherAttendance"("branchId", "earlyExit");
CREATE INDEX IF NOT EXISTS "PersonnelAttendance_branchId_earlyExit_idx" ON "PersonnelAttendance"("branchId", "earlyExit");

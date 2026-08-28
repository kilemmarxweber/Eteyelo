-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "closesAttendance" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CalendarEvent_branchId_closesAttendance_dateStart_idx" ON "CalendarEvent"("branchId", "closesAttendance", "dateStart");

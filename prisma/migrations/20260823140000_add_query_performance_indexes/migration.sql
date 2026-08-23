-- CreateIndex
CREATE INDEX "AttendanceSession_branchId_date_idx" ON "AttendanceSession"("branchId", "date");

-- CreateIndex
CREATE INDEX "StudentAttendance_branchId_recordedAt_idx" ON "StudentAttendance"("branchId", "recordedAt");

-- CreateIndex
CREATE INDEX "FamilyPayment_branchId_status_classEnrollmentId_fraisId_idx" ON "FamilyPayment"("branchId", "status", "classEnrollmentId", "fraisId");

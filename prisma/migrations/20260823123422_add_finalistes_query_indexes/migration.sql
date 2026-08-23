-- CreateIndex
CREATE INDEX "ClassEnrollment_branchId_schoolYearId_statusEnrollment_idx" ON "ClassEnrollment"("branchId", "schoolYearId", "statusEnrollment");

-- CreateIndex
CREATE INDEX "ClassEnrollment_branchId_schoolYearId_statusEnrollment_clas_idx" ON "ClassEnrollment"("branchId", "schoolYearId", "statusEnrollment", "classeId");

-- CreateIndex
CREATE INDEX "Classe_branchId_level_idx" ON "Classe"("branchId", "level");

-- CreateTable
CREATE TABLE "AtelierCourseLink" (
    "id" TEXT NOT NULL,
    "atelierCoursId" TEXT NOT NULL,
    "secondaryCoursId" TEXT NOT NULL,
    "secondaryBranchId" TEXT NOT NULL,
    "targetPeriodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtelierCourseLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AtelierCourseLink_atelierCoursId_key" ON "AtelierCourseLink"("atelierCoursId");

-- CreateIndex
CREATE INDEX "AtelierCourseLink_secondaryCoursId_idx" ON "AtelierCourseLink"("secondaryCoursId");

-- CreateIndex
CREATE INDEX "AtelierCourseLink_secondaryBranchId_idx" ON "AtelierCourseLink"("secondaryBranchId");

-- CreateIndex
CREATE INDEX "AtelierCourseLink_secondaryCoursId_targetPeriodKey_idx" ON "AtelierCourseLink"("secondaryCoursId", "targetPeriodKey");

-- AddForeignKey
ALTER TABLE "AtelierCourseLink" ADD CONSTRAINT "AtelierCourseLink_atelierCoursId_fkey" FOREIGN KEY ("atelierCoursId") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtelierCourseLink" ADD CONSTRAINT "AtelierCourseLink_secondaryCoursId_fkey" FOREIGN KEY ("secondaryCoursId") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtelierCourseLink" ADD CONSTRAINT "AtelierCourseLink_secondaryBranchId_fkey" FOREIGN KEY ("secondaryBranchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

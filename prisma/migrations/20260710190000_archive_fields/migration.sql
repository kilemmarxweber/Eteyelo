-- AlterTable
ALTER TABLE "Creneau" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Creneau" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Creneau" ADD COLUMN "archivedById" TEXT;

-- AlterTable
ALTER TABLE "SchoolYear" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SchoolYear" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "SchoolYear" ADD COLUMN "archivedById" TEXT;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Schedule" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Schedule" ADD COLUMN "archivedById" TEXT;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CalendarEvent" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "CalendarEvent" ADD COLUMN "archivedById" TEXT;

-- CreateIndex
CREATE INDEX "Creneau_branchId_isArchived_idx" ON "Creneau"("branchId", "isArchived");

-- CreateIndex
CREATE INDEX "SchoolYear_branchId_isArchived_idx" ON "SchoolYear"("branchId", "isArchived");

-- CreateIndex
CREATE INDEX "Schedule_isArchived_idx" ON "Schedule"("isArchived");

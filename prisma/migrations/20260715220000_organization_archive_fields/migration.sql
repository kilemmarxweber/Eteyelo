-- AlterTable
ALTER TABLE "organization" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "organization" ADD COLUMN "archivedById" TEXT;

-- CreateIndex
CREATE INDEX "organization_isArchived_idx" ON "organization"("isArchived");

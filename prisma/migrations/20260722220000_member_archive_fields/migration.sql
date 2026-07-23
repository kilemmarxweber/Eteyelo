-- AlterTable
ALTER TABLE "member" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "member" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "member" ADD COLUMN "archivedById" TEXT;

-- CreateIndex
CREATE INDEX "member_organizationId_isArchived_idx" ON "member"("organizationId", "isArchived");

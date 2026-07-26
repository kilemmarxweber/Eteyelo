-- CreateEnum
CREATE TYPE "SupportTicketChannel" AS ENUM ('ESTABLISHMENT', 'PLATFORM');

-- AlterTable
ALTER TABLE "platformSupportEscalation" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "channel" "SupportTicketChannel" NOT NULL DEFAULT 'PLATFORM';

-- CreateIndex
CREATE INDEX "platformSupportEscalation_channel_idx" ON "platformSupportEscalation"("channel");

-- CreateIndex
CREATE INDEX "platformSupportEscalation_branchId_idx" ON "platformSupportEscalation"("branchId");

-- AddForeignKey
ALTER TABLE "platformSupportEscalation" ADD CONSTRAINT "platformSupportEscalation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

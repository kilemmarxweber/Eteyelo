-- AlterTable
ALTER TABLE "user" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "user_mustChangePassword_idx" ON "user"("mustChangePassword");

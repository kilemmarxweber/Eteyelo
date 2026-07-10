/*
  Warnings:

  - You are about to drop the column `ponderation` on the `Cours` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[branchId,codeCours]` on the table `Cours` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branchId,nameCours]` on the table `Cours` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Cours_codeCours_key";

-- AlterTable
ALTER TABLE "Cours" DROP COLUMN "ponderation";

-- CreateTable
CREATE TABLE "CoursOptionPonderation" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "ponderation" INTEGER NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursOptionPonderation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoursOptionPonderation_branchId_idx" ON "CoursOptionPonderation"("branchId");

-- CreateIndex
CREATE INDEX "CoursOptionPonderation_coursId_idx" ON "CoursOptionPonderation"("coursId");

-- CreateIndex
CREATE INDEX "CoursOptionPonderation_optionId_idx" ON "CoursOptionPonderation"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoursOptionPonderation_branchId_coursId_optionId_key" ON "CoursOptionPonderation"("branchId", "coursId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "Cours_branchId_codeCours_key" ON "Cours"("branchId", "codeCours");

-- CreateIndex
CREATE UNIQUE INDEX "Cours_branchId_nameCours_key" ON "Cours"("branchId", "nameCours");

-- AddForeignKey
ALTER TABLE "CoursOptionPonderation" ADD CONSTRAINT "CoursOptionPonderation_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursOptionPonderation" ADD CONSTRAINT "CoursOptionPonderation_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursOptionPonderation" ADD CONSTRAINT "CoursOptionPonderation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

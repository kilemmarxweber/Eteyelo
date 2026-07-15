-- CreateEnum
CREATE TYPE "PrimaryDomain" AS ENUM ('LANGUES', 'MATH_SCIENCES_TECH', 'UNIVERS_SOCIAUX', 'ARTS', 'DEVELOPPEMENT');

-- AlterTable
ALTER TABLE "Cours" ADD COLUMN     "domainOrder" INTEGER,
ADD COLUMN     "primaryDomain" "PrimaryDomain",
ADD COLUMN     "primarySection" TEXT;

-- CreateIndex
CREATE INDEX "Cours_branchId_primaryDomain_idx" ON "Cours"("branchId", "primaryDomain");

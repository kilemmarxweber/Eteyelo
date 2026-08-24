-- CreateEnum
CREATE TYPE "EducationSystem" AS ENUM ('CONGOLAIS', 'ANGOLAIS', 'ANGLAIS');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "educationSystem" "EducationSystem" NOT NULL DEFAULT 'CONGOLAIS';

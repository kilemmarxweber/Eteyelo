-- CreateEnum
CREATE TYPE "TypeBrache" AS ENUM ('PRIMAIRE', 'SECONDAIRE', 'UNIVERSITAIRE');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "typebranch" "TypeBrache";

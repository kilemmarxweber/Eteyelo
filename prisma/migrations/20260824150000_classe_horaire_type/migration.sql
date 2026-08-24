-- CreateEnum
CREATE TYPE "HoraireType" AS ENUM ('COMPLET', 'REDUIT');

-- AlterTable
ALTER TABLE "Classe" ADD COLUMN "horaireType" "HoraireType" NOT NULL DEFAULT 'COMPLET';

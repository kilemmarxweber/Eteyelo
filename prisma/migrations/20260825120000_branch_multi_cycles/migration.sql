-- CreateEnum
CREATE TYPE "Cycle" AS ENUM ('MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'ATELIER', 'CENTRE_FORMATION', 'UNIVERSITE');

-- CreateTable
CREATE TABLE "BranchCycle" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cycle" "Cycle" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BranchCycle_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Classe" ADD COLUMN "cycle" "Cycle";
ALTER TABLE "Section" ADD COLUMN "cycle" "Cycle";
ALTER TABLE "Option" ADD COLUMN "cycle" "Cycle";
ALTER TABLE "TypeFrais" ADD COLUMN "cycle" "Cycle";
ALTER TABLE "semester" ADD COLUMN "cycle" "Cycle";
ALTER TABLE "period" ADD COLUMN "cycle" "Cycle";
ALTER TABLE "Frais" ADD COLUMN "semesterId" INTEGER;
ALTER TABLE "Frais" ADD COLUMN "fraisGroupKey" TEXT;

-- Backfill cycle from Branch.typebranch
UPDATE "Classe" c SET "cycle" = b."typebranch"::text::"Cycle"
FROM "Branch" b WHERE b.id = c."branchId";

UPDATE "Section" s SET "cycle" = b."typebranch"::text::"Cycle"
FROM "Branch" b WHERE b.id = s."branchId";

UPDATE "Option" o SET "cycle" = b."typebranch"::text::"Cycle"
FROM "Branch" b WHERE b.id = o."branchId";

UPDATE "semester" s SET "cycle" = b."typebranch"::text::"Cycle"
FROM "Branch" b WHERE b.id = s."branchId";

UPDATE "period" p SET "cycle" = b."typebranch"::text::"Cycle"
FROM "Branch" b WHERE b.id = p."branchId";

INSERT INTO "BranchCycle" ("id", "branchId", "cycle", "sortOrder", "isActive")
SELECT gen_random_uuid()::text, b.id, b."typebranch"::text::"Cycle", 0, true
FROM "Branch" b;

ALTER TABLE "semester" ALTER COLUMN "cycle" SET NOT NULL;
ALTER TABLE "period" ALTER COLUMN "cycle" SET NOT NULL;

-- Unique indexes
DROP INDEX IF EXISTS "semester_branchId_label_key";
CREATE UNIQUE INDEX "semester_branchId_cycle_label_key" ON "semester"("branchId", "cycle", "label");

DROP INDEX IF EXISTS "period_branchId_semesterId_label_key";
CREATE UNIQUE INDEX "period_branchId_cycle_semesterId_label_key" ON "period"("branchId", "cycle", "semesterId", "label");

CREATE UNIQUE INDEX "BranchCycle_branchId_cycle_key" ON "BranchCycle"("branchId", "cycle");
CREATE INDEX "BranchCycle_branchId_isActive_idx" ON "BranchCycle"("branchId", "isActive");
CREATE INDEX "Classe_branchId_cycle_idx" ON "Classe"("branchId", "cycle");
CREATE INDEX "Classe_branchId_cycle_level_idx" ON "Classe"("branchId", "cycle", "level");
CREATE INDEX "Section_branchId_cycle_idx" ON "Section"("branchId", "cycle");
CREATE INDEX "Option_branchId_cycle_idx" ON "Option"("branchId", "cycle");
CREATE INDEX "TypeFrais_branchId_cycle_idx" ON "TypeFrais"("branchId", "cycle");
CREATE INDEX "semester_branchId_cycle_idx" ON "semester"("branchId", "cycle");
CREATE INDEX "period_branchId_cycle_idx" ON "period"("branchId", "cycle");
CREATE INDEX "Frais_semesterId_idx" ON "Frais"("semesterId");
CREATE INDEX "Frais_branchId_fraisGroupKey_idx" ON "Frais"("branchId", "fraisGroupKey");

ALTER TABLE "BranchCycle" ADD CONSTRAINT "BranchCycle_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Frais" ADD CONSTRAINT "Frais_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Branch"
SET "typebranch" = 'SECONDAIRE'
WHERE "typebranch" IS NULL;

ALTER TABLE "Branch"
ALTER COLUMN "typebranch" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Branch_organizationId_typebranch_idx"
ON "Branch"("organizationId", "typebranch");

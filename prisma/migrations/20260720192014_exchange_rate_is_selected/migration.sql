-- AlterTable
ALTER TABLE "ExchangeRate" ADD COLUMN "isSelected" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ExchangeRate_organizationId_isSelected_idx" ON "ExchangeRate"("organizationId", "isSelected");

-- Default: select USD → CDF (or first active pair) per organization when none selected
WITH preferred AS (
  SELECT DISTINCT ON ("organizationId")
    id,
    "organizationId"
  FROM "ExchangeRate"
  WHERE "isActive" = true
  ORDER BY
    "organizationId",
    CASE
      WHEN "fromCurrency" = 'USD' AND "toCurrency" = 'CDF' THEN 0
      WHEN "fromCurrency" = 'USD' THEN 1
      ELSE 2
    END,
    "createdAt" ASC
)
UPDATE "ExchangeRate" AS er
SET "isSelected" = true
FROM preferred
WHERE er.id = preferred.id
  AND NOT EXISTS (
    SELECT 1
    FROM "ExchangeRate" existing
    WHERE existing."organizationId" = preferred."organizationId"
      AND existing."isSelected" = true
  );

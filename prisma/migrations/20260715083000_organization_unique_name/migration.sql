-- Remove empty duplicate organizations created by the retry bug
-- (same name, no members), keeping the oldest row per name.
DELETE FROM "organization" o
USING (
  SELECT id
  FROM (
    SELECT
      o.id,
      ROW_NUMBER() OVER (
        PARTITION BY lower(o.name)
        ORDER BY o."createdAt" ASC, o.id ASC
      ) AS rn,
      (
        SELECT COUNT(*)::int
        FROM "member" m
        WHERE m."organizationId" = o.id
      ) AS member_count
    FROM "organization" o
  ) ranked
  WHERE ranked.rn > 1
    AND ranked.member_count = 0
) d
WHERE o.id = d.id;

-- If duplicates remain (both have members), disambiguate names before unique index
UPDATE "organization" o
SET name = o.name || ' (' || o.slug || ')'
FROM (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY lower(name)
        ORDER BY "createdAt" ASC, id ASC
      ) AS rn
    FROM "organization"
  ) ranked
  WHERE ranked.rn > 1
) d
WHERE o.id = d.id;

-- CreateIndex
CREATE UNIQUE INDEX "organization_name_key" ON "organization"("name");

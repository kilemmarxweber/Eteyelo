-- Ciblage multi-classes des événements calendrier (vide = global).
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "classeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "CalendarEvent"
SET "classeIds" = ARRAY["classeId"]
WHERE "classeId" IS NOT NULL
  AND COALESCE(cardinality("classeIds"), 0) = 0;

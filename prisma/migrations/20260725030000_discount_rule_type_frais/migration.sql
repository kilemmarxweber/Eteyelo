-- Remise liée à un type de frais précis (définie à l'inscription).
ALTER TABLE "DiscountRule"
ADD COLUMN IF NOT EXISTS "typeFraisId" TEXT;

CREATE INDEX IF NOT EXISTS "DiscountRule_typeFraisId_idx" ON "DiscountRule"("typeFraisId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DiscountRule_typeFraisId_fkey'
  ) THEN
    ALTER TABLE "DiscountRule"
    ADD CONSTRAINT "DiscountRule_typeFraisId_fkey"
    FOREIGN KEY ("typeFraisId") REFERENCES "TypeFrais"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

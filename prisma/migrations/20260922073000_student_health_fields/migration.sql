-- Santé élève : groupe sanguin et allergies (saisis par le parent sur la fiche).
ALTER TABLE "Student"
ADD COLUMN IF NOT EXISTS "groupeSanguin" TEXT,
ADD COLUMN IF NOT EXISTS "allergies" TEXT;

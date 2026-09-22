-- Preuves visuelles (max 5) jointes à une justification d'absence.
ALTER TABLE "AbsenceCase"
ADD COLUMN IF NOT EXISTS "justificationImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

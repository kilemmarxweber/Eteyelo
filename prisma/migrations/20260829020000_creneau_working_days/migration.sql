-- Jours ouvrables par vacation (Creneau)

ALTER TABLE "Creneau"
ADD COLUMN IF NOT EXISTS "workingDays" "Day"[] DEFAULT ARRAY['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']::"Day"[];

UPDATE "Creneau"
SET "workingDays" = ARRAY['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']::"Day"[]
WHERE "workingDays" IS NULL OR cardinality("workingDays") = 0;

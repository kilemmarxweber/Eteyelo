-- Contraintes d'affectation pour la génération automatique d'horaire.
ALTER TABLE "Teaching" ADD COLUMN IF NOT EXISTS "consecutiveSlots" INTEGER;
ALTER TABLE "Teaching" ADD COLUMN IF NOT EXISTS "preferredDays" "Day"[] DEFAULT ARRAY[]::"Day"[];

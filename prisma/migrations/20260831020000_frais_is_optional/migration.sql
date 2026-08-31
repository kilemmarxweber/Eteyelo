-- Frais non obligatoire (uniforme, extra…) : hors compte tant qu'il n'est pas accepté au paiement.
ALTER TABLE "Frais" ADD COLUMN IF NOT EXISTS "isOptional" BOOLEAN NOT NULL DEFAULT false;

-- Taille de police configurable pour tous les rapports PDF de l'organisation.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "pdfFontSize" INTEGER NOT NULL DEFAULT 10;

-- Taille PDF recommandée : 12 pt (était 10).
ALTER TABLE "organization" ALTER COLUMN "pdfFontSize" SET DEFAULT 12;
UPDATE "organization" SET "pdfFontSize" = 12 WHERE "pdfFontSize" = 10;

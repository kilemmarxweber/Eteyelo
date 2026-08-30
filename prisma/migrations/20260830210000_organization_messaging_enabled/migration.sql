-- Interrupteur organisationnel de la messagerie interne.
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "messagingEnabled" BOOLEAN NOT NULL DEFAULT true;

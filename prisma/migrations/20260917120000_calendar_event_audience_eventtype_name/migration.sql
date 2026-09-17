-- Audience ciblée pour les jours fériés / fermetures (élèves, enseignants, personnel).
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "closesForStudents" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "closesForTeachers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "closesForPersonnel" BOOLEAN NOT NULL DEFAULT true;

-- Autoriser le même nom de type d'événement sur des branches différentes.
DROP INDEX IF EXISTS "EventType_name_key";

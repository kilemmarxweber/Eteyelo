-- Ajoute la nouvelle ressource payroll aux presets déjà présents en base.
UPDATE "organizationRole"
SET "permission" = jsonb_set(
  "permission"::jsonb,
  '{payroll}',
  CASE "role"
    WHEN 'owner' THEN '["read","compute","validate","pay"]'::jsonb
    WHEN 'gestionnaire' THEN '["read","compute","validate","pay"]'::jsonb
    WHEN 'prefet' THEN '["read","validate"]'::jsonb
    WHEN 'directeur' THEN '["read","validate"]'::jsonb
    WHEN 'directeur_etudes' THEN '["read"]'::jsonb
    WHEN 'teacher' THEN '["read"]'::jsonb
    WHEN 'superviseur' THEN '["read","compute","validate"]'::jsonb
    WHEN 'caissier' THEN '["read","pay"]'::jsonb
  END,
  true
)::text
WHERE "role" IN (
  'owner',
  'gestionnaire',
  'prefet',
  'directeur',
  'directeur_etudes',
  'teacher',
  'superviseur',
  'caissier'
)
AND "permission" IS NOT NULL
AND btrim("permission") <> '';

-- Migration donnees roles organisation (Phase 07 + refonte 2A)
-- Preferer le script TypeScript idempotent:
--   pnpm run migrate:org-roles:dry-run
--   pnpm run migrate:org-roles
--
-- Ce SQL est une reference manuelle. Adapter avant execution directe.

-- 1) Convertir les gestionnaires org mal classes en owner membre
UPDATE member AS m
SET role = 'gestionnaire'
FROM "user" AS u
WHERE m.user_id = u.id
  AND u.role = 'admin'
  AND m.role = 'owner';

-- 2) Mapping 2A des slugs org (CSV-safe via REPLACE)
UPDATE "member" SET role = REPLACE(role, 'surveillant', 'superviseur');
UPDATE "member" SET role = REPLACE(role, 'responsable', 'directeur');
UPDATE "member" SET role = REPLACE(role, 'moniteur', 'prefet');

-- 3) Renommer les presets OrganizationRole dynamiques (si pas de collision)
UPDATE "organizationRole"
SET role = 'superviseur'
WHERE role = 'surveillant'
  AND NOT EXISTS (
    SELECT 1
    FROM "organizationRole" AS other
    WHERE other."organizationId" = "organizationRole"."organizationId"
      AND other.role = 'superviseur'
  );

UPDATE "organizationRole"
SET role = 'directeur'
WHERE role = 'responsable'
  AND NOT EXISTS (
    SELECT 1
    FROM "organizationRole" AS other
    WHERE other."organizationId" = "organizationRole"."organizationId"
      AND other.role = 'directeur'
  );

UPDATE "organizationRole"
SET role = 'prefet'
WHERE role = 'moniteur'
  AND NOT EXISTS (
    SELECT 1
    FROM "organizationRole" AS other
    WHERE other."organizationId" = "organizationRole"."organizationId"
      AND other.role = 'prefet'
  );

DELETE FROM "organizationRole"
WHERE role IN ('surveillant', 'responsable', 'moniteur');

-- 4) Promouvoir les anciens super admins sans membership
UPDATE "user"
SET role = 'owner'
WHERE role = 'admin'
  AND id NOT IN (SELECT DISTINCT user_id FROM member);

-- 5) Retirer les memberships des proprietaires plateforme
DELETE FROM member AS m
USING "user" AS u
WHERE m.user_id = u.id
  AND u.role = 'owner';

-- 6) Audit memberships multiples (lecture seule)
SELECT user_id, COUNT(*) AS membership_count
FROM member
GROUP BY user_id
HAVING COUNT(*) > 1;

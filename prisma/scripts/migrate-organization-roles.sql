-- Migration donnees roles organisation (Phase 07)
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

-- 2) Promouvoir les anciens super admins sans membership
UPDATE "user"
SET role = 'owner'
WHERE role = 'admin'
  AND id NOT IN (SELECT DISTINCT user_id FROM member);

-- 3) Retirer les memberships des proprietaires plateforme
DELETE FROM member AS m
USING "user" AS u
WHERE m.user_id = u.id
  AND u.role = 'owner';

-- 4) Audit memberships multiples (lecture seule)
SELECT user_id, COUNT(*) AS membership_count
FROM member
GROUP BY user_id
HAVING COUNT(*) > 1;

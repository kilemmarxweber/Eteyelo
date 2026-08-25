-- Better Auth sign-in matches email with toLowerCase() + exact equality.
-- Normalize stored emails so existing accounts remain findable.
UPDATE "user" AS u
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL
  AND email <> LOWER(TRIM(email))
  AND NOT EXISTS (
    SELECT 1
    FROM "user" AS other
    WHERE other.id <> u.id
      AND other.email IS NOT NULL
      AND LOWER(TRIM(other.email)) = LOWER(TRIM(u.email))
  );

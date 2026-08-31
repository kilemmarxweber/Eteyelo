/**
 * Accès complets propres à la branche active (menus + zones).
 *
 * Réservé au **propriétaire** de branche (`ADMIN` / alias owner).
 * Le rôle `DIRECTOR` (Directeur) n’a pas ce bypass : il reste limité
 * à ses privilèges d’organisation / pédagogie.
 */
const FULL_BRANCH_ACCESS_ROLES = new Set([
  "admin",
  "owner",
  "proprietaire",
  "branch_admin",
  "branch_owner",
]);

function splitRoles(value: unknown): string[] {
  if (typeof value !== "string") return [];

  return value
    .split(",")
    .map((role) =>
      role
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[-\s]+/g, "_"),
    )
    .filter(Boolean);
}

export function isFullBranchAccessRole(role: unknown): boolean {
  return splitRoles(role).some((value) =>
    FULL_BRANCH_ACCESS_ROLES.has(value),
  );
}

/**
 * Le rôle de branche est volontairement séparé du rôle d'organisation :
 * `user` dans l'organisation peut donc administrer sa branche assignée.
 */
export function isBranchOwnerSession(
  session: unknown,
  ...extraRoles: unknown[]
): boolean {
  const value = session as {
    branchMemberRole?: unknown;
    branchMember?: { role?: unknown } | null;
  } | null;

  return [
    value?.branchMemberRole,
    value?.branchMember?.role,
    ...extraRoles,
  ].some(isFullBranchAccessRole);
}

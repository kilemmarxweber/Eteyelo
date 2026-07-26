import { ORG_ROLE } from "@/lib/permissions";

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Accueil org admin — sans caissier (unit-00 / unit-04 : reste en login branche).
 * unit-08 : directeur (et préfet) peuvent rester sur le hub org en lecture/pilotage ;
 * post-login → branche d’affectation BranchMember, sinon `/ecodim`.
 * Pas de settings org sensibles (`canAccessBranchOrgSettings` / owner-only).
 */
const ORG_ADMIN_HOME_ROLES = new Set<string>([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
  ORG_ROLE.SUPERVISEUR,
]);

export function canAccessOrganizationAdminHome(
  membershipRole: string | null | undefined,
) {
  return splitRoles(membershipRole).some((role) =>
    ORG_ADMIN_HOME_ROLES.has(role),
  );
}

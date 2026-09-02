/**
 * Accès complets propres à la branche active (menus + zones).
 *
 * Réservé au membre branche `ADMIN` **dont le rôle d'organisation autorise
 * l'administration de branche** (owner, gestionnaire, membre `user`, etc.).
 *
 * Un directeur / directeur des études / enseignant / caissier reste limité
 * à la matrice OrganizationRole même s'il est `ADMIN` sur la branche.
 */
import { ORG_ROLE } from "@/lib/permissions";

const FULL_BRANCH_ACCESS_ROLES = new Set([
  "admin",
  "owner",
  "proprietaire",
  "branch_admin",
  "branch_owner",
]);

/** Rôles org : BranchMember ADMIN ne doit pas bypasser le DAC. */
const BRANCH_ADMIN_DAC_LIMITED_ORG_ROLES = new Set<string>([
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
  ORG_ROLE.TEACHER,
  ORG_ROLE.CAISSIER,
  ORG_ROLE.STUDENT,
  ORG_ROLE.PARENT,
  ORG_ROLE.AGENT_BUREAU,
  ORG_ROLE.SUPPORT,
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

function getOrganizationRoleSlugs(session: unknown): string[] {
  const value = session as {
    organization?: { role?: unknown };
    member?: { role?: unknown };
    activeMember?: { role?: unknown };
  } | null;

  return [
    ...splitRoles(value?.organization?.role),
    ...splitRoles(value?.member?.role),
    ...splitRoles(value?.activeMember?.role),
  ];
}

function isOrgRoleLimitedToDacMatrix(session: unknown, extraRoles: unknown[]): boolean {
  const orgRoles = [...getOrganizationRoleSlugs(session), ...extraRoles.flatMap(splitRoles)];
  return orgRoles.some((role) => BRANCH_ADMIN_DAC_LIMITED_ORG_ROLES.has(role));
}

/**
 * True si le membre branche actif est admin de branche ET son rôle org
 * n'est pas un rôle métier encadré par la matrice DAC.
 */
export function isBranchOwnerSession(
  session: unknown,
  ...extraRoles: unknown[]
): boolean {
  const value = session as {
    branchMemberRole?: unknown;
    branchMember?: { role?: unknown } | null;
  } | null;

  const hasBranchAdminRole = [
    value?.branchMemberRole,
    value?.branchMember?.role,
    ...extraRoles,
  ].some(isFullBranchAccessRole);

  if (!hasBranchAdminRole) return false;
  if (isOrgRoleLimitedToDacMatrix(session, extraRoles)) return false;

  return true;
}

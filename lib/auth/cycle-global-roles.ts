import { ORG_ROLE } from "@/lib/permissions";

/** Accès données à tous les cycles (caisse / agent bureau / modules transverses). */
export const CYCLE_GLOBAL_ROLES = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.AGENT_BUREAU,
  ORG_ROLE.CAISSIER,
] as const;

/**
 * Seuls propriétaire, gestionnaire et agent de bureau voient **tous**
 * les utilisateurs. Les autres rôles sont limités au même cycle.
 */
export const USER_DIRECTORY_GLOBAL_ROLES = [
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.AGENT_BUREAU,
] as const;

export type CycleGlobalRole = (typeof CYCLE_GLOBAL_ROLES)[number];
export type UserDirectoryGlobalRole =
  (typeof USER_DIRECTORY_GLOBAL_ROLES)[number];

function memberRoleSlugs(role: string | null | undefined): string[] {
  return (role ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isCycleGlobalRole(
  role: string | null | undefined,
): boolean {
  return memberRoleSlugs(role).some((slug) =>
    (CYCLE_GLOBAL_ROLES as readonly string[]).includes(slug),
  );
}

export function canViewAllDirectoryUsers(
  role: string | null | undefined,
): boolean {
  return memberRoleSlugs(role).some(
    (slug) =>
      (USER_DIRECTORY_GLOBAL_ROLES as readonly string[]).includes(slug) ||
      slug === "proprietaire" ||
      slug === "membre_bureau" ||
      slug === "agent de bureau",
  );
}

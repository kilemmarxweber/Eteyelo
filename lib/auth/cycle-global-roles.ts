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

export function isCycleGlobalRole(
  role: string | null | undefined,
): role is CycleGlobalRole {
  if (!role) return false;
  return (CYCLE_GLOBAL_ROLES as readonly string[]).includes(role);
}

export function canViewAllDirectoryUsers(
  role: string | null | undefined,
): role is UserDirectoryGlobalRole {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return (
    (USER_DIRECTORY_GLOBAL_ROLES as readonly string[]).includes(role) ||
    normalized === "owner" ||
    normalized === "proprietaire" ||
    normalized === "gestionnaire" ||
    normalized === "agent_bureau" ||
    normalized === "membre_bureau" ||
    normalized === "agent de bureau"
  );
}

import { splitSessionRoles } from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";

/** Rôles org adaptés au profil « personnel » (hors enseignant / élève / parent). */
export const PERSONNEL_ORG_ROLE_OPTIONS = [
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.AGENT_BUREAU,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
  ORG_ROLE.SUPERVISEUR,
  ORG_ROLE.CAISSIER,
  ORG_ROLE.SUPPORT,
] as const;

export function appendMemberOrgRoles(
  current: string | null | undefined,
  ...toAdd: string[]
): string {
  const roles = splitSessionRoles(current);
  const seen = new Set(roles);
  for (const raw of toAdd) {
    for (const role of splitSessionRoles(raw)) {
      if (!seen.has(role)) {
        seen.add(role);
        roles.push(role);
      }
    }
  }
  return roles.join(",");
}

export function removeMemberOrgRoles(
  current: string | null | undefined,
  ...toRemove: string[]
): string {
  const remove = new Set(toRemove.flatMap((r) => splitSessionRoles(r)));
  return splitSessionRoles(current)
    .filter((role) => !remove.has(role))
    .join(",");
}

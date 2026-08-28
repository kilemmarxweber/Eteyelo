/**
 * Résolution permission locale depuis les presets code (+ future DAC DB).
 * Utilisé quand `PERMISSIONS_FROM_DAC=true`.
 */

import { getSessionRoles } from "@/lib/auth/session-roles";
import {
  BRANCH_AREA_PERMISSION,
  isPermissionsFromDacEnabled,
  type BranchArea,
} from "@/lib/auth/branch-area-permissions";
import {
  ORG_ROLE,
  organizationRoleStatements,
  hasPlatformSupportPrivileges,
} from "@/lib/permissions";

type Statements = Record<string, readonly string[] | undefined>;

function statementsForRole(slug: string): Statements | null {
  const org = organizationRoleStatements[slug];
  if (org) return org as Statements;
  return null;
}

/** Au moins une action requise présente. */
export function roleAllowsAny(
  statements: Statements | null | undefined,
  resource: string,
  actions: string[],
): boolean {
  if (!statements) return false;
  const have = new Set((statements[resource] ?? []).map(String));
  return actions.some((a) => have.has(a));
}

/** Toutes les actions requises présentes. */
export function roleAllowsAll(
  statements: Statements | null | undefined,
  resource: string,
  actions: string[],
): boolean {
  if (!statements) return false;
  const have = new Set((statements[resource] ?? []).map(String));
  return actions.every((a) => have.has(a));
}

/**
 * True si un des rôles session couvre la permission de la zone.
 * Bypass owner plateforme / support.
 */
export function canAccessBranchAreaFromPermissions(
  area: BranchArea,
  session: unknown,
): boolean {
  const roles = getSessionRoles(session);
  const appRole = [...roles].find((r) =>
    ["owner", "admin", "platform_support", "user"].includes(r),
  );
  if (appRole && hasPlatformSupportPrivileges(appRole)) {
    return true;
  }
  if (roles.has(ORG_ROLE.OWNER) || roles.has("proprietaire")) {
    return true;
  }

  const required = BRANCH_AREA_PERMISSION[area];
  if (!required) return false;

  for (const slug of roles) {
    const statements = statementsForRole(slug);
    if (!statements) continue;

    let ok = true;
    for (const [resource, actions] of Object.entries(required)) {
      // Zones finance : read OU encaisser suffit pour entrer.
      if (resource === "finance" && area === "finance") {
        if (!roleAllowsAny(statements, resource, actions)) {
          ok = false;
          break;
        }
        continue;
      }
      if (!roleAllowsAll(statements, resource, actions)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  return false;
}

export { isPermissionsFromDacEnabled };

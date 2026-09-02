/**
 * Résolution permission depuis OrganizationRole (DB) + repli seed code.
 * Utilisé quand `PERMISSIONS_FROM_DAC` n’est pas désactivé.
 */

import {
  getSessionRoles,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";
import {
  BRANCH_AREA_PERMISSION,
  isPermissionsFromDacEnabled,
  type BranchArea,
} from "@/lib/auth/branch-area-permissions";
import {
  getStatementsForRole,
  statementsMapFromSession,
  type RoleStatements,
} from "@/lib/auth/org-role-permission-shared";
import { hasPlatformSupportPrivileges } from "@/lib/permissions";

/** Au moins une action requise présente. */
export function roleAllowsAny(
  statements: RoleStatements | null | undefined,
  resource: string,
  actions: string[],
): boolean {
  if (!statements) return false;
  const have = new Set((statements[resource] ?? []).map(String));
  return actions.some((a) => have.has(a));
}

/** Toutes les actions requises présentes. */
export function roleAllowsAll(
  statements: RoleStatements | null | undefined,
  resource: string,
  actions: string[],
): boolean {
  if (!statements) return false;
  const have = new Set((statements[resource] ?? []).map(String));
  return actions.every((a) => have.has(a));
}

/**
 * True si un des rôles session couvre la permission de la zone.
 *
 * - Propriétaire org / plateforme / branche : accès complet (tous les menus).
 * - Directeur, gestionnaire, enseignant, etc. : matrice OrganizationRole (DB) uniquement.
 *
 * @param roleStatements Map DB (OrganizationRole). Si absente, lecture depuis
 *   `session.organization.rolePermissions`, sinon repli seed (tests).
 */
export function canAccessBranchAreaFromPermissions(
  area: BranchArea,
  session: unknown,
  roleStatements?: Map<string, RoleStatements> | null,
): boolean {
  if (isOrganizationOwnerSession(session)) return true;

  const roles = getSessionRoles(session);
  const appRole = [...roles].find((r) =>
    ["owner", "admin", "platform_support", "user"].includes(r),
  );
  if (appRole && hasPlatformSupportPrivileges(appRole)) {
    return true;
  }

  const required = BRANCH_AREA_PERMISSION[area];
  if (!required) return false;

  const map = roleStatements ?? statementsMapFromSession(session);

  for (const slug of roles) {
    const statements = getStatementsForRole(slug, map);
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

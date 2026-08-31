import "server-only";

import { cache } from "react";

import { fetchOrganizationRoleStatements } from "@/lib/auth/org-role-permissions-load";
import type { RoleStatements } from "@/lib/auth/org-role-permission-shared";

export type { RoleStatements };
export {
  getStatementsForRole,
  parseOrganizationRolePermission,
} from "@/lib/auth/org-role-permission-shared";

/**
 * Permissions OrganizationRole pour une org (DB uniquement).
 * Mis en cache React par requête.
 */
export const loadOrganizationRoleStatements = cache(
  fetchOrganizationRoleStatements,
);

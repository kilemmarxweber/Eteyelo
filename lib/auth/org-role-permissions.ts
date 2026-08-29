import "server-only";

import { cache } from "react";

import {
  parseOrganizationRolePermission,
  seedStatementsForRole,
  type RoleStatements,
} from "@/lib/auth/org-role-permission-shared";
import { organizationRoleStatements } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type { RoleStatements };
export {
  getStatementsForRole,
  parseOrganizationRolePermission,
} from "@/lib/auth/org-role-permission-shared";

/**
 * Permissions OrganizationRole pour une org (DB), avec repli seed code.
 * Mis en cache React par requête.
 */
export const loadOrganizationRoleStatements = cache(
  async (organizationId: string): Promise<Map<string, RoleStatements>> => {
    const rows = await prisma.organizationRole.findMany({
      where: { organizationId },
      select: { role: true, permission: true },
    });

    const map = new Map<string, RoleStatements>();

    for (const row of rows) {
      const fromDb = parseOrganizationRolePermission(row.permission);
      // DB est la source de vérité (pas d’union avec le seed).
      map.set(row.role, fromDb);
    }

    for (const slug of Object.keys(organizationRoleStatements)) {
      if (!map.has(slug)) {
        const seed = seedStatementsForRole(slug);
        if (seed) map.set(slug, seed);
      }
    }

    return map;
  },
);

import {
  seedOrganizationRolePresets,
  syncStaleLeadershipRolePresets,
} from "@/lib/auth/seed-organization-roles";
import {
  parseOrganizationRolePermission,
  type RoleStatements,
} from "@/lib/auth/org-role-permission-shared";
import { prisma } from "@/lib/prisma";

export type { RoleStatements };

/**
 * Charge la matrice OrganizationRole (DB). Seed uniquement si l’org n’a
 * encore aucune ligne — jamais de fusion des actions avec le catalogue statique.
 */
export async function fetchOrganizationRoleStatements(
  organizationId: string,
): Promise<Map<string, RoleStatements>> {
  const count = await prisma.organizationRole.count({
    where: { organizationId },
  });
  if (count === 0) {
    await seedOrganizationRolePresets({
      organizationId,
      resetPermissions: false,
    });
  } else {
    await syncStaleLeadershipRolePresets(organizationId);
  }

  const rows = await prisma.organizationRole.findMany({
    where: { organizationId },
    select: { role: true, permission: true },
  });

  const map = new Map<string, RoleStatements>();
  for (const row of rows) {
    map.set(row.role, parseOrganizationRolePermission(row.permission));
  }
  return map;
}

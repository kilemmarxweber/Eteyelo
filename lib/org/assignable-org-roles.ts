import "server-only";

import { seedOrganizationRolePresets } from "@/lib/auth/seed-organization-roles";
import { parseOrganizationRolePermission } from "@/lib/auth/org-role-permission-shared";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type AssignableOrgRole = {
  slug: string;
  label: string;
  permissionKeys: string[];
};

function permissionKeysFromRaw(raw: string | null | undefined): string[] {
  const parsed = parseOrganizationRolePermission(raw);
  return Object.entries(parsed).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}:${action}`),
  );
}

export async function listAssignableOrganizationRoles(
  organizationId: string,
): Promise<AssignableOrgRole[]> {
  const count = await prisma.organizationRole.count({
    where: { organizationId },
  });
  if (count === 0) {
    await seedOrganizationRolePresets({
      organizationId,
      resetPermissions: false,
    });
  }

  const rows = await prisma.organizationRole.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { role: "asc" }],
    select: { role: true, label: true, permission: true },
  });

  if (rows.length === 0) {
    return ALL_ORG_ROLE_SLUGS.map((slug) => ({
      slug,
      label: orgRoleLabel(slug),
      permissionKeys: [],
    }));
  }

  return rows.map((row) => ({
    slug: row.role,
    label: row.label?.trim() || orgRoleLabel(row.role),
    permissionKeys: permissionKeysFromRaw(row.permission),
  }));
}

export async function organizationRoleExists(
  organizationId: string,
  slug: string,
): Promise<boolean> {
  const role = slug.trim().toLowerCase();
  if (!role) return false;
  const row = await prisma.organizationRole.findUnique({
    where: {
      organizationId_role: {
        organizationId,
        role,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

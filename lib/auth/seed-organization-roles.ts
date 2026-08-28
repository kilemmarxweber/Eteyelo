/**
 * P2 — Upsert des presets OrganizationRole par organisation.
 * Remplace le clear agressif des overrides (migrate-organization-roles).
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getOrgRolePresetSeedRows } from "@/lib/org/role-presets";

export type SeedOrganizationRolesOptions = {
  organizationId?: string;
  /** Si true : réécrit `permission` des presets système depuis le code. */
  resetPermissions?: boolean;
  dryRun?: boolean;
};

export type SeedOrganizationRolesReport = {
  dryRun: boolean;
  resetPermissions: boolean;
  organizationsVisited: number;
  created: number;
  updatedMeta: number;
  resetPermission: number;
  skippedCustom: number;
};

/**
 * Assure que chaque org a une ligne OrganizationRole pour chaque preset seed.
 * - Customs (isSystem=false / slug hors presets) : jamais touchés.
 * - Presets existants : met à jour label/description/isSystem/sortOrder ;
 *   `permission` seulement si `resetPermissions` ou ligne absente.
 */
export async function seedOrganizationRolePresets(
  options: SeedOrganizationRolesOptions = {},
): Promise<SeedOrganizationRolesReport> {
  const dryRun = Boolean(options.dryRun);
  const resetPermissions = Boolean(options.resetPermissions);
  const seedRows = getOrgRolePresetSeedRows();
  const presetSlugs = new Set(seedRows.map((r) => r.slug));

  const organizations = await prisma.organization.findMany({
    where: options.organizationId
      ? { id: options.organizationId }
      : undefined,
    select: { id: true },
  });

  let created = 0;
  let updatedMeta = 0;
  let resetPermission = 0;
  let skippedCustom = 0;

  for (const org of organizations) {
    const existing = await prisma.organizationRole.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        role: true,
        permission: true,
        label: true,
        description: true,
        isSystem: true,
        sortOrder: true,
      },
    });
    const byRole = new Map(existing.map((row) => [row.role, row]));

    for (const row of existing) {
      if (!presetSlugs.has(row.role) && !row.isSystem) {
        skippedCustom += 1;
      }
    }

    for (const seed of seedRows) {
      const current = byRole.get(seed.slug);
      if (!current) {
        created += 1;
        if (!dryRun) {
          await prisma.organizationRole.create({
            data: {
              id: randomUUID(),
              organizationId: org.id,
              role: seed.slug,
              permission: seed.permission,
              label: seed.label,
              description: seed.description,
              isSystem: seed.isSystem,
              sortOrder: seed.sortOrder,
            },
          });
        }
        continue;
      }

      const metaChanged =
        current.label !== seed.label ||
        current.description !== seed.description ||
        current.isSystem !== seed.isSystem ||
        current.sortOrder !== seed.sortOrder;

      const shouldResetPermission =
        resetPermissions || !current.permission?.trim();

      if (!metaChanged && !shouldResetPermission) continue;

      if (metaChanged) updatedMeta += 1;
      if (shouldResetPermission) resetPermission += 1;

      if (!dryRun) {
        await prisma.organizationRole.update({
          where: { id: current.id },
          data: {
            label: seed.label,
            description: seed.description,
            isSystem: seed.isSystem,
            sortOrder: seed.sortOrder,
            ...(shouldResetPermission
              ? { permission: seed.permission }
              : {}),
          },
        });
      }
    }
  }

  return {
    dryRun,
    resetPermissions,
    organizationsVisited: organizations.length,
    created,
    updatedMeta,
    resetPermission,
    skippedCustom,
  };
}

export function formatSeedOrganizationRolesReport(
  report: SeedOrganizationRolesReport,
) {
  return [
    `Orgs: ${report.organizationsVisited}`,
    `Créés: ${report.created}`,
    `Meta MAJ: ${report.updatedMeta}`,
    `Permissions reset: ${report.resetPermission}`,
    `Customs ignorés: ${report.skippedCustom}`,
    report.dryRun ? "(dry-run)" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

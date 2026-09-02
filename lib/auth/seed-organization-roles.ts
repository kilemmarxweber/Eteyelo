/**
 * P2 — Upsert des presets OrganizationRole par organisation.
 * Remplace le clear agressif des overrides (migrate-organization-roles).
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getOrgRolePresetSeedRows } from "@/lib/org/role-presets";
import { ORG_ROLE } from "@/lib/permissions";

const LEADERSHIP_ROLE_SLUGS = [
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.DIRECTEUR_ETUDES,
] as const;

function parsePermissionJson(raw: string | null | undefined): Record<string, string[]> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) out[key] = value.map(String);
    }
    return out;
  } catch {
    return {};
  }
}

/** Ancien preset leadership : finance / inscription, ou trop de paramètres établissement. */
function isStaleLeadershipPermission(permission: Record<string, string[]>): boolean {
  return (
    (permission.inscription?.length ?? 0) > 0 ||
    (permission.candidatures?.length ?? 0) > 0 ||
    (permission.finance?.length ?? 0) > 0 ||
    (permission.fees?.length ?? 0) > 0 ||
    (permission.schoolYear?.length ?? 0) > 0 ||
    (permission.structureCopy?.length ?? 0) > 0 ||
    (permission.settings?.length ?? 0) > 0
  );
}

/** Ancien preset directeur des études : CRUD enseignants, ou trop de paramètres établissement. */
function isStaleDirecteurEtudesPermission(
  permission: Record<string, string[]>,
): boolean {
  const teacher = permission.teacher ?? [];
  if (
    teacher.includes("create") ||
    teacher.includes("update") ||
    teacher.includes("delete")
  ) {
    return true;
  }
  return isStaleLeadershipPermission(permission);
}

function isStaleLeadershipRolePermission(
  role: string,
  permission: Record<string, string[]>,
): boolean {
  if (role === ORG_ROLE.DIRECTEUR_ETUDES) {
    return isStaleDirecteurEtudesPermission(permission);
  }
  return isStaleLeadershipPermission(permission);
}

/**
 * Réaligne les presets système chef d'établissement si la base contient encore
 * l'ancienne matrice (finance / inscription, ou trop de paramètres établissement).
 */
export async function syncStaleLeadershipRolePresets(
  organizationId: string,
): Promise<number> {
  const seedBySlug = new Map(
    getOrgRolePresetSeedRows()
      .filter((row) =>
        LEADERSHIP_ROLE_SLUGS.includes(
          row.slug as (typeof LEADERSHIP_ROLE_SLUGS)[number],
        ),
      )
      .map((row) => [row.slug, row.permission] as const),
  );

  const rows = await prisma.organizationRole.findMany({
    where: {
      organizationId,
      role: { in: [...LEADERSHIP_ROLE_SLUGS] },
      isSystem: true,
    },
    select: { id: true, role: true, permission: true },
  });

  let updated = 0;
  for (const row of rows) {
    const permission = parsePermissionJson(row.permission);
    const next = seedBySlug.get(row.role);
    if (!next || !isStaleLeadershipRolePermission(row.role, permission)) continue;

    await prisma.organizationRole.update({
      where: { id: row.id },
      data: { permission: next },
    });
    updated += 1;
  }

  return updated;
}

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

"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { completePermissionMatrix } from "@/lib/auth/org-role-permission-shared";
import {
  guardOrganizationAccess,
  guardOrganizationOwner,
} from "@/lib/auth/require-organization-permission";
import { seedOrganizationRolePresets } from "@/lib/auth/seed-organization-roles";
import { listAssignableOrganizationRoles } from "@/lib/org/assignable-org-roles";
import {
  getOrgRolePresetPermissionJson,
  listOrgRolePresetMetas,
} from "@/lib/org/role-presets";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { ALL_ORG_ROLE_SLUGS, ORG_ROLE } from "@/lib/permissions";

const slugSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    "Slug: lettres minuscules, chiffres et _ (doit commencer par une lettre).",
  );

export type OrgRoleListItem = {
  id: string | null;
  slug: string;
  label: string;
  description: string;
  isSystem: boolean;
  locked: boolean;
  sortOrder: number;
  memberCount: number;
  permission: Record<string, string[]>;
  source: "seed" | "db";
};

function parsePermission(raw: string | null | undefined): Record<string, string[]> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        out[key] = value.map(String);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function sanitizePermission(
  input: Record<string, string[]>,
): Record<string, string[]> {
  return completePermissionMatrix(input);
}

function rolesPath(organizationId: string) {
  return `/admin/organizations/${organizationId}/roles`;
}

async function requireRolesOwner(organizationId: string) {
  const guard = await guardOrganizationOwner(organizationId);
  if (!guard.ok) {
    throw new Error(guard.message);
  }
  return guard;
}

export const ensureOrganizationRolesSeededAction = action
  .input(z.object({ organizationId: z.string().min(1) }))
  .handler(async ({ input }) => {
    await requireRolesOwner(input.organizationId);
    const report = await seedOrganizationRolePresets({
      organizationId: input.organizationId,
      resetPermissions: false,
    });
    return report;
  });

export const listOrganizationRolesAction = action
  .input(z.object({ organizationId: z.string().min(1) }))
  .handler(async ({ input }): Promise<OrgRoleListItem[]> => {
    await requireRolesOwner(input.organizationId);

    await seedOrganizationRolePresets({
      organizationId: input.organizationId,
      resetPermissions: false,
    });

    const [rows, members] = await Promise.all([
      prisma.organizationRole.findMany({
        where: { organizationId: input.organizationId },
        orderBy: [{ sortOrder: "asc" }, { role: "asc" }],
      }),
      prisma.member.groupBy({
        by: ["role"],
        where: {
          organizationId: input.organizationId,
          isArchived: false,
        },
        _count: { _all: true },
      }),
    ]);

    const memberCountByRole = new Map<string, number>();
    for (const row of members) {
      for (const part of row.role.split(",").map((r) => r.trim().toLowerCase())) {
        if (!part) continue;
        memberCountByRole.set(
          part,
          (memberCountByRole.get(part) ?? 0) + row._count._all,
        );
      }
    }

    const presetMetas = listOrgRolePresetMetas();
    const bySlug = new Map(rows.map((r) => [r.role, r]));
    const items: OrgRoleListItem[] = [];

    for (const meta of presetMetas) {
      const db = bySlug.get(meta.slug);
      const permission = completePermissionMatrix(
        db
          ? parsePermission(db.permission)
          : parsePermission(getOrgRolePresetPermissionJson(meta.slug)),
      );
      items.push({
        id: db?.id ?? null,
        slug: meta.slug,
        label: db?.label?.trim() || meta.label,
        description: db?.description?.trim() || meta.description,
        isSystem: true,
        locked: meta.locked,
        sortOrder: db?.sortOrder ?? meta.sortOrder,
        memberCount: memberCountByRole.get(meta.slug) ?? 0,
        permission,
        source: db ? "db" : "seed",
      });
      bySlug.delete(meta.slug);
    }

    for (const db of bySlug.values()) {
      items.push({
        id: db.id,
        slug: db.role,
        label: db.label?.trim() || orgRoleLabel(db.role) || db.role,
        description: db.description?.trim() || "",
        isSystem: Boolean(db.isSystem),
        locked: db.role === ORG_ROLE.OWNER,
        sortOrder: db.sortOrder,
        memberCount: memberCountByRole.get(db.role) ?? 0,
        permission: completePermissionMatrix(parsePermission(db.permission)),
        source: "db",
      });
    }

    return items.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
  });

export const listAssignableOrganizationRolesAction = action
  .input(z.object({ organizationId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const access = await guardOrganizationAccess(input.organizationId);
    if (!access.ok) throw new Error(access.message);
    return listAssignableOrganizationRoles(input.organizationId);
  });

export const updateOrganizationRoleAction = action
  .input(
    z.object({
      organizationId: z.string().min(1),
      slug: slugSchema,
      label: z.string().min(1).max(80).optional(),
      description: z.string().max(280).optional(),
      permission: z.record(z.string(), z.array(z.string())),
    }),
  )
  .handler(async ({ input }) => {
    await requireRolesOwner(input.organizationId);

    if (input.slug === ORG_ROLE.OWNER) {
      throw new Error("Le rôle propriétaire ne peut pas être modifié.");
    }

    const permission = sanitizePermission(input.permission);
    const preset = listOrgRolePresetMetas().find((m) => m.slug === input.slug);
    const existing = await prisma.organizationRole.findUnique({
      where: {
        organizationId_role: {
          organizationId: input.organizationId,
          role: input.slug,
        },
      },
    });

    if (existing) {
      await prisma.organizationRole.update({
        where: { id: existing.id },
        data: {
          permission: JSON.stringify(permission),
          label: input.label?.trim() || existing.label || preset?.label,
          description:
            input.description?.trim() ??
            existing.description ??
            preset?.description ??
            "",
          isSystem: existing.isSystem || Boolean(preset),
        },
      });
    } else {
      await prisma.organizationRole.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          role: input.slug,
          permission: JSON.stringify(permission),
          label: input.label?.trim() || preset?.label || input.slug,
          description:
            input.description?.trim() || preset?.description || "",
          isSystem: Boolean(preset),
          sortOrder: preset?.sortOrder ?? 200,
        },
      });
    }

    revalidatePath(rolesPath(input.organizationId));
    revalidatePath(`/admin/organizations/${input.organizationId}`, "layout");
    return { ok: true as const };
  });

export const createOrganizationRoleAction = action
  .input(
    z.object({
      organizationId: z.string().min(1),
      slug: slugSchema,
      label: z.string().min(1).max(80),
      description: z.string().max(280).optional(),
      cloneFrom: z.string().optional(),
      permission: z.record(z.string(), z.array(z.string())).optional(),
    }),
  )
  .handler(async ({ input }) => {
    await requireRolesOwner(input.organizationId);

    const slug = input.slug.toLowerCase();
    if ((ALL_ORG_ROLE_SLUGS as readonly string[]).includes(slug)) {
      throw new Error(
        "Ce slug est réservé à un preset système. Choisissez un autre nom.",
      );
    }

    const taken = await prisma.organizationRole.findUnique({
      where: {
        organizationId_role: {
          organizationId: input.organizationId,
          role: slug,
        },
      },
      select: { id: true },
    });
    if (taken) {
      throw new Error("Un rôle avec ce slug existe déjà.");
    }

    let permission: Record<string, string[]> = {};
    if (input.permission) {
      permission = sanitizePermission(input.permission);
    } else if (input.cloneFrom) {
      const cloneRow = await prisma.organizationRole.findUnique({
        where: {
          organizationId_role: {
            organizationId: input.organizationId,
            role: input.cloneFrom,
          },
        },
        select: { permission: true },
      });
      permission = cloneRow
        ? parsePermission(cloneRow.permission)
        : parsePermission(getOrgRolePresetPermissionJson(input.cloneFrom));
      permission = sanitizePermission(permission);
    }

    await prisma.organizationRole.create({
      data: {
        id: randomUUID(),
        organizationId: input.organizationId,
        role: slug,
        permission: JSON.stringify(permission),
        label: input.label.trim(),
        description: input.description?.trim() || "",
        isSystem: false,
        sortOrder: 200,
      },
    });

    revalidatePath(rolesPath(input.organizationId));
    return { ok: true as const, slug };
  });

export const deleteOrganizationRoleAction = action
  .input(
    z.object({
      organizationId: z.string().min(1),
      slug: slugSchema,
    }),
  )
  .handler(async ({ input }) => {
    await requireRolesOwner(input.organizationId);

    const slug = input.slug.toLowerCase();
    if (
      (ALL_ORG_ROLE_SLUGS as readonly string[]).includes(slug) ||
      slug === ORG_ROLE.OWNER
    ) {
      throw new Error("Les rôles système ne peuvent pas être supprimés.");
    }

    const existing = await prisma.organizationRole.findUnique({
      where: {
        organizationId_role: {
          organizationId: input.organizationId,
          role: slug,
        },
      },
    });
    if (!existing) {
      throw new Error("Rôle introuvable.");
    }
    if (existing.isSystem) {
      throw new Error("Les rôles système ne peuvent pas être supprimés.");
    }

    const assigned = await prisma.member.count({
      where: {
        organizationId: input.organizationId,
        isArchived: false,
        role: { contains: slug },
      },
    });
    if (assigned > 0) {
      throw new Error(
        `Impossible de supprimer : ${assigned} membre(s) encore assigné(s) à ce rôle.`,
      );
    }

    await prisma.organizationRole.delete({ where: { id: existing.id } });
    revalidatePath(rolesPath(input.organizationId));
    return { ok: true as const };
  });

export const resetOrganizationRoleToSeedAction = action
  .input(
    z.object({
      organizationId: z.string().min(1),
      slug: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    await requireRolesOwner(input.organizationId);

    const meta = listOrgRolePresetMetas().find((m) => m.slug === input.slug);
    if (!meta) {
      throw new Error("Réinitialisation réservée aux presets système.");
    }
    if (meta.locked) {
      throw new Error("Le rôle propriétaire ne peut pas être réinitialisé.");
    }

    const permission = getOrgRolePresetPermissionJson(meta.slug);
    const existing = await prisma.organizationRole.findUnique({
      where: {
        organizationId_role: {
          organizationId: input.organizationId,
          role: meta.slug,
        },
      },
    });

    if (existing) {
      await prisma.organizationRole.update({
        where: { id: existing.id },
        data: {
          permission,
          label: meta.label,
          description: meta.description,
          isSystem: true,
          sortOrder: meta.sortOrder,
        },
      });
    } else {
      await prisma.organizationRole.create({
        data: {
          id: randomUUID(),
          organizationId: input.organizationId,
          role: meta.slug,
          permission,
          label: meta.label,
          description: meta.description,
          isSystem: true,
          sortOrder: meta.sortOrder,
        },
      });
    }

    revalidatePath(rolesPath(input.organizationId));
    return { ok: true as const };
  });

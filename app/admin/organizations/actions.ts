"use server";

import { revalidatePath } from "next/cache";
import {
  canAccessOrganizationOwnerSectionsForOrg,
  canAccessOrganizationPartenairesForOrg,
  canArchiveSpecificOrganization,
  canDeleteSpecificOrganization,
  canListAllOrganizations,
  getOrganizationByIdForUser,
} from "@/lib/auth/organization-access";
import { getOrganizationAccessRoleLabel } from "@/lib/auth/role-labels";
import {
  getOrganizationAuthContext,
  guardOrganizationArchive,
  guardOrganizationDelete,
} from "@/lib/auth/require-organization-permission";
import { buildIsArchivedUpdate } from "@/lib/archive";
import { isAppAdminRole, isPlatformOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Action impossible.";
}

export async function deleteOrganizationAction(organizationId: string) {
  const guard = await guardOrganizationDelete(organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  try {
    await prisma.session.updateMany({
      where: { activeOrganizationId: organizationId },
      data: {
        activeOrganizationId: null,
        activeBranchId: null,
      },
    });

    await prisma.organization.delete({
      where: { id: organizationId },
    });

    revalidatePath("/admin/organizations");
    revalidatePath(`/admin/organizations/${organizationId}`);

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: errMessage(error) };
  }
}

export async function archiveOrganizationAction(organizationId: string) {
  const guard = await guardOrganizationArchive(organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, isArchived: true },
    });

    if (!organization) {
      return { ok: false as const, message: "Organisation introuvable." };
    }

    if (organization.isArchived) {
      return { ok: false as const, message: "Organisation deja archivee." };
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: buildIsArchivedUpdate(guard.context.userId),
    });

    revalidatePath("/admin/organizations");
    revalidatePath(`/admin/organizations/${organizationId}`);

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: errMessage(error) };
  }
}

export async function restoreOrganizationAction(organizationId: string) {
  const guard = await guardOrganizationArchive(organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, isArchived: true },
    });

    if (!organization) {
      return { ok: false as const, message: "Organisation introuvable." };
    }

    if (!organization.isArchived) {
      return { ok: false as const, message: "Organisation deja active." };
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedById: null,
      },
    });

    revalidatePath("/admin/organizations");
    revalidatePath(`/admin/organizations/${organizationId}`);

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: errMessage(error) };
  }
}

export async function getOrganizationAccessAction(organizationId: string) {
  const context = await getOrganizationAuthContext();
  if (!context) {
    return null;
  }

  const organization = await getOrganizationByIdForUser(
    context.userId,
    context.appRole,
    organizationId,
  );

  if (!organization) {
    return null;
  }

  const membership =
    context.membership?.organizationId === organizationId
      ? context.membership
      : await prisma.member.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId: context.userId,
            },
          },
          select: {
            organizationId: true,
            role: true,
          },
        });

  return {
    organization,
    canDelete: canDeleteSpecificOrganization(
      context.appRole,
      organizationId,
      membership,
    ),
    canArchive: canArchiveSpecificOrganization(
      context.appRole,
      organizationId,
      membership,
    ),
    canAccessOwnerSections: canAccessOrganizationOwnerSectionsForOrg(
      context.appRole,
      organizationId,
      membership,
    ),
    canAccessPartenaires: canAccessOrganizationPartenairesForOrg(
      context.appRole,
      organizationId,
      membership,
    ),
    canUpdate: isPlatformOwnerRole(context.appRole) || isAppAdminRole(context.appRole),
    /** Retour vers la liste complète : owner plateforme uniquement. */
    canListAll: canListAllOrganizations(context.appRole),
    roleLabel: getOrganizationAccessRoleLabel(
      context.appRole,
      membership?.role,
    ),
    appRole: context.appRole,
    membershipRole: membership?.role ?? null,
  };
}

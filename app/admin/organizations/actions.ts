"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  canDeleteSpecificOrganization,
  getOrganizationByIdForUser,
} from "@/lib/auth/organization-access";
import { getOrganizationAccessRoleLabel } from "@/lib/auth/role-labels";
import {
  getOrganizationAuthContext,
  guardOrganizationDelete,
} from "@/lib/auth/require-organization-permission";
import { isAppAdminRole, isPlatformOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Suppression impossible.";
}

export async function deleteOrganizationAction(organizationId: string) {
  const guard = await guardOrganizationDelete(organizationId);
  if (!guard.ok) {
    return { ok: false as const, message: guard.message };
  }

  const context = guard.context;

  try {
    if (isPlatformOwnerRole(context.appRole)) {
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
    } else {
      await auth.api.deleteOrganization({
        body: { organizationId },
        headers: await headers(),
      });
    }

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
    canUpdate: isPlatformOwnerRole(context.appRole) || isAppAdminRole(context.appRole),
    roleLabel: getOrganizationAccessRoleLabel(
      context.appRole,
      membership?.role,
    ),
    appRole: context.appRole,
    membershipRole: membership?.role ?? null,
  };
}

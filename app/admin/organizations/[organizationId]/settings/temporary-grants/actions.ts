"use server";

import { revalidatePath } from "next/cache";
import { guardOrganizationManager } from "@/lib/auth/require-organization-permission";
import {
  grantTemporaryPrivilege,
  revokeTemporaryPrivilege,
  expireOutdatedGrants,
} from "@/lib/auth/temporary-privilege";
import { prisma } from "@/lib/prisma";

export async function grantTemporaryPrivilegeAction(
  organizationId: string,
  payload: {
    targetUserId: string;
    branchId?: string | null;
    resource: string;
    action?: string;
    temporaryRole?: string | null;
    durationMinutes: number;
    reason: string;
  },
) {
  const guard = await guardOrganizationManager(organizationId);

  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  if (!payload.targetUserId || !payload.resource || !payload.reason || !payload.durationMinutes) {
    return { ok: false, message: "Informations incomplètes (utilisateur, ressource, motif et durée requis)." };
  }

  if (payload.durationMinutes <= 0 || payload.durationMinutes > 10080) { // Max 7 jours (10080 min)
    return { ok: false, message: "La durée doit être comprise entre 1 minute et 7 jours (10080 minutes)." };
  }

  const action = payload.action?.trim() || "read";
  if (action === "*") {
    return {
      ok: false,
      message: "L'action « toutes les actions » n'est pas autorisée. Choisissez une action précise (ex: read, encaisser).",
    };
  }

  if (payload.resource === "*") {
    return {
      ok: false,
      message: "L'octroi global « toutes les ressources » n'est pas autorisé. Choisissez une ressource précise.",
    };
  }

  if (payload.temporaryRole) {
    return {
      ok: false,
      message: "Les rôles temporaires complets ne sont pas encore pris en charge.",
    };
  }

  const targetMember = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId: payload.targetUserId } },
    select: { isArchived: true },
  });
  if (!targetMember || targetMember.isArchived) {
    return { ok: false, message: "L'utilisateur doit etre un membre actif de cette organisation." };
  }

  if (payload.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: payload.branchId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      return { ok: false, message: "L'etablissement selectionne est introuvable." };
    }
  }

  try {
    const grant = await grantTemporaryPrivilege({
      userId: payload.targetUserId,
      organizationId,
      branchId: payload.branchId ?? null,
      resource: payload.resource,
      action,
      temporaryRole: payload.temporaryRole ?? null,
      durationMinutes: payload.durationMinutes,
      reason: payload.reason,
      grantedById: guard.context.userId,
    });

    revalidatePath(`/admin/organizations/${organizationId}/settings/temporary-grants`);
    revalidatePath("/admin", "layout");

    return {
      ok: true,
      message: "Privilège temporaire accordé avec succès.",
      grantId: grant.id,
    };
  } catch (error) {
    console.error("Erreur lors de l'octroi du privilège temporaire:", error);
    return { ok: false, message: "Une erreur est survenue lors de l'octroi du privilège." };
  }
}

export async function revokeTemporaryPrivilegeAction(
  organizationId: string,
  grantId: string,
  reason?: string,
) {
  const guard = await guardOrganizationManager(organizationId);

  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  try {
    await revokeTemporaryPrivilege(grantId, guard.context.userId, organizationId, reason);

    revalidatePath(`/admin/organizations/${organizationId}/settings/temporary-grants`);
    revalidatePath("/admin", "layout");

    return { ok: true, message: "Privilège temporaire révoqué immédiatement." };
  } catch (error) {
    console.error("Erreur lors de la révocation du privilège:", error);
    return { ok: false, message: "Impossible de révoquer ce privilège." };
  }
}

export async function getOrganizationTemporaryGrantsAction(organizationId: string) {
  const guard = await guardOrganizationManager(organizationId);

  if (!guard.ok) {
    return { ok: false, message: guard.message, grants: [] };
  }

  try {
    // Purger d'abord les privilèges dépassés
    await expireOutdatedGrants();

    const grants = await prisma.temporaryGrant.findMany({
      where: {
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
        grantedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        revokedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { ok: true, grants };
  } catch (error) {
    console.error("Erreur lors de la récupération des privilèges:", error);
    return { ok: false, message: "Erreur lors du chargement des privilèges.", grants: [] };
  }
}

export async function listTemporaryGrantMembersAction(
  organizationId: string,
  query?: string,
) {
  const guard = await guardOrganizationManager(organizationId);
  if (!guard.ok) return { ok: false, message: guard.message, members: [] };

  const trimmedQuery = query?.trim();
  const members = await prisma.member.findMany({
    where: {
      organizationId,
      isArchived: false,
      ...(trimmedQuery
        ? {
            OR: [
              { user: { name: { contains: trimmedQuery, mode: "insensitive" } } },
              { user: { email: { contains: trimmedQuery, mode: "insensitive" } } },
              { role: { contains: trimmedQuery, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
    take: trimmedQuery ? 50 : 200,
  });
  return {
    ok: true,
    members: members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    })),
  };
}

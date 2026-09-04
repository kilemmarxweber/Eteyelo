"use server";

import { revalidatePath } from "next/cache";
import { guardOrganizationManager } from "@/lib/auth/require-organization-permission";
import {
  grantTemporaryPrivilege,
  revokeTemporaryPrivilege,
  expireOutdatedGrants,
  findActiveGrantPairs,
  DuplicateActiveTemporaryGrantError,
} from "@/lib/auth/temporary-privilege";
import { prisma } from "@/lib/prisma";
import {
  formatGrantPair,
  normalizeSelectedGrantActions,
  splitGrantPairsByActiveDuplicates,
  writeActionIncludesRead,
} from "@/lib/auth/temporary-grant-actions";
import {
  buildTemporaryGrantPairs,
  isAllowedGrantAction,
  isCatalogGrantResource,
  resolveTemporaryGrantResources,
} from "@/lib/auth/temporary-grant-catalog";

export async function grantTemporaryPrivilegeAction(
  organizationId: string,
  payload: {
    targetUserId: string;
    branchId?: string | null;
    resource?: string;
    groupId?: string;
    itemValue?: string;
    itemValues?: string[];
    action?: string;
    actions?: string[];
    temporaryRole?: string | null;
    durationMinutes: number;
    reason: string;
  },
) {
  const guard = await guardOrganizationManager(organizationId);

  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  if (!payload.targetUserId || !payload.reason || !payload.durationMinutes) {
    return { ok: false, message: "Informations incomplètes (utilisateur, motif et durée requis)." };
  }

  if (payload.durationMinutes <= 0 || payload.durationMinutes > 10080) { // Max 7 jours (10080 min)
    return { ok: false, message: "La durée doit être comprise entre 1 minute et 7 jours (10080 minutes)." };
  }

  const rawActions = payload.actions?.length
    ? payload.actions
    : [payload.action?.trim() || "read"];
  if (rawActions.some((action) => action === "*")) {
    return {
      ok: false,
      message: "L'action « toutes les actions » n'est pas autorisée. Choisissez une action précise (ex: read, encaisser).",
    };
  }
  if (rawActions.some((action) => !isAllowedGrantAction(action))) {
    return {
      ok: false,
      message: "Choisissez au moins une action autorisée (lecture, création, modification, suppression ou encaissement).",
    };
  }

  const actions = normalizeSelectedGrantActions(rawActions);

  const resources = payload.groupId
    ? resolveTemporaryGrantResources(
        payload.groupId,
        payload.itemValues?.length
          ? payload.itemValues
          : (payload.itemValue ?? ""),
      )
    : payload.resource
      ? [payload.resource]
      : [];

  if (!resources.length || resources.some((resource) => !isCatalogGrantResource(resource))) {
    return {
      ok: false,
      message: "Choisissez au moins un sous-menu (ex: Finance → Frais et Paiement).",
    };
  }

  const pairs = buildTemporaryGrantPairs(resources, actions);
  if (pairs.length === 0) {
    return {
      ok: false,
      message: "Cette combinaison n'est pas applicable. L'encaissement s'applique uniquement au paiement / caisse.",
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
    await expireOutdatedGrants();
    const active = await findActiveGrantPairs({
      userId: payload.targetUserId,
      organizationId,
    });
    const { next, duplicates } = splitGrantPairsByActiveDuplicates(
      pairs,
      active,
      payload.branchId ?? null,
    );

    if (!next.length) {
      const labels = duplicates.map(formatGrantPair).join(", ");
      return {
        ok: false,
        message:
          duplicates.length === 1
            ? `Ce droit est déjà actif pour cet utilisateur (${labels}). Révoquez-le ou attendez la fin de validité.`
            : `Ces droits sont déjà actifs pour cet utilisateur (${labels}). Révoquez-les ou attendez la fin de validité.`,
      };
    }

    const grants: Awaited<ReturnType<typeof grantTemporaryPrivilege>>[] = [];
    for (const pair of next) {
      grants.push(
        await grantTemporaryPrivilege({
          userId: payload.targetUserId,
          organizationId,
          branchId: payload.branchId ?? null,
          resource: pair.resource,
          action: pair.action,
          temporaryRole: payload.temporaryRole ?? null,
          durationMinutes: payload.durationMinutes,
          reason: payload.reason,
          grantedById: guard.context.userId,
        }),
      );
    }

    revalidatePath(`/admin/organizations/${organizationId}/settings/temporary-grants`);
    revalidatePath("/admin", "layout");

    const includesRead = next.some((pair) => writeActionIncludesRead(pair.action));
    const count = grants.length;
    const skipped = duplicates.length
      ? ` Déjà actifs (ignorés) : ${duplicates.map(formatGrantPair).join(", ")}.`
      : "";

    return {
      ok: true,
      message:
        (count > 1
          ? `${count} privilèges accordés${includesRead ? " (lecture incluse)" : ""}.`
          : includesRead
            ? "Privilège temporaire accordé (lecture incluse)."
            : "Privilège temporaire accordé avec succès.") + skipped,
      grantId: grants[0]?.id,
    };
  } catch (error) {
    if (error instanceof DuplicateActiveTemporaryGrantError) {
      return {
        ok: false,
        message: `Ce droit est déjà actif pour cet utilisateur (${error.resource}:${error.action}). Révoquez-le ou attendez la fin de validité.`,
      };
    }
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

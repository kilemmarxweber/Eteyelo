import { prisma } from "@/lib/prisma";
import {
  BRANCH_AREA_PERMISSION,
  type BranchArea,
} from "@/lib/auth/branch-area-permissions";
import type { OrganizationPermissionPayload } from "@/lib/auth/has-organization-permission";
import type { TemporaryGrant } from "@/prisma/generated/prisma/client";

export type GrantTemporaryPrivilegeInput = {
  userId: string;
  organizationId?: string | null;
  branchId?: string | null;
  resource: string;
  action: string;
  temporaryRole?: string | null;
  durationMinutes: number;
  reason: string;
  grantedById: string;
};

export type TemporaryGrantCheckResult =
  | { ok: true; grant: TemporaryGrant }
  | { ok: false };

const ACTIVE_GRANT_WHERE = (now: Date) => ({
  status: "ACTIVE" as const,
  startsAt: { lte: now },
  expiresAt: { gt: now },
});

function branchScopeFilter(branchId?: string | null) {
  if (branchId) {
    return {
      OR: [{ branchId: null }, { branchId }],
    };
  }
  return { branchId: null };
}

/**
 * Charge les octrois actifs (non expirés, non révoqués) pour un utilisateur.
 * Un octroi sans branchId s'applique à toute l'organisation ; avec branchId, uniquement à cette branche.
 */
export async function loadActiveTemporaryGrants(
  userId: string,
  organizationId: string,
  branchId?: string | null,
): Promise<TemporaryGrant[]> {
  const now = new Date();

  return prisma.temporaryGrant.findMany({
    where: {
      userId,
      organizationId,
      ...ACTIVE_GRANT_WHERE(now),
      ...branchScopeFilter(branchId),
    },
    orderBy: { expiresAt: "asc" },
  });
}

/** Correspondance stricte ressource/action ; `*` n'est accepté que s'il est explicitement octroyé. */
export function grantMatchesPermission(
  grant: Pick<TemporaryGrant, "resource" | "action">,
  resource: string,
  action: string,
): boolean {
  const matchResource =
    grant.resource === "*" ||
    grant.resource.toLowerCase() === resource.toLowerCase();
  if (!matchResource) return false;

  if (grant.action === "*") return true;
  return grant.action.toLowerCase() === action.toLowerCase();
}

/** Vérifie qu'une liste d'octrois couvre toutes les permissions demandées (niveau organisation). */
export function grantsCoverPermissions(
  grants: TemporaryGrant[],
  permissions: OrganizationPermissionPayload,
): boolean {
  for (const [resource, actions] of Object.entries(permissions)) {
    for (const action of actions) {
      const covered = grants.some((grant) =>
        grantMatchesPermission(grant, resource, action),
      );
      if (!covered) return false;
    }
  }
  return true;
}

/** Vérifie qu'un octroi couvre l'entrée dans une zone branche (même règles que le DAC). */
export function grantsCoverBranchArea(
  grants: TemporaryGrant[],
  area: BranchArea,
): boolean {
  const required = BRANCH_AREA_PERMISSION[area];
  if (!required) return false;

  for (const [resource, actions] of Object.entries(required)) {
    if (resource === "finance" && area === "finance") {
      const ok = actions.some((action) =>
        grants.some((grant) => grantMatchesPermission(grant, resource, action)),
      );
      if (!ok) return false;
      continue;
    }

    const ok = actions.every((action) =>
      grants.some((grant) => grantMatchesPermission(grant, resource, action)),
    );
    if (!ok) return false;
  }

  return true;
}

/**
 * Vérifie si l'utilisateur possède un privilège temporaire actif et valide
 * pour la ressource et l'action demandées.
 */
export async function checkTemporaryGrantPermission(
  userId: string,
  organizationId: string | null | undefined,
  resource: string,
  action: string,
  branchId?: string | null,
): Promise<TemporaryGrantCheckResult> {
  if (!organizationId) {
    return { ok: false };
  }

  const grants = await loadActiveTemporaryGrants(
    userId,
    organizationId,
    branchId,
  );

  const matchedGrant = grants.find((grant) =>
    grantMatchesPermission(grant, resource, action),
  );

  if (matchedGrant) {
    return { ok: true, grant: matchedGrant };
  }

  return { ok: false };
}

/** Fallback octroi temporaire pour l'accès à une zone branche. */
export async function canAccessBranchAreaViaTemporaryGrants(
  userId: string,
  organizationId: string,
  area: BranchArea,
  branchId?: string | null,
): Promise<boolean> {
  const grants = await loadActiveTemporaryGrants(
    userId,
    organizationId,
    branchId,
  );
  return grantsCoverBranchArea(grants, area);
}

/**
 * Récupère les privilèges temporaires actifs d'un utilisateur.
 */
export async function getUserActiveTemporaryGrants(
  userId: string,
  organizationId?: string | null,
  branchId?: string | null,
) {
  if (!organizationId) {
    return [];
  }

  return prisma.temporaryGrant.findMany({
    where: {
      userId,
      organizationId,
      ...ACTIVE_GRANT_WHERE(new Date()),
      ...branchScopeFilter(branchId),
    },
    include: {
      grantedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      expiresAt: "asc",
    },
  });
}

/**
 * Octroie un privilège temporaire à un utilisateur.
 */
export async function grantTemporaryPrivilege(input: GrantTemporaryPrivilegeInput) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.durationMinutes * 60 * 1000);

  return prisma.temporaryGrant.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      branchId: input.branchId ?? null,
      resource: input.resource,
      action: input.action,
      temporaryRole: input.temporaryRole ?? null,
      reason: input.reason,
      grantedById: input.grantedById,
      startsAt: now,
      expiresAt,
      status: "ACTIVE",
    },
  });
}

/**
 * Révoque immédiatement un privilège temporaire actif.
 */
export async function revokeTemporaryPrivilege(
  grantId: string,
  revokedById: string,
  organizationId: string,
  reason?: string,
) {
  const result = await prisma.temporaryGrant.updateMany({
    where: { id: grantId, organizationId, status: "ACTIVE" },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokedById,
      revocationReason: reason ?? "Révocation manuelle par l'administrateur",
    },
  });

  if (result.count !== 1) {
    throw new Error("Temporary grant not found or already inactive.");
  }
}

/**
 * Marque comme EXPIRED tous les privilèges actifs dépassés.
 */
export async function expireOutdatedGrants() {
  const now = new Date();
  return prisma.temporaryGrant.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
    },
  });
}

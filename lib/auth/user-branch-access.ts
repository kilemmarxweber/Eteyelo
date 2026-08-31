import { prisma } from "@/lib/prisma";
import { ORG_ROLE } from "@/lib/permissions";
import { TypeBrache } from "@/prisma/generated/prisma/enums";

/** Rôles Member (org) qui doivent toujours aller vers leur branche. */
export const BRANCH_LOGIN_ORG_ROLES = new Set<string>([
  ORG_ROLE.TEACHER,
  ORG_ROLE.PARENT,
  ORG_ROLE.STUDENT,
  ORG_ROLE.CAISSIER,
]);

/**
 * Leadership école / études : atterrissent sur la branche de leur BranchMember
 * (DIRECTOR / ADMIN), sans fallback vers la 1ʳᵉ branche de l’org.
 */
export const SCHOOL_LEADERSHIP_LOGIN_ORG_ROLES = new Set<string>([
  ORG_ROLE.DIRECTEUR,
  ORG_ROLE.PREFET,
  ORG_ROLE.DIRECTEUR_ETUDES,
]);

/** Gestionnaire : entre dans les établissements BranchMember qu’il gère (sans fallback 1ʳᵉ branche org). */
export const GESTIONNAIRE_LOGIN_ORG_ROLES = new Set<string>([
  ORG_ROLE.GESTIONNAIRE,
  ORG_ROLE.AGENT_BUREAU,
]);

export type UserBranchMembership = {
  branchId: string;
  branchName: string;
  typebranch: TypeBrache;
  cycles?: Array<{ cycle: string; isActive?: boolean; sortOrder?: number }>;
};

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

/** Gestionnaire (pas propriétaire) : landing sur les branches gérées. */
export function isGestionnaireBranchLandingRole(
  membershipRole?: string | null,
) {
  const roles = splitRoles(membershipRole);
  return (
    roles.some((role) => GESTIONNAIRE_LOGIN_ORG_ROLES.has(role)) &&
    !roles.includes(ORG_ROLE.OWNER)
  );
}

export function buildGestionnaireLandingPath(
  organizationId: string,
  branchId?: string | null,
) {
  const base = `/admin/organizations/${organizationId}/branches`;
  return branchId ? `${base}/${branchId}` : base;
}

function mapBranchMemberships(
  memberships: Array<{
    branchId: string;
    memberCycles?: Array<{ cycle: string }>;
    branch: {
      name: string;
      typebranch: TypeBrache;
      cycles?: Array<{ cycle: string; isActive?: boolean; sortOrder?: number }>;
    };
  }>,
): UserBranchMembership[] {
  return memberships.map((membership) => {
    const assigned = membership.memberCycles ?? [];
    return {
      branchId: membership.branchId,
      branchName: membership.branch.name,
      typebranch: membership.branch.typebranch,
      // Afficher uniquement le(s) cycle(s) d'affectation (SEC / PRIM / …).
      cycles:
        assigned.length > 0
          ? assigned.map((row) => ({
              cycle: row.cycle,
              isActive: true,
              sortOrder: 0,
            }))
          : membership.branch.cycles,
    };
  });
}

/** Toutes les branches actives rattachées à l'utilisateur. */
export async function getUserBranchMemberships(
  userId: string,
  organizationId: string,
): Promise<UserBranchMembership[]> {
  const memberships = await prisma.branchMember.findMany({
    where: {
      isActive: true,
      member: {
        userId,
        organizationId,
      },
      branch: {
        organizationId,
        isActive: true,
      },
    },
    select: {
      branchId: true,
      memberCycles: { select: { cycle: true } },
      branch: {
        select: {
          name: true,
          typebranch: true,
          cycles: {
            where: { isActive: true },
            select: { cycle: true, isActive: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return mapBranchMemberships(memberships);
}

/** Toute branche active de l'utilisateur dans l'organisation (tous rôles BranchMember). */
export async function getAnyUserBranchMemberships(
  userId: string,
  organizationId: string,
): Promise<UserBranchMembership[]> {
  const memberships = await prisma.branchMember.findMany({
    where: {
      isActive: true,
      member: {
        userId,
        organizationId,
      },
      branch: {
        organizationId,
        isActive: true,
      },
    },
    select: {
      branchId: true,
      memberCycles: { select: { cycle: true } },
      branch: {
        select: {
          name: true,
          typebranch: true,
          cycles: {
            where: { isActive: true },
            select: { cycle: true, isActive: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return mapBranchMemberships(memberships);
}

/**
 * Pour login : caissier / enseignant / parent / élève / leadership école.
 * Prefère les rôles BranchUser, sinon n'importe quel BranchMember.
 * Fallback 1ʳᵉ branche org : uniquement pour BRANCH_LOGIN (évite le 404 org).
 */
export async function getUserBranchMembershipsForLogin(
  userId: string,
  organizationId: string,
  membershipRole?: string | null,
): Promise<UserBranchMembership[]> {
  const scoped = await getUserBranchMemberships(userId, organizationId);
  if (scoped.length > 0) {
    return scoped;
  }

  const roles = splitRoles(membershipRole);
  const isBranchLoginRole = roles.some((role) =>
    BRANCH_LOGIN_ORG_ROLES.has(role),
  );
  const isSchoolLeadershipRole = roles.some((role) =>
    SCHOOL_LEADERSHIP_LOGIN_ORG_ROLES.has(role),
  );
  const isGestionnaireRole = roles.some((role) =>
    GESTIONNAIRE_LOGIN_ORG_ROLES.has(role),
  );

  if (!isBranchLoginRole && !isSchoolLeadershipRole && !isGestionnaireRole) {
    return [];
  }

  const anyMembership = await getAnyUserBranchMemberships(
    userId,
    organizationId,
  );
  if (anyMembership.length > 0) {
    return anyMembership;
  }

  // Leadership : uniquement la branche d’affectation BranchMember — pas de fallback org.
  if (!isBranchLoginRole) {
    return [];
  }

  const fallbackBranch = await prisma.branch.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      typebranch: true,
      cycles: {
        where: { isActive: true },
        select: { cycle: true, isActive: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!fallbackBranch) {
    return [];
  }

  return [
    {
      branchId: fallbackBranch.id,
      branchName: fallbackBranch.name,
      typebranch: fallbackBranch.typebranch,
      cycles: fallbackBranch.cycles,
    },
  ];
}

export async function resolveActiveBranchId(
  userId: string,
  organizationId: string,
  preferredBranchId?: string | null,
  membershipRole?: string | null,
): Promise<string | null> {
  const memberships = await getUserBranchMembershipsForLogin(
    userId,
    organizationId,
    membershipRole,
  );
  if (memberships.length === 0) {
    return null;
  }

  if (
    preferredBranchId &&
    memberships.some((membership) => membership.branchId === preferredBranchId)
  ) {
    return preferredBranchId;
  }

  if (memberships.length === 1) {
    return memberships[0].branchId;
  }

  return null;
}

export function buildBranchPickerPath(organizationId: string) {
  return `/admin/organizations/${organizationId}/branch-picker`;
}

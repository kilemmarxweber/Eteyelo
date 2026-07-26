import { prisma } from "@/lib/prisma";
import { ORG_ROLE } from "@/lib/permissions";
import { BranchRole, TypeBrache } from "@/prisma/generated/prisma/enums";

/** Rôles BranchMember qui doivent atterrir sur une branche. */
const BRANCH_USER_ROLES = [
  BranchRole.TEACHER,
  BranchRole.PARENT,
  BranchRole.STUDENT,
  BranchRole.CAISSIER,
] as const;

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

export type UserBranchMembership = {
  branchId: string;
  branchName: string;
  typebranch: TypeBrache;
};

function splitRoles(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function mapBranchMemberships(
  memberships: Array<{
    branchId: string;
    branch: { name: string; typebranch: TypeBrache };
  }>,
): UserBranchMembership[] {
  return memberships.map((membership) => ({
    branchId: membership.branchId,
    branchName: membership.branch.name,
    typebranch: membership.branch.typebranch,
  }));
}

/** Branches liées via BranchRole enseignant / parent / élève / caissier. */
export async function getUserBranchMemberships(
  userId: string,
  organizationId: string,
): Promise<UserBranchMembership[]> {
  const memberships = await prisma.branchMember.findMany({
    where: {
      role: { in: [...BRANCH_USER_ROLES] },
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
      branch: {
        select: {
          name: true,
          typebranch: true,
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
      branch: {
        select: {
          name: true,
          typebranch: true,
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

  if (!isBranchLoginRole && !isSchoolLeadershipRole) {
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
    select: { id: true, name: true, typebranch: true },
  });

  if (!fallbackBranch) {
    return [];
  }

  return [
    {
      branchId: fallbackBranch.id,
      branchName: fallbackBranch.name,
      typebranch: fallbackBranch.typebranch,
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

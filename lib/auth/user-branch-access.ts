import { prisma } from "@/lib/prisma";
import { BranchRole } from "@/prisma/generated/prisma/enums";

const BRANCH_USER_ROLES = [
  BranchRole.TEACHER,
  BranchRole.PARENT,
  BranchRole.STUDENT,
] as const;

export type UserBranchMembership = {
  branchId: string;
  branchName: string;
};

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
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships.map((membership) => ({
    branchId: membership.branchId,
    branchName: membership.branch.name,
  }));
}

export async function resolveActiveBranchId(
  userId: string,
  organizationId: string,
  preferredBranchId?: string | null,
): Promise<string | null> {
  const memberships = await getUserBranchMemberships(userId, organizationId);
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

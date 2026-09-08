import { prisma } from "@/lib/prisma";
import { BranchRole } from "@/prisma/generated/prisma/enums";
import {
  ensureActivePersonnelProfile,
  ensureBranchMemberRoleProfiles,
} from "@/lib/auth/ensure-branch-member-profile";
import {
  isOrganizationOwnerMember,
  memberShouldAppearAsPersonnelInAllBranches,
} from "@/lib/auth/role-labels";
import { isAppAdminRole } from "@/lib/permissions";

type QualifyingMember = {
  id: string;
  role: string | null;
  user: { role: string | null } | null;
};

function isQualifyingOwner(member: QualifyingMember): boolean {
  return memberShouldAppearAsPersonnelInAllBranches(
    member.role,
    member.user?.role,
  );
}

async function listOrganizationMembers(
  organizationId: string,
  memberId?: string,
): Promise<QualifyingMember[]> {
  return prisma.member.findMany({
    where: {
      organizationId,
      ...(memberId ? { id: memberId } : {}),
    },
    select: {
      id: true,
      role: true,
      user: { select: { role: true } },
    },
  });
}

async function listQualifyingOwners(
  organizationId: string,
  memberId?: string,
): Promise<QualifyingMember[]> {
  const members = await listOrganizationMembers(organizationId, memberId);
  return members.filter(isQualifyingOwner);
}

/** Retire du personnel les propriétaires sans `user.role = admin`. */
async function hidePersonnelForNonAdminOwners(
  organizationId: string,
  memberId?: string,
): Promise<void> {
  const members = await listOrganizationMembers(organizationId, memberId);
  const toHide = members.filter(
    (member) =>
      isOrganizationOwnerMember(member.role) &&
      !isAppAdminRole(member.user?.role),
  );
  if (toHide.length === 0) return;

  const branchMembers = await prisma.branchMember.findMany({
    where: {
      memberId: { in: toHide.map((member) => member.id) },
      branch: { organizationId },
    },
    select: { id: true },
  });
  if (branchMembers.length === 0) return;

  await prisma.personnel.updateMany({
    where: {
      isActive: true,
      branchMemberId: { in: branchMembers.map((row) => row.id) },
    },
    data: { isActive: false, deactivatedAt: new Date() },
  });
}

async function ensureMemberPersonnelOnBranches(params: {
  memberId: string;
  organizationId: string;
  branchIds: string[];
}): Promise<void> {
  const { memberId, organizationId, branchIds } = params;
  if (branchIds.length === 0) return;

  const existing = await prisma.branchMember.findMany({
    where: {
      memberId,
      branchId: { in: branchIds },
    },
    select: { id: true, branchId: true, isActive: true },
  });
  const existingByBranch = new Map(
    existing.map((row) => [row.branchId, row] as const),
  );

  const missingBranchIds = branchIds.filter(
    (branchId) => !existingByBranch.has(branchId),
  );
  if (missingBranchIds.length > 0) {
    await prisma.branchMember.createMany({
      data: missingBranchIds.map((branchId) => ({
        memberId,
        branchId,
        role: BranchRole.ADMIN,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }

  const inactiveIds = existing
    .filter((row) => !row.isActive)
    .map((row) => row.id);
  if (inactiveIds.length > 0) {
    await prisma.branchMember.updateMany({
      where: { id: { in: inactiveIds } },
      data: { isActive: true, deactivatedAt: null },
    });
  }

  await ensureBranchMemberRoleProfiles({
    memberId,
    organizationId,
  });

  const branchMembers = await prisma.branchMember.findMany({
    where: {
      memberId,
      branchId: { in: branchIds },
    },
    select: { id: true },
  });
  for (const row of branchMembers) {
    await ensureActivePersonnelProfile(row.id);
  }
}

/** Propriétaire (+ Admin) : fiche personnel dans toutes les branches actives. */
export async function ensureOwnerPersonnelInAllBranches(params: {
  organizationId: string;
  memberId?: string;
}): Promise<void> {
  await hidePersonnelForNonAdminOwners(
    params.organizationId,
    params.memberId,
  );

  const owners = await listQualifyingOwners(
    params.organizationId,
    params.memberId,
  );
  if (owners.length === 0) return;

  const branches = await prisma.branch.findMany({
    where: { organizationId: params.organizationId, isActive: true },
    select: { id: true },
  });
  const branchIds = branches.map((branch) => branch.id);
  if (branchIds.length === 0) return;

  for (const owner of owners) {
    await ensureMemberPersonnelOnBranches({
      memberId: owner.id,
      organizationId: params.organizationId,
      branchIds,
    });
  }
}

/** Idem pour une branche (création d’établissement ou chargement de l’annuaire). */
export async function ensureOwnerPersonnelInBranch(params: {
  organizationId: string;
  branchId: string;
}): Promise<void> {
  const branch = await prisma.branch.findFirst({
    where: {
      id: params.branchId,
      organizationId: params.organizationId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!branch) return;

  await hidePersonnelForNonAdminOwners(params.organizationId);

  const owners = await listQualifyingOwners(params.organizationId);
  for (const owner of owners) {
    await ensureMemberPersonnelOnBranches({
      memberId: owner.id,
      organizationId: params.organizationId,
      branchIds: [branch.id],
    });
  }
}

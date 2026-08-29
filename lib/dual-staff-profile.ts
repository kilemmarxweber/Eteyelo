import "server-only";

import { splitSessionRoles } from "@/lib/auth/session-roles";
import { ORG_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  appendMemberOrgRoles,
  PERSONNEL_ORG_ROLE_OPTIONS,
  removeMemberOrgRoles,
} from "@/lib/dual-staff-profile-shared";

export {
  appendMemberOrgRoles,
  PERSONNEL_ORG_ROLE_OPTIONS,
  removeMemberOrgRoles,
} from "@/lib/dual-staff-profile-shared";

/**
 * Désactive uniquement le profil enseignant.
 * Si un personnel actif reste sur le même BranchMember → branche reste active.
 */
export async function deactivateTeacherProfile(params: {
  teacherId: string;
  branchMemberId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.teacher.update({
      where: { id: params.teacherId },
      data: { isActive: false, deactivatedAt: new Date() },
    });

    await tx.teaching.updateMany({
      where: {
        teacherId: params.teacherId,
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
      },
      data: { statusTeaching: false },
    });

    const activePersonnel = await tx.personnel.findFirst({
      where: {
        branchMemberId: params.branchMemberId,
        isActive: true,
      },
      select: { id: true },
    });

    if (activePersonnel) {
      const member = await tx.branchMember.findUnique({
        where: { id: params.branchMemberId },
        select: { memberId: true, member: { select: { role: true } } },
      });
      if (member?.memberId) {
        const nextRole = removeMemberOrgRoles(
          member.member?.role,
          ORG_ROLE.TEACHER,
        );
        if (nextRole && nextRole !== (member.member?.role ?? "")) {
          await tx.member.update({
            where: { id: member.memberId },
            data: { role: nextRole },
          });
        }
      }
      return { keptBranchActive: true as const };
    }

    await tx.branchMember.update({
      where: { id: params.branchMemberId },
      data: { isActive: false, deactivatedAt: new Date() },
    });
    return { keptBranchActive: false as const };
  });
}

/**
 * Désactive uniquement le profil personnel.
 * Si un enseignant actif reste → branche reste active.
 */
export async function deactivatePersonnelProfile(params: {
  personnelId: string;
  branchMemberId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.personnel.update({
      where: { id: params.personnelId },
      data: { isActive: false, deactivatedAt: new Date() },
    });

    const activeTeacher = await tx.teacher.findFirst({
      where: {
        branchMemberId: params.branchMemberId,
        isActive: true,
      },
      select: { id: true },
    });

    if (activeTeacher) {
      return { keptBranchActive: true as const };
    }

    await tx.branchMember.update({
      where: { id: params.branchMemberId },
      data: { isActive: false, deactivatedAt: new Date() },
    });
    return { keptBranchActive: false as const };
  });
}

/** Crée ou réactive le profil personnel sur le BranchMember d’un enseignant. */
export async function ensurePersonnelOnTeacherBranchMember(params: {
  branchMemberId: string;
  memberId: string;
  orgRole: string;
}) {
  const orgRole = splitSessionRoles(params.orgRole)[0];
  if (
    !orgRole ||
    !(PERSONNEL_ORG_ROLE_OPTIONS as readonly string[]).includes(orgRole)
  ) {
    throw new Error("Rôle personnel invalide");
  }

  return prisma.$transaction(async (tx) => {
    await tx.branchMember.update({
      where: { id: params.branchMemberId },
      data: { isActive: true, deactivatedAt: null },
    });

    const existing = await tx.personnel.findUnique({
      where: { branchMemberId: params.branchMemberId },
    });

    const personnel = existing
      ? await tx.personnel.update({
          where: { id: existing.id },
          data: { isActive: true, deactivatedAt: null },
        })
      : await tx.personnel.create({
          data: {
            branchMemberId: params.branchMemberId,
            isActive: true,
          },
        });

    const member = await tx.member.findUnique({
      where: { id: params.memberId },
      select: { role: true },
    });
    const nextRole = appendMemberOrgRoles(member?.role, orgRole, ORG_ROLE.TEACHER);
    await tx.member.update({
      where: { id: params.memberId },
      data: { role: nextRole },
    });

    return personnel;
  });
}

/** Crée ou réactive le profil enseignant sur le BranchMember d’un personnel. */
export async function ensureTeacherOnPersonnelBranchMember(params: {
  branchMemberId: string;
  memberId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.branchMember.update({
      where: { id: params.branchMemberId },
      data: { isActive: true, deactivatedAt: null },
    });

    const existing = await tx.teacher.findUnique({
      where: { branchMemberId: params.branchMemberId },
    });

    const teacher = existing
      ? await tx.teacher.update({
          where: { id: existing.id },
          data: { isActive: true, deactivatedAt: null },
        })
      : await tx.teacher.create({
          data: {
            branchMemberId: params.branchMemberId,
            isActive: true,
          },
        });

    const member = await tx.member.findUnique({
      where: { id: params.memberId },
      select: { role: true },
    });
    const nextRole = appendMemberOrgRoles(member?.role, ORG_ROLE.TEACHER);
    await tx.member.update({
      where: { id: params.memberId },
      data: { role: nextRole },
    });

    return teacher;
  });
}

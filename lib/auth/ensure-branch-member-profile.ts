import { prisma } from "@/lib/prisma";
import { BranchRole } from "@/prisma/generated/prisma/enums";

function isPersonnelBranchRole(role: BranchRole): boolean {
  return (
    role === BranchRole.DIRECTOR ||
    role === BranchRole.ADMIN ||
    role === BranchRole.CAISSIER
  );
}

/**
 * Aligne les profils métier sur le BranchRole.
 * Teacher.isActive / Personnel.isActive : soft-désactivation lors d’un
 * changement Enseignant ↔ Personnel (édition membre), sans supprimer l’historique.
 */
export async function ensureBranchMemberRoleProfiles(params: {
  memberId: string;
  organizationId: string;
  /** Ancien BranchRole par branchMemberId (avant syncMemberBranches). */
  previousRolesByBranchMemberId?: Record<string, BranchRole>;
}): Promise<void> {
  const rows = await prisma.branchMember.findMany({
    where: {
      memberId: params.memberId,
      branch: { organizationId: params.organizationId },
    },
    select: {
      id: true,
      branchId: true,
      role: true,
      _count: {
        select: {
          teacher: true,
          student: true,
          parent: true,
          personel: true,
        },
      },
    },
  });

  for (const row of rows) {
    await ensureProfileForBranchMember({
      branchMemberId: row.id,
      branchId: row.branchId,
      organizationId: params.organizationId,
      role: row.role,
      previousRole: params.previousRolesByBranchMemberId?.[row.id],
      counts: row._count,
    });
  }
}

async function ensureActiveTeacherProfile(branchMemberId: string) {
  const existing = await prisma.teacher.findUnique({
    where: { branchMemberId },
    select: { id: true, isActive: true },
  });
  if (!existing) {
    await prisma.teacher.create({
      data: { branchMemberId, isActive: true },
    });
    return;
  }
  if (!existing.isActive) {
    await prisma.teacher.update({
      where: { id: existing.id },
      data: { isActive: true, deactivatedAt: null },
    });
  }
}

async function ensureActivePersonnelProfile(branchMemberId: string) {
  const existing = await prisma.personnel.findUnique({
    where: { branchMemberId },
    select: { id: true, isActive: true },
  });
  if (!existing) {
    await prisma.personnel.create({
      data: { branchMemberId, isActive: true },
    });
    return;
  }
  if (!existing.isActive) {
    await prisma.personnel.update({
      where: { id: existing.id },
      data: { isActive: true, deactivatedAt: null },
    });
  }
}

/** Soft-désactive le(s) profil(s) enseignant sans toucher au BranchMember. */
async function softDeactivateTeachersOnBranchMember(branchMemberId: string) {
  const teachers = await prisma.teacher.findMany({
    where: { branchMemberId, isActive: true },
    select: { id: true },
  });
  if (teachers.length === 0) return;

  const now = new Date();
  for (const teacher of teachers) {
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { isActive: false, deactivatedAt: now },
    });
    await prisma.teaching.updateMany({
      where: {
        teacherId: teacher.id,
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
      },
      data: { statusTeaching: false },
    });
  }
}

/** Soft-désactive le(s) profil(s) personnel sans toucher au BranchMember. */
async function softDeactivatePersonnelOnBranchMember(branchMemberId: string) {
  await prisma.personnel.updateMany({
    where: { branchMemberId, isActive: true },
    data: { isActive: false, deactivatedAt: new Date() },
  });
}

async function ensureProfileForBranchMember(params: {
  branchMemberId: string;
  branchId: string;
  organizationId: string;
  role: BranchRole;
  previousRole?: BranchRole;
  counts: {
    teacher: number;
    student: number;
    parent: number;
    personel: number;
  };
}) {
  const from = params.previousRole;
  const to = params.role;
  const switchedTeacherToPersonnel =
    from === BranchRole.TEACHER && isPersonnelBranchRole(to);
  const switchedPersonnelToTeacher =
    from != null && isPersonnelBranchRole(from) && to === BranchRole.TEACHER;

  switch (to) {
    case BranchRole.TEACHER:
      await ensureActiveTeacherProfile(params.branchMemberId);
      if (switchedPersonnelToTeacher) {
        await softDeactivatePersonnelOnBranchMember(params.branchMemberId);
      }
      return;
    case BranchRole.STUDENT:
      if (params.counts.student === 0) {
        const parentId = await ensureStudentParentId({
          branchId: params.branchId,
          organizationId: params.organizationId,
        });
        await prisma.student.createMany({
          data: [{ branchMemberId: params.branchMemberId, parentId }],
          skipDuplicates: true,
        });
      }
      return;
    case BranchRole.PARENT:
      if (params.counts.parent === 0) {
        await prisma.parent.createMany({
          data: [{ branchMemberId: params.branchMemberId }],
          skipDuplicates: true,
        });
      }
      return;
    case BranchRole.DIRECTOR:
    case BranchRole.ADMIN:
    case BranchRole.CAISSIER:
      // Personnel d’abord pour garder le BranchMember actif après soft-désactivation enseignant.
      await ensureActivePersonnelProfile(params.branchMemberId);
      if (switchedTeacherToPersonnel) {
        await softDeactivateTeachersOnBranchMember(params.branchMemberId);
      }
      return;
    default:
      return;
  }
}

async function ensureStudentParentId(params: {
  branchId: string;
  organizationId: string;
}): Promise<string> {
  const existing = await prisma.parent.findFirst({
    where: {
      branchMember: {
        branchId: params.branchId,
        member: { organizationId: params.organizationId },
      },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const { isCentreFormationBranch } = await import(
    "@/lib/branch-capabilities"
  );
  const branch = await prisma.branch.findUnique({
    where: { id: params.branchId },
    select: { typebranch: true, name: true },
  });

  if (isCentreFormationBranch(branch?.typebranch)) {
    const { ensureCentreDefaultParent } = await import(
      "@/lib/centre-default-parent"
    );
    return ensureCentreDefaultParent({
      branchId: params.branchId,
      organizationId: params.organizationId,
      branchName: branch?.name,
    });
  }

  const email = `parent-systeme+${params.branchId}@eteyelo.local`.toLowerCase();
  const { createOrganizationMemberAction } = await import(
    "@/app/admin/organizations/[organizationId]/members/actions"
  );
  const created = await createOrganizationMemberAction({
    organizationId: params.organizationId,
    branchId: params.branchId,
    email,
    name: "Parent",
    postnom: "Système",
    prenom: "Établissement",
    orgRole: "parent",
  });
  const memberId = created.ok
    ? created.memberId
    : (
        await prisma.member.findFirst({
          where: {
            organizationId: params.organizationId,
            user: { email },
          },
          select: { id: true },
        })
      )?.id;
  if (!memberId) {
    throw new Error(
      created.ok ? "Parent système introuvable." : created.message,
    );
  }

  const branchMember =
    (await prisma.branchMember.findFirst({
      where: {
        branchId: params.branchId,
        memberId,
      },
      select: { id: true, parent: { select: { id: true } } },
    })) ??
    (await prisma.branchMember.create({
      data: {
        branchId: params.branchId,
        memberId,
        role: BranchRole.PARENT,
      },
      select: { id: true, parent: { select: { id: true } } },
    }));

  const existingParentId = branchMember.parent[0]?.id;
  if (existingParentId) return existingParentId;

  const parent = await prisma.parent.create({
    data: { branchMemberId: branchMember.id },
    select: { id: true },
  });
  return parent.id;
}

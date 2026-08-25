import { prisma } from "@/lib/prisma";
import { BranchRole } from "@/prisma/generated/prisma/enums";

/**
 * Crée le profil métier (enseignant, élève, parent, personnel)
 * attendu par les listes « Utilisateurs » de la branche.
 */
export async function ensureBranchMemberRoleProfiles(params: {
  memberId: string;
  organizationId: string;
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
      counts: row._count,
    });
  }
}

async function ensureProfileForBranchMember(params: {
  branchMemberId: string;
  branchId: string;
  organizationId: string;
  role: BranchRole;
  counts: {
    teacher: number;
    student: number;
    parent: number;
    personel: number;
  };
}) {
  switch (params.role) {
    case BranchRole.TEACHER:
      if (params.counts.teacher === 0) {
        await prisma.teacher.createMany({
          data: [{ branchMemberId: params.branchMemberId }],
          skipDuplicates: true,
        });
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
      if (params.counts.personel === 0) {
        await prisma.personnel.createMany({
          data: [{ branchMemberId: params.branchMemberId }],
          skipDuplicates: true,
        });
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

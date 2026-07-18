import { prisma } from "@/lib/prisma";
import { isAtelierBranch } from "@/lib/branch-capabilities";
import type { BranchRole } from "@/prisma/generated/prisma/client";

export type ImportStaffSearchResult = {
  id: string;
  nom: string;
  postnom: string;
  prenom: string;
  username: string;
  sexe: string;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceBranchType: string;
  alreadyLinked: boolean;
};

export function supportsStaffImport(typebranch: unknown): boolean {
  return isAtelierBranch(typebranch);
}

function buildUserSearchFilter(search?: string) {
  if (!search?.trim()) return {};

  return {
    OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { postnom: { contains: search, mode: "insensitive" as const } },
      { prenom: { contains: search, mode: "insensitive" as const } },
      { username: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

async function isMemberLinkedToTargetBranch(params: {
  memberId: string;
  targetBranchId: string;
  profile: "teacher" | "personnel";
}) {
  const branchMember = await prisma.branchMember.findUnique({
    where: {
      branchId_memberId: {
        branchId: params.targetBranchId,
        memberId: params.memberId,
      },
    },
    select: { id: true },
  });

  if (!branchMember) return false;

  if (params.profile === "teacher") {
    return Boolean(
      await prisma.teacher.findFirst({
        where: { branchMemberId: branchMember.id },
        select: { id: true },
      }),
    );
  }

  return Boolean(
    await prisma.personnel.findFirst({
      where: { branchMemberId: branchMember.id },
      select: { id: true },
    }),
  );
}

function mapStaffResult(input: {
  id: string;
  branchMember: {
    memberId: string;
    branch: { id: string; name: string; typebranch: string };
    member: {
      user: {
        name: string | null;
        postnom: string | null;
        prenom: string | null;
        username: string | null;
        sexe: string | null;
      } | null;
    };
  };
  alreadyLinked: boolean;
}): ImportStaffSearchResult {
  const user = input.branchMember.member.user;

  return {
    id: input.id,
    nom: user?.name ?? "",
    postnom: user?.postnom ?? "",
    prenom: user?.prenom ?? "",
    username: user?.username ?? "",
    sexe: user?.sexe ?? "",
    sourceBranchId: input.branchMember.branch.id,
    sourceBranchName: input.branchMember.branch.name,
    sourceBranchType: input.branchMember.branch.typebranch,
    alreadyLinked: input.alreadyLinked,
  };
}

export async function searchOrganizationTeachersForBranchImport(params: {
  organizationId: string;
  targetBranchId: string;
  query?: string;
  limit?: number;
}): Promise<ImportStaffSearchResult[]> {
  const search = params.query?.trim();
  const limit = params.limit ?? 25;

  const teachers = await prisma.teacher.findMany({
    where: {
      branchMember: {
        role: "TEACHER",
        branch: {
          organizationId: params.organizationId,
          isActive: true,
          id: { not: params.targetBranchId },
        },
        member: {
          organizationId: params.organizationId,
          user: buildUserSearchFilter(search),
        },
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      branchMember: {
        include: {
          branch: { select: { id: true, name: true, typebranch: true } },
          member: { include: { user: true } },
        },
      },
    },
  });

  const results: ImportStaffSearchResult[] = [];

  for (const teacher of teachers) {
    if (!teacher.branchMember) continue;

    const alreadyLinked = await isMemberLinkedToTargetBranch({
      memberId: teacher.branchMember.memberId,
      targetBranchId: params.targetBranchId,
      profile: "teacher",
    });

    results.push(
      mapStaffResult({
        id: teacher.id,
        branchMember: teacher.branchMember,
        alreadyLinked,
      }),
    );
  }

  return results;
}

export async function searchOrganizationPersonnelsForBranchImport(params: {
  organizationId: string;
  targetBranchId: string;
  query?: string;
  limit?: number;
}): Promise<ImportStaffSearchResult[]> {
  const search = params.query?.trim();
  const limit = params.limit ?? 25;

  const personnels = await prisma.personnel.findMany({
    where: {
      branchMember: {
        branch: {
          organizationId: params.organizationId,
          isActive: true,
          id: { not: params.targetBranchId },
        },
        member: {
          organizationId: params.organizationId,
          user: buildUserSearchFilter(search),
        },
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      branchMember: {
        include: {
          branch: { select: { id: true, name: true, typebranch: true } },
          member: { include: { user: true } },
        },
      },
    },
  });

  const results: ImportStaffSearchResult[] = [];

  for (const personnel of personnels) {
    if (!personnel.branchMember) continue;

    const alreadyLinked = await isMemberLinkedToTargetBranch({
      memberId: personnel.branchMember.memberId,
      targetBranchId: params.targetBranchId,
      profile: "personnel",
    });

    results.push(
      mapStaffResult({
        id: personnel.id,
        branchMember: personnel.branchMember,
        alreadyLinked,
      }),
    );
  }

  return results;
}

async function linkMemberProfileToBranch(params: {
  memberId: string;
  sourceBranchId: string;
  targetBranchId: string;
  organizationId: string;
  branchRole: BranchRole;
  profile: "teacher" | "personnel";
  sourceEntityId: string;
  findSource: () => Promise<{ memberId: string } | null>;
}) {
  const source = await params.findSource();

  if (!source) {
    throw new Error("Profil introuvable dans la branche source");
  }

  if (source.memberId !== params.memberId) {
    throw new Error("La branche source ne correspond pas au profil");
  }

  const alreadyLinked = await isMemberLinkedToTargetBranch({
    memberId: params.memberId,
    targetBranchId: params.targetBranchId,
    profile: params.profile,
  });

  if (alreadyLinked) {
    throw new Error("Cette personne est deja presente dans cette branche");
  }

  const existingBranchMember = await prisma.branchMember.findUnique({
    where: {
      branchId_memberId: {
        branchId: params.targetBranchId,
        memberId: params.memberId,
      },
    },
  });

  if (existingBranchMember) {
    if (params.profile === "teacher") {
      return prisma.teacher.create({
        data: { branchMemberId: existingBranchMember.id },
      });
    }

    return prisma.personnel.create({
      data: { branchMemberId: existingBranchMember.id },
    });
  }

  return prisma.$transaction(async (tx) => {
    const branchMember = await tx.branchMember.create({
      data: {
        branchId: params.targetBranchId,
        memberId: params.memberId,
        role: params.branchRole,
      },
    });

    if (params.profile === "teacher") {
      return tx.teacher.create({
        data: { branchMemberId: branchMember.id },
      });
    }

    return tx.personnel.create({
      data: { branchMemberId: branchMember.id },
    });
  });
}

export async function linkTeacherToBranch(params: {
  teacherId: string;
  sourceBranchId: string;
  targetBranchId: string;
  organizationId: string;
}) {
  const sourceTeacher = await prisma.teacher.findFirst({
    where: {
      id: params.teacherId,
      branchMember: {
        branchId: params.sourceBranchId,
        role: "TEACHER",
        member: { organizationId: params.organizationId },
      },
    },
    select: {
      id: true,
      branchMember: { select: { memberId: true } },
    },
  });

  if (!sourceTeacher?.branchMember) {
    throw new Error("Enseignant introuvable dans la branche source");
  }

  return linkMemberProfileToBranch({
    memberId: sourceTeacher.branchMember.memberId,
    sourceBranchId: params.sourceBranchId,
    targetBranchId: params.targetBranchId,
    organizationId: params.organizationId,
    branchRole: "TEACHER",
    profile: "teacher",
    sourceEntityId: params.teacherId,
    findSource: async () => sourceTeacher.branchMember,
  });
}

export async function linkPersonnelToBranch(params: {
  personnelId: string;
  sourceBranchId: string;
  targetBranchId: string;
  organizationId: string;
}) {
  const sourcePersonnel = await prisma.personnel.findFirst({
    where: {
      id: params.personnelId,
      branchMember: {
        branchId: params.sourceBranchId,
        member: { organizationId: params.organizationId },
      },
    },
    select: {
      id: true,
      branchMember: { select: { memberId: true } },
    },
  });

  if (!sourcePersonnel?.branchMember) {
    throw new Error("Personnel introuvable dans la branche source");
  }

  return linkMemberProfileToBranch({
    memberId: sourcePersonnel.branchMember.memberId,
    sourceBranchId: params.sourceBranchId,
    targetBranchId: params.targetBranchId,
    organizationId: params.organizationId,
    branchRole: "DIRECTOR",
    profile: "personnel",
    sourceEntityId: params.personnelId,
    findSource: async () => sourcePersonnel.branchMember,
  });
}

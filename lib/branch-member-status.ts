import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Désactive une personne dans une branche uniquement.
 * Conserve le profil (Parent/Teacher/…) et tout l'historique (rapports).
 * N'affecte pas User.statusUser ni les autres branches.
 */
export async function deactivatePersonInBranch(params: {
  branchMemberId: string;
  /** Élève : aligne aussi statusStudent (domaine élève). */
  studentId?: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.branchMember.update({
      where: { id: params.branchMemberId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });

    if (params.studentId) {
      await tx.student.update({
        where: { id: params.studentId },
        data: { statusStudent: false },
      });
    }
  });
}

/**
 * Réactive un BranchMember déjà présent (ex. réaffectation dans la même branche).
 */
export async function reactivateBranchMember(branchMemberId: string) {
  await prisma.branchMember.update({
    where: { id: branchMemberId },
    data: {
      isActive: true,
      deactivatedAt: null,
    },
  });
}

/**
 * Crée un BranchMember ou réactive s'il existe déjà (même branche + membre).
 */
export async function ensureActiveBranchMember(params: {
  branchId: string;
  memberId: string;
  role: "PARENT" | "TEACHER" | "STUDENT" | "ADMIN" | "DIRECTOR" | "CAISSIER";
}) {
  const existing = await prisma.branchMember.findUnique({
    where: {
      branchId_memberId: {
        branchId: params.branchId,
        memberId: params.memberId,
      },
    },
    select: { id: true, isActive: true, role: true },
  });

  if (existing) {
    if (!existing.isActive || existing.role !== params.role) {
      await prisma.branchMember.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          deactivatedAt: null,
          role: params.role,
        },
      });
    }
    return existing.id;
  }

  const created = await prisma.branchMember.create({
    data: {
      branchId: params.branchId,
      memberId: params.memberId,
      role: params.role,
      isActive: true,
    },
    select: { id: true },
  });
  return created.id;
}

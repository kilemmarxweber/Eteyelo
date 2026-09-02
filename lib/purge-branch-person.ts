import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";

type Tx = Prisma.TransactionClient;

async function deleteEnrollmentFinancials(tx: Tx, enrollmentIds: string[]) {
  if (enrollmentIds.length === 0) return;

  const payments = await tx.familyPayment.findMany({
    where: { classEnrollmentId: { in: enrollmentIds } },
    select: { id: true, batchId: true },
  });
  const paymentIds = payments.map((payment) => payment.id);
  const batchIds = [
    ...new Set(
      payments
        .map((payment) => payment.batchId)
        .filter((id): id is number => id != null),
    ),
  ];

  if (paymentIds.length > 0) {
    await tx.paymentAllocation.deleteMany({
      where: { familyPaymentId: { in: paymentIds } },
    });
    await tx.mobileMoneyTransaction.deleteMany({
      where: { paymentId: { in: paymentIds } },
    });
    await tx.paymentEvent.deleteMany({
      where: { paymentId: { in: paymentIds } },
    });
    await tx.familyPayment.deleteMany({
      where: { id: { in: paymentIds } },
    });
  }

  if (batchIds.length > 0) {
    await tx.paymentBatch.deleteMany({
      where: { id: { in: batchIds }, payments: { none: {} } },
    });
  }

  const invoices = await tx.invoice.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    select: { id: true },
  });
  const invoiceIds = invoices.map((invoice) => invoice.id);

  if (invoiceIds.length > 0) {
    await tx.paymentAllocation.deleteMany({
      where: { invoiceId: { in: invoiceIds } },
    });
    await tx.invoice.deleteMany({
      where: { id: { in: invoiceIds } },
    });
  }

  await tx.classEnrollment.deleteMany({
    where: { id: { in: enrollmentIds } },
  });
}

async function deleteTeachingTree(tx: Tx, teachingIds: string[]) {
  if (teachingIds.length === 0) return;

  const sessions = await tx.attendanceSession.findMany({
    where: { teachingId: { in: teachingIds } },
    select: { id: true },
  });
  const sessionIds = sessions.map((session) => session.id);

  if (sessionIds.length > 0) {
    await tx.absenceCase.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await tx.studentAttendance.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await tx.teacherAttendance.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await tx.attendanceSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
  }

  await tx.schedule.deleteMany({
    where: { teachingId: { in: teachingIds } },
  });
  await tx.calendarEvent.deleteMany({
    where: { teachingId: { in: teachingIds } },
  });
  await tx.fiche.deleteMany({
    where: { lessonId: { in: teachingIds } },
  });
  await tx.teaching.deleteMany({
    where: { id: { in: teachingIds } },
  });
}

async function finishProfileRemoval(tx: Tx, branchMemberId: string) {
  const remaining = await tx.branchMember.findUnique({
    where: { id: branchMemberId },
    select: {
      _count: {
        select: {
          student: true,
          teacher: true,
          personel: true,
          parent: true,
        },
      },
    },
  });
  if (!remaining) return;
  const leftover =
    remaining._count.student +
    remaining._count.teacher +
    remaining._count.personel +
    remaining._count.parent;
  if (leftover > 0) return;
  await removeBranchMemberKeepOrg(tx, branchMemberId);
}

/**
 * Archive l'email d'un utilisateur sous la forme archived.email@domain.com
 * et sauvegarde son email d'origine dans le champ archivedEmail s'il n'a plus de branche.
 */
export async function archiveUserEmailIfNoBranch(tx: Tx, userId: string) {
  const remainingCount = await tx.branchMember.count({
    where: { member: { userId } },
  });
  if (remainingCount > 0) return;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, archivedEmail: true },
  });

  if (!user || !user.email) return;

  if (!user.email.startsWith("archived.")) {
    const originalEmail = user.archivedEmail || user.email;
    const defaultArchivedAddress = `archived.${originalEmail}`;
    const collision = await tx.user.findFirst({
      where: { email: defaultArchivedAddress, id: { not: user.id } },
      select: { id: true },
    });
    // The first archived address follows the documented format. A suffix keeps
    // it unique if the same email has since been assigned and archived again.
    const archivedAddress = collision
      ? `archived.${user.id}.${originalEmail}`
      : defaultArchivedAddress;

    await tx.user.update({
      where: { id: user.id },
      data: {
        email: archivedAddress,
        archivedEmail: originalEmail,
      },
    });

    await tx.account.updateMany({
      where: {
        userId: user.id,
        providerId: "credential",
        accountId: user.email,
      },
      data: { accountId: archivedAddress },
    });
  }
}

/**
 * Restaure l'email d'origine d'un utilisateur archivé.
 */
export async function restoreUserEmailIfArchived(
  tx: Tx,
  userId: string,
  newEmailInput?: string,
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, archivedEmail: true },
  });

  if (!user) return;

  let targetEmail = newEmailInput?.trim().toLowerCase();
  if (!targetEmail) {
    if (user.archivedEmail) {
      targetEmail = user.archivedEmail.trim().toLowerCase();
    } else if (user.email && user.email.startsWith("archived.")) {
      targetEmail = user.email.replace(/^archived\./, "").trim().toLowerCase();
    }
  }

  if (targetEmail) {
    const previousEmail = user.email;
    await tx.user.update({
      where: { id: userId },
      data: {
        email: targetEmail,
        archivedEmail: null,
      },
    });

    if (previousEmail && previousEmail !== targetEmail) {
      await tx.account.updateMany({
        where: {
          userId,
          providerId: "credential",
          accountId: previousEmail,
        },
        data: { accountId: targetEmail },
      });
    }
  }
}

/**
 * Retire uniquement le rattachement à la branche.
 * Conserve Member (organisation) et User, et archive l'email si l'utilisateur n'a plus de branche.
 */
export async function removeBranchMemberKeepOrg(
  tx: Tx,
  branchMemberId: string,
) {
  const branchMember = await tx.branchMember.findUnique({
    where: { id: branchMemberId },
    select: {
      id: true,
      member: { select: { userId: true } },
    },
  });

  if (!branchMember) return;

  await tx.schedule.updateMany({
    where: { createdBy: branchMember.id },
    data: { createdBy: null },
  });

  const userId = branchMember.member?.userId;

  await tx.branchMember.delete({ where: { id: branchMember.id } });

  if (userId) {
    await archiveUserEmailIfNoBranch(tx, userId);
  }
}

/**
 * Supprime BranchMember, puis Member / User s'ils n'ont plus d'autres rattachements.
 * Réservé aux purges complètes (ex. suppression d'une branche entière).
 */
export async function deleteBranchMemberAndOrphanUser(
  tx: Tx,
  branchMemberId: string,
) {
  const branchMember = await tx.branchMember.findUnique({
    where: { id: branchMemberId },
    select: {
      id: true,
      memberId: true,
      member: { select: { userId: true } },
    },
  });

  if (!branchMember) return;

  await removeBranchMemberKeepOrg(tx, branchMember.id);

  const remainingBranchMembers = await tx.branchMember.count({
    where: { memberId: branchMember.memberId },
  });
  if (remainingBranchMembers > 0) return;

  await tx.member.delete({ where: { id: branchMember.memberId } });

  const remainingMembers = await tx.member.count({
    where: { userId: branchMember.member.userId },
  });
  if (remainingMembers > 0) return;

  await tx.user.delete({ where: { id: branchMember.member.userId } });
}

export async function purgeStudentPermanently(params: {
  studentId: string;
  branchId: string;
  /** Propriétaire : cascade même si l'élève est affiché via un lien d'import. */
  force?: boolean;
}) {
  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    include: {
      branchMember: {
        include: {
          member: { include: { user: { select: { id: true } } } },
        },
      },
    },
  });

  if (!student) {
    return { ok: false as const, message: "Élève introuvable" };
  }

  const linkedInBranch = await prisma.studentBranchLink.findFirst({
    where: {
      studentId: student.id,
      targetBranchId: params.branchId,
      isActive: true,
    },
    select: { id: true },
  });

  if (linkedInBranch && !params.force) {
    return {
      ok: false as const,
      message:
        "Élève importé : désactivez le lien depuis cette branche (archivage), la suppression définitive se fait dans la branche d'origine.",
    };
  }

  if (student.branchMember.branchId !== params.branchId && !params.force) {
    return {
      ok: false as const,
      message: "Élève introuvable dans cette branche",
    };
  }

  await prisma.$transaction(async (tx) => {
    const enrollments = await tx.classEnrollment.findMany({
      where: { studentId: student.id },
      select: { id: true },
    });
    await deleteEnrollmentFinancials(
      tx,
      enrollments.map((enrollment) => enrollment.id),
    );

    await tx.absenceCase.deleteMany({ where: { studentId: student.id } });
    await tx.studentAttendance.deleteMany({ where: { studentId: student.id } });
    await tx.studentGrade.deleteMany({ where: { studentId: student.id } });
    await tx.onlineSubmission.deleteMany({ where: { studentId: student.id } });
    await tx.issuedDocument.deleteMany({ where: { studentId: student.id } });
    await tx.studentBranchLink.deleteMany({ where: { studentId: student.id } });
    await tx.registrationRequest.updateMany({
      where: { studentId: student.id },
      data: { studentId: null },
    });

    const branchMemberId = student.branchMemberId;
    await tx.student.delete({ where: { id: student.id } });
    await finishProfileRemoval(tx, branchMemberId);
  });

  return {
    ok: true as const,
    message:
      "Élève supprimé définitivement, avec les inscriptions, paiements, présences et notes liés.",
  };
}

export async function purgeTeacherPermanently(params: {
  teacherId: string;
  branchId: string;
}) {
  const teacher = await prisma.teacher.findFirst({
    where: {
      id: params.teacherId,
      branchMember: { branchId: params.branchId },
    },
    include: {
      branchMember: {
        include: {
          member: { include: { user: { select: { id: true } } } },
        },
      },
      teaching: { select: { id: true } },
    },
  });

  if (!teacher?.branchMember) {
    return { ok: false as const, message: "Enseignant introuvable" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.attendanceSession.updateMany({
      where: { validatedByTeacherId: teacher.id },
      data: { validatedByTeacherId: null },
    });

    await tx.absenceCase.deleteMany({ where: { teacherId: teacher.id } });
    await tx.teacherAttendance.deleteMany({ where: { teacherId: teacher.id } });
    await deleteTeachingTree(
      tx,
      teacher.teaching.map((teaching) => teaching.id),
    );
    await tx.fiche.deleteMany({ where: { teacherId: teacher.id } });
    await tx.onlineAssignment.deleteMany({ where: { teacherId: teacher.id } });
    await tx.jobApplication.updateMany({
      where: { teacherId: teacher.id },
      data: { teacherId: null },
    });

    const branchMemberId = teacher.branchMemberId!;
    await tx.teacher.delete({ where: { id: teacher.id } });
    await finishProfileRemoval(tx, branchMemberId);
  });

  return {
    ok: true as const,
    message:
      "Enseignant supprimé définitivement, avec les cours, pointages, fiches et affectations liés.",
  };
}

export async function purgePersonnelPermanently(params: {
  personnelId: string;
  branchId: string;
}) {
  const personnel = await prisma.personnel.findFirst({
    where: {
      id: params.personnelId,
      branchMember: { branchId: params.branchId },
    },
    include: {
      branchMember: {
        include: {
          member: { include: { user: { select: { id: true } } } },
        },
      },
    },
  });

  if (!personnel?.branchMember) {
    return { ok: false as const, message: "Personnel introuvable" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.absenceCase.deleteMany({ where: { personnelId: personnel.id } });
    await tx.personnelAttendance.deleteMany({
      where: { personnelId: personnel.id },
    });
    await tx.jobApplication.updateMany({
      where: { personnelId: personnel.id },
      data: { personnelId: null },
    });

    const branchMemberId = personnel.branchMemberId;
    await tx.personnel.delete({ where: { id: personnel.id } });
    await finishProfileRemoval(tx, branchMemberId);
  });

  return {
    ok: true as const,
    message:
      "Personnel supprimé définitivement, avec les présences et pointages liés.",
  };
}

export async function purgeParentPermanently(params: {
  parentId: string;
  branchId: string;
}) {
  const parent = await prisma.parent.findFirst({
    where: {
      id: params.parentId,
      branchMember: { branchId: params.branchId },
    },
    include: {
      branchMember: {
        include: {
          member: { include: { user: { select: { id: true } } } },
        },
      },
      _count: { select: { students: true } },
    },
  });

  if (!parent?.branchMember) {
    return { ok: false as const, message: "Parent introuvable" };
  }

  const children = await prisma.student.findMany({
    where: { parentId: parent.id },
    select: {
      id: true,
      branchMember: { select: { branchId: true } },
    },
  });
  for (const child of children) {
    const childResult = await purgeStudentPermanently({
      studentId: child.id,
      branchId: child.branchMember.branchId,
      force: true,
    });
    if (!childResult.ok) return childResult;
  }

  await prisma.$transaction(async (tx) => {
    const payments = await tx.familyPayment.findMany({
      where: { parentId: parent.id },
      select: { id: true },
    });
    const paymentIds = payments.map((payment) => payment.id);
    if (paymentIds.length > 0) {
      await tx.paymentAllocation.deleteMany({
        where: { familyPaymentId: { in: paymentIds } },
      });
      await tx.mobileMoneyTransaction.deleteMany({
        where: { paymentId: { in: paymentIds } },
      });
      await tx.paymentEvent.deleteMany({
        where: { paymentId: { in: paymentIds } },
      });
      await tx.familyPayment.deleteMany({
        where: { id: { in: paymentIds } },
      });
    }

    await tx.paymentBatch.deleteMany({ where: { parentId: parent.id } });
    await tx.discountRule.deleteMany({ where: { parentId: parent.id } });
    await tx.parentFeedback.deleteMany({ where: { parentId: parent.id } });

    const branchMemberId = parent.branchMemberId;
    await tx.parent.delete({ where: { id: parent.id } });
    await finishProfileRemoval(tx, branchMemberId);
  });

  return {
    ok: true as const,
    message:
      "Tuteur supprimé définitivement, avec les enfants liés et toutes les données (paiements, inscriptions…).",
  };
}

/** Purge tous les profils liés aux BranchMember d'un membre d'organisation. */
export async function purgeOrganizationMemberProfiles(params: {
  memberId: string;
  organizationId: string;
}) {
  const branchMembers = await prisma.branchMember.findMany({
    where: {
      memberId: params.memberId,
      branch: { organizationId: params.organizationId },
    },
    select: {
      branchId: true,
      student: { select: { id: true } },
      teacher: { select: { id: true } },
      personel: { select: { id: true } },
      parent: { select: { id: true } },
    },
  });

  for (const row of branchMembers) {
    for (const student of row.student) {
      const result = await purgeStudentPermanently({
        studentId: student.id,
        branchId: row.branchId,
        force: true,
      });
      if (!result.ok) return result;
    }
  }
  for (const row of branchMembers) {
    for (const parent of row.parent) {
      const result = await purgeParentPermanently({
        parentId: parent.id,
        branchId: row.branchId,
      });
      if (!result.ok) return result;
    }
  }
  for (const row of branchMembers) {
    for (const teacher of row.teacher) {
      const result = await purgeTeacherPermanently({
        teacherId: teacher.id,
        branchId: row.branchId,
      });
      if (!result.ok) return result;
    }
  }
  for (const row of branchMembers) {
    for (const personnel of row.personel) {
      const result = await purgePersonnelPermanently({
        personnelId: personnel.id,
        branchId: row.branchId,
      });
      if (!result.ok) return result;
    }
  }

  return { ok: true as const };
}

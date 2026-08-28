import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";

type Tx = Prisma.TransactionClient;

async function deleteEnrollmentFinancials(tx: Tx, enrollmentIds: string[]) {
  if (enrollmentIds.length === 0) return;

  const payments = await tx.familyPayment.findMany({
    where: { classEnrollmentId: { in: enrollmentIds } },
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

/**
 * Retire uniquement le rattachement à la branche.
 * Conserve Member (organisation) et User.
 */
export async function removeBranchMemberKeepOrg(
  tx: Tx,
  branchMemberId: string,
) {
  const branchMember = await tx.branchMember.findUnique({
    where: { id: branchMemberId },
    select: { id: true },
  });

  if (!branchMember) return;

  await tx.schedule.updateMany({
    where: { createdBy: branchMember.id },
    data: { createdBy: null },
  });

  await tx.branchMember.delete({ where: { id: branchMember.id } });
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

  if (linkedInBranch) {
    return {
      ok: false as const,
      message:
        "Élève importé : désactivez le lien depuis cette branche (archivage), la suppression définitive se fait dans la branche d'origine.",
    };
  }

  if (student.branchMember.branchId !== params.branchId) {
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
    await removeBranchMemberKeepOrg(tx, branchMemberId);
  });

  return {
    ok: true as const,
    message:
      "Élève retiré de cette branche. Il reste membre de l'organisation.",
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
    await removeBranchMemberKeepOrg(tx, branchMemberId);
  });

  return {
    ok: true as const,
    message:
      "Enseignant retiré de cette branche. Il reste membre de l'organisation.",
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
    await removeBranchMemberKeepOrg(tx, branchMemberId);
  });

  return {
    ok: true as const,
    message:
      "Personnel retiré de cette branche. Il reste membre de l'organisation.",
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

  if (parent._count.students > 0) {
    const count = parent._count.students;
    return {
      ok: false as const,
      message: `Impossible de supprimer ce parent : ${count} élève${count > 1 ? "s" : ""} y ${count > 1 ? "sont encore liés" : "est encore lié"}. Supprimez d'abord ${count > 1 ? "ces élèves" : "cet élève"}.`,
    };
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
    await removeBranchMemberKeepOrg(tx, branchMemberId);
  });

  return {
    ok: true as const,
    message:
      "Parent retiré de cette branche. Il reste membre de l'organisation.",
  };
}

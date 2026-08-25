import "server-only";

import type { Prisma } from "@/prisma/generated/prisma/client";

import { deleteBranchMemberAndOrphanUser } from "@/lib/purge-branch-person";

type Tx = Prisma.TransactionClient;

/**
 * Supprime toutes les données d'une branche (caisse, classes, personnes, catalogues),
 * puis la branche elle-même. Les Member / User sans autre rattachement sont aussi retirés.
 */
export async function purgeBranchCompletely(tx: Tx, branchId: string) {
  await tx.session.updateMany({
    where: { activeBranchId: branchId },
    data: { activeBranchId: null },
  });
  await tx.platformSupportEscalation.updateMany({
    where: { branchId },
    data: { branchId: null },
  });

  const payments = await tx.familyPayment.findMany({
    where: { branchId },
    select: { id: true },
  });
  const paymentIds = payments.map((payment) => payment.id);

  await tx.paymentAllocation.deleteMany({ where: { branchId } });
  if (paymentIds.length > 0) {
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
  await tx.mobileMoneyTransaction.deleteMany({ where: { branchId } });
  await tx.paymentEvent.deleteMany({ where: { branchId } });
  await tx.invoice.deleteMany({ where: { branchId } });
  await tx.paymentBatch.deleteMany({ where: { branchId } });
  await tx.cashierExpense.deleteMany({ where: { branchId } });
  await tx.cashierOpeningBalance.deleteMany({ where: { branchId } });
  await tx.discountRule.deleteMany({ where: { branchId } });
  await tx.transaction.deleteMany({ where: { branchId } });

  await tx.appNotification.deleteMany({ where: { branchId } });
  await tx.absenceCase.deleteMany({ where: { branchId } });

  await tx.fiche.updateMany({
    where: { branchId, onlineAssignmentId: { not: null } },
    data: { onlineAssignmentId: null },
  });
  await tx.onlineAssignment.deleteMany({ where: { branchId } });

  await tx.studentGrade.deleteMany({ where: { branchId } });
  await tx.issuedDocument.deleteMany({ where: { branchId } });
  await tx.studentAttendance.deleteMany({ where: { branchId } });
  await tx.teacherAttendance.deleteMany({ where: { branchId } });
  await tx.personnelAttendance.deleteMany({ where: { branchId } });
  await tx.attendanceSession.deleteMany({ where: { branchId } });
  await tx.parentFeedback.deleteMany({ where: { branchId } });

  const teachings = await tx.teaching.findMany({
    where: { branchId },
    select: { id: true },
  });
  const teachingIds = teachings.map((teaching) => teaching.id);
  if (teachingIds.length > 0) {
    await tx.schedule.deleteMany({
      where: { teachingId: { in: teachingIds } },
    });
  }
  await tx.calendarEvent.deleteMany({ where: { branchId } });
  await tx.fiche.deleteMany({ where: { branchId } });
  await tx.teaching.deleteMany({ where: { branchId } });
  await tx.periodResultLock.deleteMany({ where: { branchId } });

  await tx.classEnrollment.deleteMany({ where: { branchId } });

  await tx.registrationRequest.deleteMany({ where: { branchId } });
  await tx.branchRegistrationInfo.deleteMany({ where: { branchId } });
  await tx.jobApplication.deleteMany({ where: { branchId } });
  await tx.studentBranchLink.deleteMany({
    where: {
      OR: [{ targetBranchId: branchId }, { sourceBranchId: branchId }],
    },
  });

  await tx.coursOptionPonderation.deleteMany({ where: { branchId } });
  await tx.frais.deleteMany({ where: { branchId } });
  await tx.classe.deleteMany({ where: { branchId } });
  await tx.option.deleteMany({ where: { branchId } });
  await tx.section.deleteMany({ where: { branchId } });
  await tx.period.deleteMany({ where: { branchId } });
  await tx.semester.deleteMany({ where: { branchId } });
  await tx.cours.deleteMany({ where: { branchId } });
  await tx.schoolYear.deleteMany({ where: { branchId } });
  await tx.typeFrais.deleteMany({ where: { branchId } });
  await tx.creneau.deleteMany({ where: { branchId } });
  await tx.eventType.deleteMany({ where: { branchId } });
  await tx.branchPrimaryDomain.deleteMany({ where: { branchId } });
  await tx.branchCycle.deleteMany({ where: { branchId } });
  await tx.branchInvitation.deleteMany({ where: { branchId } });
  await tx.libraryBook.deleteMany({ where: { branchId } });
  await tx.partnaire.deleteMany({ where: { branchId } });
  await tx.organizationSupportBranchScope.deleteMany({ where: { branchId } });

  const branchMembers = await tx.branchMember.findMany({
    where: { branchId },
    select: { id: true },
  });
  const memberIds = branchMembers.map((member) => member.id);

  if (memberIds.length > 0) {
    await tx.schedule.deleteMany({
      where: { createdBy: { in: memberIds } },
    });
  }

  await tx.student.deleteMany({
    where: { branchMember: { branchId } },
  });
  await tx.teacher.deleteMany({
    where: { branchMember: { branchId } },
  });
  await tx.personnel.deleteMany({
    where: { branchMember: { branchId } },
  });
  await tx.parent.deleteMany({
    where: { branchMember: { branchId } },
  });

  for (const member of branchMembers) {
    await deleteBranchMemberAndOrphanUser(tx, member.id);
  }

  await tx.branch.delete({ where: { id: branchId } });
}

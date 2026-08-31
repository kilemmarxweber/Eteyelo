import "server-only";

import { getBranchAbsenceReviewers } from "@/lib/email/get-branch-manager-emails";
import { sendPayrollDeductionEmail } from "@/lib/email/send-payroll-notification-email";
import { CURRENCY_LABELS, getBaseCurrency, roundCurrency } from "@/lib/exchange-rate";
import { prisma } from "@/lib/prisma";
import type { CurrencyCode } from "@/prisma/generated/prisma/client";

export async function notifyTeacherPayrollImpact(input: {
  branchId: string;
  organizationId: string;
  teacherId: string;
  sessionId: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "EARLY_EXIT";
}) {
  if (input.status !== "LATE" && input.status !== "ABSENT" && input.status !== "EARLY_EXIT") return;

  const [branch, attendance, policy, rates] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: input.branchId },
      select: { name: true },
    }),
    prisma.teacherAttendance.findUnique({
      where: {
        teacherId_sessionId_branchId: {
          teacherId: input.teacherId,
          sessionId: input.sessionId,
          branchId: input.branchId,
        },
      },
      select: {
        checkIn: true,
        checkOut: true,
        earlyExit: true,
        absenceCase: { select: { status: true } },
      },
    }),
    prisma.branchPayrollPolicy.findUnique({
      where: { branchId: input.branchId },
    }),
    prisma.exchangeRate.findMany({
      where: { organizationId: input.organizationId, isActive: true },
      select: {
        id: true,
        fromCurrency: true,
        toCurrency: true,
        rate: true,
        isActive: true,
        isSelected: true,
      },
    }),
  ]);
  const session = await prisma.attendanceSession.findFirst({
    where: { id: input.sessionId, branchId: input.branchId, teaching: { teacherId: input.teacherId } },
    select: {
      date: true,
      startTime: true,
      endTime: true,
      teaching: {
        select: {
          classe: { select: { nameClasse: true, cycle: true, creneau: { select: { durationCourse: true } } } },
          cours: { select: { nameCours: true } },
        },
      },
    },
  });
  if (!branch || !session || !attendance) return;
  if (attendance.absenceCase?.status === "ACCEPTED") return;

  const duration = Math.max(
    1,
    (session.endTime.getTime() - session.startTime.getTime()) / 60000,
  );
  const grace = policy?.lateGraceMinutes ?? 10;
  const lost =
    input.status === "ABSENT"
      ? duration
      : Math.min(
          duration,
          Math.max(
            0,
            (attendance.checkIn
              ? (attendance.checkIn.getTime() - session.startTime.getTime()) / 60000
              : duration) - grace,
          ) +
            (attendance.earlyExit && attendance.checkOut
              ? Math.max(
                  0,
                  (session.endTime.getTime() - attendance.checkOut.getTime()) / 60000,
                )
              : 0),
        );
  if (lost <= 0) return;

  const currency = getBaseCurrency(rates);
  const teacher = await prisma.teacher.findUnique({
    where: { id: input.teacherId },
    select: {
      employmentKind: true,
      branchMember: {
        select: {
          member: {
            select: {
              user: { select: { id: true, name: true, prenom: true, postnom: true, email: true } },
            },
          },
        },
      },
    },
  });
  const user = teacher?.branchMember?.member?.user;
  if (!user) return;

  const cycle = session.teaching.classe?.cycle === "PRIMAIRE" ? "PRIMAIRE" : "SECONDAIRE";
  let estimate =
    cycle === "SECONDAIRE"
      ? teacher.employmentKind === "MATRICULE"
        ? (policy?.secondaryHourlyRate ?? 1500) *
          ((policy?.secondaryMatriculePrimePercent ?? 30) / 100) *
          (lost / 60)
        : (policy?.secondaryNonMatriculeSessionRate ?? 1500) * (lost / duration)
      : teacher.employmentKind === "MATRICULE"
        ? policy?.primaryMatriculeMonthly ?? 15000
        : policy?.primaryNonMatriculeMonthly ?? 70000;
  estimate = roundCurrency(estimate, currency);

  const contextLabel = `${session.teaching.classe?.nameClasse ?? "Classe"} · ${session.teaching.cours.nameCours}`;
  const href = `/admin/organizations/${input.organizationId}/branches/${input.branchId}/paie-enseignants`;
  const alreadyNotified = await prisma.appNotification.findFirst({
    where: {
      userId: user.id,
      branchId: input.branchId,
      type: "PAYROLL_DEDUCTION",
      href,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (alreadyNotified) return;

  const body = `${contextLabel} · retenue estimée : ${estimate} ${CURRENCY_LABELS[currency]} · le montant définitif figure sur le bulletin du mois.`;
  await prisma.appNotification.create({
    data: {
      branchId: input.branchId,
      organizationId: input.organizationId,
      userId: user.id,
      type: "PAYROLL_DEDUCTION",
      title:
        input.status === "ABSENT"
          ? "Absence avec impact paie"
          : input.status === "EARLY_EXIT"
            ? "Sortie anticipée avec impact paie"
            : "Retard avec impact paie",
      body,
      href,
    },
  });

  const reviewers = await getBranchAbsenceReviewers({
    branchId: input.branchId,
    organizationId: input.organizationId,
  });
  await Promise.all(
    reviewers
      .filter((reviewer) => reviewer.userId !== user.id)
      .map((reviewer) =>
        prisma.appNotification.create({
          data: {
            branchId: input.branchId,
            organizationId: input.organizationId,
            userId: reviewer.userId,
            type: "PAYROLL_DEDUCTION",
            title: "Impact paie enseignant",
            body: `${user.name} · ${body}`,
            href,
          },
        }),
      ),
  );

  if (policy?.notifyByEmail !== false && estimate > 0) {
    await sendPayrollDeductionEmail({
        to: user.email,
        recipientName: [user.prenom, user.name, user.postnom].filter(Boolean).join(" "),
        branchName: branch.name,
        contextLabel,
        occurredOn: session.date,
        statusLabel:
          input.status === "ABSENT"
            ? "Absence"
            : input.status === "EARLY_EXIT"
              ? "Sortie anticipée"
              : "Retard",
        deduction: estimate,
        currency: currency as CurrencyCode,
        rule:
          input.status === "ABSENT"
            ? "absence non justifiée : retenue de la séance"
            : input.status === "EARLY_EXIT"
              ? "minutes non effectuées jusqu'à la fin de la séance"
              : `minutes au-delà de la franchise de ${grace} min`,
        organizationId: input.organizationId,
      }).catch((error) => {
        console.error("PAYROLL_EMAIL_ERROR", error);
      });
  }
}

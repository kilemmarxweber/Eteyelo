import "server-only";

import { getBranchPayrollOwners } from "@/lib/email/get-branch-manager-emails";
import { sendPayrollDeductionEmail } from "@/lib/email/send-payroll-notification-email";
import { CURRENCY_LABELS, getBaseCurrency, roundCurrency } from "@/lib/exchange-rate";
import {
  billableLateMinutes,
  contractualSessionMinutes,
  isPayrollWeekendDate,
  monthlyMinutesFromWeeklyVolume,
  payrollSessionAmount,
  rawLateMinutes,
  sessionGrossFromRate,
} from "@/lib/payroll/primary-volume";
import { sessionLossAmount } from "@/lib/payroll/session-rate";
import { loadPrimaryWeeklyVolume, loadTeacherWeeklyVolume } from "@/lib/payroll/teacher-payroll";
import { prisma } from "@/lib/prisma";
import { startOfTodayParis } from "@/lib/timezone";
import type { CurrencyCode } from "@/prisma/generated/prisma/client";

/** Notifications paie destinées aux propriétaires (pas aux chefs d’établissement). */
export function isPayrollManagerAppNotification(row: {
  type: string;
  title: string;
}): boolean {
  if (row.type === "PAYROLL") {
    return (
      row.title === "Paie enseignants générée" ||
      row.title === "Paie du personnel générée"
    );
  }
  if (row.type === "PAYROLL_DEDUCTION") {
    return (
      row.title === "Impact paie enseignant" ||
      row.title === "Impacts paie enseignants"
    );
  }
  return false;
}

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

  const cycleRaw = session.teaching.classe?.cycle;
  const cycle =
    cycleRaw === "PRIMAIRE" || cycleRaw === "MATERNELLE" || cycleRaw === "SECONDAIRE"
      ? cycleRaw
      : "SECONDAIRE";
  const creneauDuration = session.teaching.classe?.creneau?.durationCourse;
  const duration = contractualSessionMinutes(
    creneauDuration,
    cycle === "PRIMAIRE"
      ? (policy?.primarySessionMinutes ?? 30)
      : cycle === "MATERNELLE"
        ? (policy?.maternelleSessionMinutes ?? 30)
        : (policy?.secondarySessionMinutes ?? 45),
    cycle === "SECONDAIRE" ? 45 : 30,
  );
  const grace = policy?.lateGraceMinutes ?? 5;
  const rawLate = rawLateMinutes(attendance.checkIn, session.startTime);
  const lost =
    input.status === "ABSENT"
      ? duration
      : Math.min(
          duration,
          billableLateMinutes(
            attendance.checkIn ? rawLate : input.status === "LATE" ? duration : 0,
            grace,
          ) +
            (attendance.earlyExit && attendance.checkOut
              ? Math.max(
                  0,
                  (session.endTime.getTime() - attendance.checkOut.getTime()) / 60000,
                )
              : 0),
        );
  const lateWithinGrace = input.status === "LATE" && lost <= 0;
  if (lost <= 0 && !lateWithinGrace) return;
  if (isPayrollWeekendDate(session.date)) return;

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

  let estimate: number;
  if (cycle === "SECONDAIRE") {
    const sessionAmount = payrollSessionAmount({
      secondaryNonMatriculeSessionRate: policy?.secondaryNonMatriculeSessionRate,
      secondaryHourlyRate: policy?.secondaryHourlyRate,
    });
    const sessionGross =
      teacher.employmentKind === "MATRICULE"
        ? sessionAmount * ((policy?.secondaryMatriculePrimePercent ?? 30) / 100)
        : sessionAmount;
    estimate = sessionLossAmount(sessionGross, lost, duration, currency);
  } else {
    const isMaternelle = cycle === "MATERNELLE";
    const forfait = isMaternelle
      ? teacher.employmentKind === "MATRICULE"
        ? (policy?.maternelleMatriculeMonthly ?? 100000)
        : (policy?.maternelleNonMatriculeMonthly ?? 100000)
      : teacher.employmentKind === "MATRICULE"
        ? (policy?.primaryMatriculeMonthly ?? 15000)
        : (policy?.primaryNonMatriculeMonthly ?? 70000);
    const fallbackMinutes = isMaternelle
      ? (policy?.maternelleSessionMinutes ?? 30)
      : (policy?.primarySessionMinutes ?? 30);
    const weekly = isMaternelle
      ? await loadTeacherWeeklyVolume({
          branchId: input.branchId,
          teacherId: input.teacherId,
          cycle: "MATERNELLE",
          fallbackMinutes,
        })
      : await loadPrimaryWeeklyVolume({
          branchId: input.branchId,
          teacherId: input.teacherId,
          fallbackMinutes,
        });
    const monthlyMinutes = monthlyMinutesFromWeeklyVolume(
      weekly,
      session.date.getUTCFullYear(),
      session.date.getUTCMonth() + 1,
    );
    const sessionGross =
      monthlyMinutes > 0
        ? sessionGrossFromRate(forfait / monthlyMinutes, duration, currency)
        : roundCurrency(forfait, currency);
    estimate = sessionLossAmount(sessionGross, lost, duration, currency);
  }
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

  const body = lateWithinGrace
    ? `${contextLabel} · retard de ${Math.round(rawLate * 10) / 10} min (franchise ${grace} min, retenue 0) · signalé au bulletin.`
    : `${contextLabel} · retenue estimée : ${estimate} ${CURRENCY_LABELS[currency]} · le montant définitif figure sur le bulletin du mois.`;
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
            : lateWithinGrace
              ? "Retard signalé (franchise)"
              : "Retard avec impact paie",
      body,
      href,
    },
  });

  const owners = await getBranchPayrollOwners({
    branchId: input.branchId,
    organizationId: input.organizationId,
  });
  const todayStart = startOfTodayParis();
  for (const owner of owners.filter((r) => r.userId !== user.id)) {
    const existing = await prisma.appNotification.findFirst({
      where: {
        userId: owner.userId,
        branchId: input.branchId,
        type: "PAYROLL_DEDUCTION",
        readAt: null,
        createdAt: { gte: todayStart },
      },
      select: { id: true, body: true },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const countMatch = existing.body.match(/^(\d+) impact/);
      const currentCount = countMatch ? parseInt(countMatch[1], 10) : 1;
      await prisma.appNotification.update({
        where: { id: existing.id },
        data: {
          title: "Impacts paie enseignants",
          body: `${currentCount + 1} impacts paie détectés aujourd'hui`,
        },
      });
    } else {
      await prisma.appNotification.create({
        data: {
          branchId: input.branchId,
          organizationId: input.organizationId,
          userId: owner.userId,
          type: "PAYROLL_DEDUCTION",
          title: "Impact paie enseignant",
          body: `${user.name} · ${body}`,
          href,
        },
      });
    }
  }

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
            ? cycle === "SECONDAIRE"
              ? "absence non justifiée : retenue de la séance"
              : "absence non justifiée : retenue de la valeur réelle de la séance (brut ÷ séances du mois)"
            : input.status === "EARLY_EXIT"
              ? "minutes non effectuées jusqu'à la fin de la séance"
              : `minutes au-delà de la franchise de ${grace} min (retard ≤ ${grace} min : autorisé, signalé)`,
        organizationId: input.organizationId,
      }).catch((error) => {
        console.error("PAYROLL_EMAIL_ERROR", error);
      });
  }
}

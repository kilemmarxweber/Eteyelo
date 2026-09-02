import "server-only";

import { getBranchPayrollOwners } from "@/lib/email/get-branch-manager-emails";
import { sendPayrollDeductionEmail } from "@/lib/email/send-payroll-notification-email";
import { CURRENCY_LABELS, getBaseCurrency, roundCurrency } from "@/lib/exchange-rate";
import { prisma } from "@/lib/prisma";
import { startOfTodayParis } from "@/lib/timezone";
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

  const cycle = session.teaching.classe?.cycle === "PRIMAIRE" ? "PRIMAIRE" : "SECONDAIRE";
  const creneauDuration = session.teaching.classe?.creneau?.durationCourse;
  const duration =
    cycle === "PRIMAIRE"
      ? Math.max(
          1,
          creneauDuration && creneauDuration > 0
            ? creneauDuration
            : (policy?.primarySessionMinutes ?? 30),
        )
      : Math.max(
          1,
          (session.endTime.getTime() - session.startTime.getTime()) / 60000 ||
            creneauDuration ||
            policy?.secondarySessionMinutes ||
            45,
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

  let estimate: number;
  if (cycle === "SECONDAIRE") {
    estimate =
      teacher.employmentKind === "MATRICULE"
        ? (policy?.secondaryHourlyRate ?? 1500) *
          ((policy?.secondaryMatriculePrimePercent ?? 30) / 100) *
          (lost / 60)
        : (policy?.secondaryNonMatriculeSessionRate ?? 1500) * (lost / duration);
  } else {
    // Forfait primaire : taux/min = forfait ÷ minutes prévues du mois (créneau 30 min)
    const monthStart = new Date(
      Date.UTC(session.date.getUTCFullYear(), session.date.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(session.date.getUTCFullYear(), session.date.getUTCMonth() + 1, 1),
    );
    const monthSessions = await prisma.attendanceSession.findMany({
      where: {
        branchId: input.branchId,
        date: { gte: monthStart, lt: monthEnd },
        teaching: {
          teacherId: input.teacherId,
          branchId: input.branchId,
          classe: { cycle: "PRIMAIRE" },
        },
      },
      select: {
        teaching: {
          select: { classe: { select: { creneau: { select: { durationCourse: true } } } } },
        },
      },
    });
    const primaryMinutes = monthSessions.reduce((sum, row) => {
      const minutes =
        row.teaching.classe?.creneau?.durationCourse &&
        row.teaching.classe.creneau.durationCourse > 0
          ? row.teaching.classe.creneau.durationCourse
          : (policy?.primarySessionMinutes ?? 30);
      return sum + minutes;
    }, 0);
    const forfait =
      teacher.employmentKind === "MATRICULE"
        ? (policy?.primaryMatriculeMonthly ?? 15000)
        : (policy?.primaryNonMatriculeMonthly ?? 70000);
    const ratePerMinute = primaryMinutes > 0 ? forfait / primaryMinutes : 0;
    estimate = ratePerMinute * lost;
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
            ? cycle === "PRIMAIRE"
              ? "absence non justifiée : retenue au prorata du forfait mensuel (taux à la minute)"
              : "absence non justifiée : retenue de la séance"
            : input.status === "EARLY_EXIT"
              ? "minutes non effectuées jusqu'à la fin de la séance"
              : `minutes au-delà de la franchise de ${grace} min`,
        organizationId: input.organizationId,
      }).catch((error) => {
        console.error("PAYROLL_EMAIL_ERROR", error);
      });
  }
}

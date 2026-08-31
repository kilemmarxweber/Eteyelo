import "server-only";

import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getBaseCurrency,
  getQuoteCurrency,
  roundCurrency,
} from "@/lib/exchange-rate";

const SCHOOL_CYCLES = new Set(["PRIMAIRE", "SECONDAIRE"]);

export type PayrollPeriod = {
  year: number;
  month: number;
  schoolYearId?: string | null;
};

type Policy = {
  id: string;
  secondarySessionMinutes: number;
  primarySessionMinutes: number;
  secondaryHourlyRate: number;
  secondaryMatriculePrimePercent: number;
  secondaryNonMatriculeSessionRate: number;
  primaryMatriculeMonthly: number;
  primaryNonMatriculeMonthly: number;
  lateGraceMinutes: number;
  notifyByEmail: boolean;
};

type SessionDetail = {
  sessionId: string;
  occurredOn: Date;
  cycle: "PRIMAIRE" | "SECONDAIRE";
  className: string;
  courseName: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
  durationMinutes: number;
  lostMinutes: number;
  deduction: number;
  gross: number;
  reason: "ABSENCE" | "LATE" | "EARLY_EXIT" | null;
};

export type TeacherPayrollResult = {
  teacherId: string;
  teacherName: string;
  employmentKind: "MATRICULE" | "NON_MATRICULE";
  matriculeEtat: string | null;
  year: number;
  month: number;
  schoolYearId: string | null;
  currency: CurrencyCode;
  quoteCurrency: CurrencyCode | null;
  exchangeRateId: string | null;
  rateSnapshot: number | null;
  missingExchangeRate: boolean;
  policy: Policy;
  gross: number;
  deductions: number;
  net: number;
  sessions: number;
  heldSessions: number;
  lateSessions: number;
  justifiedAbsences: number;
  unjustifiedAbsences: number;
  plannedMinutes: number;
  lostMinutes: number;
  details: SessionDetail[];
};

function periodBounds(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

function roundInternal(value: number) {
  return Math.round(value * 10) / 10;
}

function sessionMinutes(start: Date, end: Date, fallback: number) {
  const actual = (end.getTime() - start.getTime()) / 60000;
  return actual > 0 ? actual : fallback;
}

function teacherDisplayName(teacher: {
  branchMember?: { member?: { user?: { name?: string | null; postnom?: string | null; prenom?: string | null } | null } | null } | null;
}) {
  const user = teacher.branchMember?.member?.user;
  return [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ") || "Enseignant";
}

async function getPolicy(branchId: string): Promise<Policy> {
  return prisma.branchPayrollPolicy.upsert({
    where: { branchId },
    create: { branchId },
    update: {},
    select: {
      id: true,
      secondarySessionMinutes: true,
      primarySessionMinutes: true,
      secondaryHourlyRate: true,
      secondaryMatriculePrimePercent: true,
      secondaryNonMatriculeSessionRate: true,
      primaryMatriculeMonthly: true,
      primaryNonMatriculeMonthly: true,
      lateGraceMinutes: true,
      notifyByEmail: true,
    },
  });
}

async function getCurrencySnapshot(organizationId: string) {
  const rates = await prisma.exchangeRate.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      fromCurrency: true,
      toCurrency: true,
      rate: true,
      isActive: true,
      isSelected: true,
    },
  });
  const selected = rates.find((rate) => rate.isSelected && rate.isActive);
  return {
    currency: getBaseCurrency(rates),
    quoteCurrency: getQuoteCurrency(rates),
    rateSnapshot: selected?.rate ?? null,
    exchangeRateId: selected?.id ?? null,
    missingExchangeRate: !selected,
  };
}

export async function calculateTeacherPayroll(input: {
  branchId: string;
  organizationId: string;
  teacherId: string;
  period: PayrollPeriod;
}) {
  if (input.period.month < 1 || input.period.month > 12) {
    throw new Error("Le mois doit être compris entre 1 et 12");
  }

  const [teacher, policy, currencySnapshot] = await Promise.all([
    prisma.teacher.findFirst({
      where: {
        id: input.teacherId,
        isActive: true,
        branchMember: { branchId: input.branchId },
      },
      select: {
        id: true,
        employmentKind: true,
        matriculeEtat: true,
        branchMember: {
          select: {
            member: {
              select: { user: { select: { name: true, postnom: true, prenom: true } } },
            },
          },
        },
      },
    }),
    getPolicy(input.branchId),
    getCurrencySnapshot(input.organizationId),
  ]);

  if (!teacher) throw new Error("Enseignant introuvable dans cette branche");

  const { start, end } = periodBounds(input.period.year, input.period.month);
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      branchId: input.branchId,
      date: { gte: start, lt: end },
      ...(input.period.schoolYearId ? { schoolYearId: input.period.schoolYearId } : {}),
      teaching: { teacherId: input.teacherId, branchId: input.branchId },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      teaching: {
        select: {
          classe: { select: { nameClasse: true, cycle: true, creneau: { select: { durationCourse: true } } } },
          cours: { select: { nameCours: true } },
          schoolYearId: true,
        },
      },
      teacherAttendance: {
        where: { teacherId: input.teacherId },
        select: {
          status: true,
          checkIn: true,
          checkOut: true,
          earlyExit: true,
          absenceCase: { select: { status: true } },
        },
      },
    },
  });

  const details: SessionDetail[] = [];
  let primaryPlannedMinutes = 0;
  let primaryLostMinutes = 0;
  let primarySessions = 0;
  let primaryHeldSessions = 0;
  let primaryLateSessions = 0;
  let primaryJustifiedAbsences = 0;
  let primaryUnjustifiedAbsences = 0;
  let secondaryGross = 0;
  let secondaryDeductions = 0;
  let secondarySessions = 0;
  let secondaryHeldSessions = 0;
  let secondaryLateSessions = 0;
  let secondaryJustifiedAbsences = 0;
  let secondaryUnjustifiedAbsences = 0;

  for (const session of sessions) {
    const cycle = session.teaching.classe?.cycle;
    if (!cycle || !SCHOOL_CYCLES.has(cycle)) continue;
    const payrollCycle = cycle as "PRIMAIRE" | "SECONDAIRE";
    const fallbackDuration =
      payrollCycle === "PRIMAIRE"
        ? policy.primarySessionMinutes
        : policy.secondarySessionMinutes;
    const duration = sessionMinutes(
      session.startTime,
      session.endTime,
      session.teaching.classe?.creneau?.durationCourse ?? fallbackDuration,
    );
    const attendance = session.teacherAttendance[0];
    const status = (attendance?.status ?? "ABSENT") as SessionDetail["status"];
    const justified =
      status === "EXCUSED" || attendance?.absenceCase?.status === "ACCEPTED";
    const lateMinutes =
      attendance?.checkIn && status === "LATE"
        ? Math.max(
            0,
            (attendance.checkIn.getTime() - session.startTime.getTime()) / 60000 -
              policy.lateGraceMinutes,
          )
        : 0;
    const earlyExitMinutes =
      attendance?.earlyExit && attendance.checkOut
        ? Math.max(
            0,
            (session.endTime.getTime() - attendance.checkOut.getTime()) / 60000,
          )
        : 0;
    const lost = justified
      ? 0
      : status === "ABSENT"
        ? duration
        : Math.min(duration, Math.max(0, lateMinutes) + Math.max(0, earlyExitMinutes));
    const reason =
      lost <= 0
        ? null
        : status === "ABSENT"
          ? "ABSENCE"
          : earlyExitMinutes > 0
            ? "EARLY_EXIT"
            : "LATE";
    const isHeld = status !== "ABSENT" || justified;
    const sessionGross =
      payrollCycle === "SECONDAIRE"
        ? teacher.employmentKind === "MATRICULE"
          ? policy.secondaryHourlyRate *
            (policy.secondaryMatriculePrimePercent / 100) *
            (duration / 60)
          : policy.secondaryNonMatriculeSessionRate
        : 0;
    const sessionDeduction =
      payrollCycle === "SECONDAIRE"
        ? sessionGross * (lost / duration)
        : 0;

    if (payrollCycle === "PRIMAIRE") {
      primarySessions += 1;
      primaryPlannedMinutes += duration;
      primaryLostMinutes += lost;
      if (isHeld) primaryHeldSessions += 1;
      if (status === "LATE") primaryLateSessions += 1;
      if (justified && status === "ABSENT") primaryJustifiedAbsences += 1;
      if (!justified && status === "ABSENT") primaryUnjustifiedAbsences += 1;
    } else {
      secondarySessions += 1;
      secondaryGross += sessionGross;
      secondaryDeductions += sessionDeduction;
      if (isHeld) secondaryHeldSessions += 1;
      if (status === "LATE") secondaryLateSessions += 1;
      if (justified && status === "ABSENT") secondaryJustifiedAbsences += 1;
      if (!justified && status === "ABSENT") secondaryUnjustifiedAbsences += 1;
    }

    details.push({
      sessionId: session.id,
      occurredOn: session.date,
      cycle: payrollCycle,
      className: session.teaching.classe?.nameClasse ?? "Classe",
      courseName: session.teaching.cours.nameCours,
      status,
      durationMinutes: roundInternal(duration),
      lostMinutes: roundInternal(lost),
      deduction: roundCurrency(sessionDeduction, currencySnapshot.currency),
      gross: roundCurrency(sessionGross, currencySnapshot.currency),
      reason,
    });
  }

  const primaryGross =
    primarySessions > 0
      ? teacher.employmentKind === "MATRICULE"
        ? policy.primaryMatriculeMonthly
        : policy.primaryNonMatriculeMonthly
      : 0;
  const primaryDeductions =
    primaryPlannedMinutes > 0
      ? primaryGross * (primaryLostMinutes / primaryPlannedMinutes)
      : 0;
  const gross = roundCurrency(primaryGross + secondaryGross, currencySnapshot.currency);
  const deductions = roundCurrency(
    Math.min(gross, primaryDeductions + secondaryDeductions),
    currencySnapshot.currency,
  );

  return {
    teacherId: teacher.id,
    teacherName: teacherDisplayName(teacher),
    employmentKind: teacher.employmentKind,
    matriculeEtat: teacher.matriculeEtat,
    year: input.period.year,
    month: input.period.month,
    schoolYearId: input.period.schoolYearId ?? sessions[0]?.teaching.schoolYearId ?? null,
    currency: currencySnapshot.currency,
    quoteCurrency: currencySnapshot.quoteCurrency,
    rateSnapshot: currencySnapshot.rateSnapshot,
    exchangeRateId: currencySnapshot.exchangeRateId,
    missingExchangeRate: currencySnapshot.missingExchangeRate,
    policy,
    gross,
    deductions,
    net: roundCurrency(Math.max(0, gross - deductions), currencySnapshot.currency),
    sessions: primarySessions + secondarySessions,
    heldSessions: primaryHeldSessions + secondaryHeldSessions,
    lateSessions: primaryLateSessions + secondaryLateSessions,
    justifiedAbsences: primaryJustifiedAbsences + secondaryJustifiedAbsences,
    unjustifiedAbsences: primaryUnjustifiedAbsences + secondaryUnjustifiedAbsences,
    plannedMinutes: roundInternal(primaryPlannedMinutes + details.filter((d) => d.cycle === "SECONDAIRE").reduce((sum, d) => sum + d.durationMinutes, 0)),
    lostMinutes: roundInternal(primaryLostMinutes + details.reduce((sum, d) => sum + (d.cycle === "SECONDAIRE" ? d.lostMinutes : 0), 0)),
    details,
  };
}

export async function persistTeacherPayroll(
  input: {
    branchId: string;
    organizationId: string;
    period: PayrollPeriod;
    teacherId: string;
  },
  result: Awaited<ReturnType<typeof calculateTeacherPayroll>>,
) {
  const existing = await prisma.teacherPayslip.findUnique({
    where: {
      branchId_teacherId_year_month: {
        branchId: input.branchId,
        teacherId: input.teacherId,
        year: input.period.year,
        month: input.period.month,
      },
    },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== "DRAFT") {
    throw new Error("Ce bulletin est déjà validé ou payé");
  }

  const data = {
    branchId: input.branchId,
    teacherId: input.teacherId,
    schoolYearId: result.schoolYearId,
    policyId: result.policy.id,
    year: result.year,
    month: result.month,
    status: "DRAFT" as const,
    currency: result.currency,
    quoteCurrency: result.quoteCurrency,
    exchangeRateId: result.exchangeRateId,
    rateSnapshot: result.rateSnapshot,
    gross: result.gross,
    deductions: result.deductions,
    net: result.net,
    policySnapshot: result.policy,
    generatedAt: new Date(),
  };

  return prisma.$transaction(async (tx) => {
    const payslip = existing
      ? await tx.teacherPayslip.update({ where: { id: existing.id }, data })
      : await tx.teacherPayslip.create({ data });
    await tx.teacherPayslipLine.deleteMany({ where: { payslipId: payslip.id } });

    const lines: Prisma.TeacherPayslipLineCreateManyInput[] = result.details.map((detail) => ({
      payslipId: payslip.id,
      cycle: detail.cycle,
      kind: (detail.reason === "ABSENCE"
        ? "ABSENCE"
        : detail.reason === "LATE"
          ? "LATE"
          : detail.reason === "EARLY_EXIT"
            ? "EARLY_EXIT"
            : "GROSS") as Prisma.TeacherPayslipLineCreateManyInput["kind"],
      occurredOn: detail.occurredOn,
      sessionId: detail.sessionId,
      label: `${detail.className} · ${detail.courseName} · ${detail.status}`,
      sessions: 1,
      minutes: detail.lostMinutes,
      amount: detail.reason ? detail.deduction : detail.gross,
    }));
    if (result.details.some((detail) => detail.cycle === "PRIMAIRE")) {
      lines.unshift({
        payslipId: payslip.id,
        cycle: "PRIMAIRE",
        kind: "GROSS",
        occurredOn: undefined,
        sessionId: undefined,
        label: "Forfait mensuel primaire",
        sessions: result.details.filter((detail) => detail.cycle === "PRIMAIRE").length,
        minutes: result.details.filter((detail) => detail.cycle === "PRIMAIRE").reduce((sum, detail) => sum + detail.durationMinutes, 0),
        amount:
          result.gross -
          result.details
            .filter((detail) => detail.cycle === "SECONDAIRE")
            .reduce((sum, detail) => sum + detail.gross, 0),
      });
    }
    if (lines.length > 0) await tx.teacherPayslipLine.createMany({ data: lines });
    return payslip;
  });
}

import "server-only";

import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getBaseCurrency,
  getQuoteCurrency,
  roundCurrency,
} from "@/lib/exchange-rate";
import {
  billableLateMinutes,
  contractualSessionMinutes,
  isPayrollWeekendDate,
  monthlyMinutesFromWeeklyVolume,
  primaryUnitRates,
  rawLateMinutes,
  secondaryMatriculeRates,
  secondaryNonMatriculeRates,
  sessionGrossFromRate,
  weeklyVolumeFromScheduleSlots,
  monthlySessionsFromWeeklyVolume,
  payrollSessionAmount,
  type WeeklyPrimaryVolume,
} from "@/lib/payroll/primary-volume";
import {
  allocateSessionGross,
  sessionLossAmount,
  settlePayrollTotals,
} from "@/lib/payroll/session-rate";
import type { TeacherPayslipLineDetailSnapshot } from "@/lib/payroll/teacher-payslip-line-detail";
import { waivedSessionIdsFromLines } from "@/lib/payroll/teacher-payslip-line-detail";
import type { PersonnelPayrollResult } from "@/lib/payroll/personnel-payroll";

export type { TeacherPayslipLineDetailSnapshot } from "@/lib/payroll/teacher-payslip-line-detail";

const SCHOOL_CYCLES = new Set(["PRIMAIRE", "SECONDAIRE", "MATERNELLE"]);
type PayrollCycle = "PRIMAIRE" | "SECONDAIRE" | "MATERNELLE";

export type PayrollPeriod = {
  year: number;
  month: number;
  schoolYearId?: string | null;
};

type Policy = {
  id: string;
  secondarySessionMinutes: number;
  primarySessionMinutes: number;
  maternelleSessionMinutes: number;
  secondaryHourlyRate: number;
  secondaryMatriculePrimePercent: number;
  secondaryNonMatriculeSessionRate: number;
  primaryMatriculeMonthly: number;
  primaryNonMatriculeMonthly: number;
  maternelleMatriculeMonthly: number;
  maternelleNonMatriculeMonthly: number;
  personnelDayMinutes: number;
  personnelScales: unknown;
  lateGraceMinutes: number;
  notifyByEmail: boolean;
};

type SessionDetail = {
  sessionId: string;
  occurredOn: Date;
  cycle: PayrollCycle;
  className: string;
  courseName: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  lateMinutes: number;
  earlyExitMinutes: number;
  lostMinutes: number;
  checkIn: Date | null;
  checkOut: Date | null;
  graceMinutes: number;
  deduction: number;
  gross: number;
  reason: "ABSENCE" | "LATE" | "EARLY_EXIT" | null;
  lateWithinGrace?: boolean;
  waived?: boolean;
  waivedAmount?: number;
};

export type TeacherPayrollResult = {
  teacherId: string;
  branchMemberId: string;
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
  /** Minutes prévues / semaine (horaire Lun–Ven du cycle affiché). */
  weeklyPlannedMinutes: number;
  /** Séances prévues / semaine sur l’horaire (primaire ou secondaire). */
  weeklySessions: number;
  secondaryWeeklyPlannedMinutes: number;
  secondaryWeeklySessions: number;
  maternelleWeeklyPlannedMinutes: number;
  maternelleWeeklySessions: number;
  /** Taux de retenue par minute. */
  ratePerMinute: number;
  /** Valeur réelle d’une séance. */
  ratePerSession: number;
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

/** Durée contractuelle : créneau (30 min primaire / 45 min secondaire). */
function plannedSessionMinutes(
  creneauDuration: number | null | undefined,
  policyMinutes: number,
  fallback: number,
) {
  return contractualSessionMinutes(creneauDuration, policyMinutes, fallback);
}

function forfaitCycleMinutes(cycle: PayrollCycle, policy: Policy) {
  if (cycle === "MATERNELLE") return policy.maternelleSessionMinutes;
  if (cycle === "PRIMAIRE") return policy.primarySessionMinutes;
  return policy.secondarySessionMinutes;
}

function forfaitCycleFallback(cycle: PayrollCycle) {
  return cycle === "SECONDAIRE" ? 45 : 30;
}

function forfaitMonthlyAmount(
  cycle: "PRIMAIRE" | "MATERNELLE",
  employmentKind: "MATRICULE" | "NON_MATRICULE",
  policy: Policy,
) {
  if (cycle === "MATERNELLE") {
    return employmentKind === "MATRICULE"
      ? policy.maternelleMatriculeMonthly
      : policy.maternelleNonMatriculeMonthly;
  }
  return employmentKind === "MATRICULE"
    ? policy.primaryMatriculeMonthly
    : policy.primaryNonMatriculeMonthly;
}

function applyForfaitToDetails(
  details: SessionDetail[],
  weekly: WeeklyPrimaryVolume,
  year: number,
  month: number,
  forfait: number,
  sessionMinutes: number,
  currency: CurrencyCode,
) {
  const monthlyFromSchedule = monthlyMinutesFromWeeklyVolume(weekly, year, month);
  const plannedMinutes = details.reduce((sum, detail) => sum + detail.durationMinutes, 0);
  const monthlyMinutes =
    monthlyFromSchedule > 0 ? monthlyFromSchedule : plannedMinutes;
  const rates = primaryUnitRates(forfait, monthlyMinutes, sessionMinutes, currency);
  let deductions = 0;
  if (monthlyFromSchedule > 0) {
    for (const detail of details) {
      const sessionGross = sessionGrossFromRate(
        rates.ratePerMinute,
        detail.durationMinutes,
        currency,
      );
      detail.gross = sessionGross;
      detail.deduction = sessionLossAmount(
        sessionGross,
        detail.lostMinutes,
        detail.durationMinutes,
        currency,
      );
      deductions += detail.deduction;
    }
  } else {
    const allocated = allocateSessionGross(
      forfait,
      details.map((detail) => detail.durationMinutes),
      currency,
    );
    details.forEach((detail, index) => {
      const sessionGross = allocated[index] ?? 0;
      detail.gross = sessionGross;
      detail.deduction = sessionLossAmount(
        sessionGross,
        detail.lostMinutes,
        detail.durationMinutes,
        currency,
      );
      deductions += detail.deduction;
    });
  }
  return { deductions, rates };
}

function weeklyMinutesFromVolume(
  weekly: WeeklyPrimaryVolume,
  plannedMinutes: number,
  year: number,
  month: number,
) {
  if (weekly.minutes > 0) return weekly.minutes;
  if (plannedMinutes > 0) {
    return plannedMinutes / weeksInCalendarMonth(year, month);
  }
  return 0;
}

function weeksInCalendarMonth(year: number, month: number) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.max(1, days / 7);
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
      maternelleSessionMinutes: true,
      maternelleMatriculeMonthly: true,
      maternelleNonMatriculeMonthly: true,
      personnelDayMinutes: true,
      personnelScales: true,
      lateGraceMinutes: true,
      notifyByEmail: true,
    },
  });
}

export async function getBranchPayrollContext(
  branchId: string,
  organizationId: string,
) {
  const [policy, currencySnapshot] = await Promise.all([
    getPolicy(branchId),
    getCurrencySnapshot(organizationId),
  ]);
  return { policy, ...currencySnapshot };
}

export async function loadTeacherWeeklyVolume(input: {
  branchId: string;
  teacherId: string;
  schoolYearId?: string | null;
  cycle: PayrollCycle;
  fallbackMinutes: number;
}): Promise<WeeklyPrimaryVolume> {
  const slots = await prisma.schedule.findMany({
    where: {
      isArchived: false,
      teaching: {
        teacherId: input.teacherId,
        branchId: input.branchId,
        classe: { cycle: input.cycle },
        ...(input.schoolYearId ? { schoolYearId: input.schoolYearId } : {}),
      },
    },
    select: {
      day: true,
      teaching: {
        select: { classe: { select: { creneau: { select: { durationCourse: true } } } } },
      },
    },
  });
  return weeklyVolumeFromScheduleSlots(
    slots.map((slot) => ({
      day: slot.day,
      durationMinutes: plannedSessionMinutes(
        slot.teaching?.classe?.creneau?.durationCourse,
        input.fallbackMinutes,
        input.cycle === "SECONDAIRE" ? 45 : 30,
      ),
    })),
  );
}

export async function loadPrimaryWeeklyVolume(input: {
  branchId: string;
  teacherId: string;
  schoolYearId?: string | null;
  fallbackMinutes: number;
}): Promise<WeeklyPrimaryVolume> {
  return loadTeacherWeeklyVolume({ ...input, cycle: "PRIMAIRE" });
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
}): Promise<TeacherPayrollResult> {
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
        branchMemberId: true,
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
  if (!teacher.branchMemberId) {
    throw new Error("Enseignant sans rattachement de branche");
  }

  const { start, end } = periodBounds(input.period.year, input.period.month);
  const [sessions, primaryWeekly, secondaryWeekly, maternelleWeekly] = await Promise.all([
    prisma.attendanceSession.findMany({
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
  }),
    loadTeacherWeeklyVolume({
      branchId: input.branchId,
      teacherId: input.teacherId,
      schoolYearId: input.period.schoolYearId,
      cycle: "PRIMAIRE",
      fallbackMinutes: policy.primarySessionMinutes,
    }),
    loadTeacherWeeklyVolume({
      branchId: input.branchId,
      teacherId: input.teacherId,
      schoolYearId: input.period.schoolYearId,
      cycle: "SECONDAIRE",
      fallbackMinutes: policy.secondarySessionMinutes,
    }),
    loadTeacherWeeklyVolume({
      branchId: input.branchId,
      teacherId: input.teacherId,
      schoolYearId: input.period.schoolYearId,
      cycle: "MATERNELLE",
      fallbackMinutes: policy.maternelleSessionMinutes,
    }),
  ]);

  const details: SessionDetail[] = [];
  let primaryPlannedMinutes = 0;
  let primaryLostMinutes = 0;
  let primarySessions = 0;
  let primaryHeldSessions = 0;
  let primaryLateSessions = 0;
  let primaryJustifiedAbsences = 0;
  let primaryUnjustifiedAbsences = 0;
  let maternellePlannedMinutes = 0;
  let maternelleLostMinutes = 0;
  let maternelleSessions = 0;
  let maternelleHeldSessions = 0;
  let maternelleLateSessions = 0;
  let maternelleJustifiedAbsences = 0;
  let maternelleUnjustifiedAbsences = 0;
  let secondaryGross = 0;
  let secondaryDeductions = 0;
  let secondarySessions = 0;
  let secondaryHeldSessions = 0;
  let secondaryLateSessions = 0;
  let secondaryJustifiedAbsences = 0;
  let secondaryUnjustifiedAbsences = 0;
  const sessionAmount = payrollSessionAmount(policy);

  for (const session of sessions) {
    const cycle = session.teaching.classe?.cycle;
    if (!cycle || !SCHOOL_CYCLES.has(cycle)) continue;
    const payrollCycle = cycle as PayrollCycle;
    if (isPayrollWeekendDate(session.date)) continue;
    const creneauDuration = session.teaching.classe?.creneau?.durationCourse;
    const duration = plannedSessionMinutes(
      creneauDuration,
      forfaitCycleMinutes(payrollCycle, policy),
      forfaitCycleFallback(payrollCycle),
    );
    const attendance = session.teacherAttendance[0];
    const status = (attendance?.status ?? "ABSENT") as SessionDetail["status"];
    const justified =
      status === "EXCUSED" || attendance?.absenceCase?.status === "ACCEPTED";
    const rawLate = rawLateMinutes(attendance?.checkIn, session.startTime);
    const lateMinutes = billableLateMinutes(rawLate, policy.lateGraceMinutes);
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
    const payrollStatus: SessionDetail["status"] =
      status === "ABSENT" || status === "EXCUSED"
        ? status
        : rawLate > 0 || status === "LATE"
          ? "LATE"
          : status;
    const lateWithinGrace =
      !justified &&
      payrollStatus === "LATE" &&
      lost <= 0 &&
      rawLate > 0;
    const reason: SessionDetail["reason"] =
      lost > 0
        ? status === "ABSENT"
          ? "ABSENCE"
          : earlyExitMinutes > 0
            ? "EARLY_EXIT"
            : "LATE"
        : lateWithinGrace
          ? "LATE"
          : null;
    const isHeld = status !== "ABSENT" || justified;
    const secondarySessionGross =
      payrollCycle === "SECONDAIRE"
        ? teacher.employmentKind === "MATRICULE"
          ? sessionAmount * (policy.secondaryMatriculePrimePercent / 100)
          : sessionAmount
        : 0;
    const roundedSecondaryGross =
      payrollCycle === "SECONDAIRE"
        ? roundCurrency(secondarySessionGross, currencySnapshot.currency)
        : 0;
    const secondaryDeduction =
      payrollCycle === "SECONDAIRE"
        ? sessionLossAmount(
            roundedSecondaryGross,
            lost,
            duration,
            currencySnapshot.currency,
          )
        : 0;

    if (payrollCycle === "PRIMAIRE") {
      primarySessions += 1;
      primaryPlannedMinutes += duration;
      primaryLostMinutes += lost;
      if (isHeld) primaryHeldSessions += 1;
      if (payrollStatus === "LATE") primaryLateSessions += 1;
      if (justified && status === "ABSENT") primaryJustifiedAbsences += 1;
      if (!justified && status === "ABSENT") primaryUnjustifiedAbsences += 1;
    } else if (payrollCycle === "MATERNELLE") {
      maternelleSessions += 1;
      maternellePlannedMinutes += duration;
      maternelleLostMinutes += lost;
      if (isHeld) maternelleHeldSessions += 1;
      if (payrollStatus === "LATE") maternelleLateSessions += 1;
      if (justified && status === "ABSENT") maternelleJustifiedAbsences += 1;
      if (!justified && status === "ABSENT") maternelleUnjustifiedAbsences += 1;
    } else {
      secondarySessions += 1;
      secondaryGross += roundedSecondaryGross;
      secondaryDeductions += secondaryDeduction;
      if (isHeld) secondaryHeldSessions += 1;
      if (payrollStatus === "LATE") secondaryLateSessions += 1;
      if (justified && status === "ABSENT") secondaryJustifiedAbsences += 1;
      if (!justified && status === "ABSENT") secondaryUnjustifiedAbsences += 1;
    }

    details.push({
      sessionId: session.id,
      occurredOn: session.date,
      cycle: payrollCycle,
      className: session.teaching.classe?.nameClasse ?? "Classe",
      courseName: session.teaching.cours.nameCours,
      status: payrollStatus,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: roundInternal(duration),
      lateMinutes: roundInternal(rawLate),
      earlyExitMinutes: roundInternal(earlyExitMinutes),
      lostMinutes: roundInternal(lost),
      checkIn: attendance?.checkIn ?? null,
      checkOut: attendance?.checkOut ?? null,
      graceMinutes: policy.lateGraceMinutes,
      deduction: secondaryDeduction,
      gross: roundedSecondaryGross,
      reason,
      lateWithinGrace,
    });
  }

  // Forfait primaire : 70 000 (ou 15 000) ÷ minutes dues du mois (horaire Lun–Ven).
  // Une séance de 30 min a un coût réel ; une absence retranche uniquement ce coût.
  const primaryGross =
    primarySessions > 0
      ? forfaitMonthlyAmount("PRIMAIRE", teacher.employmentKind, policy)
      : 0;
  const primaryDetails = details.filter((detail) => detail.cycle === "PRIMAIRE");
  const { deductions: primaryDeductions, rates: primaryRates } = applyForfaitToDetails(
    primaryDetails,
    primaryWeekly,
    input.period.year,
    input.period.month,
    primaryGross,
    policy.primarySessionMinutes,
    currencySnapshot.currency,
  );
  const weeklyPlannedMinutes = weeklyMinutesFromVolume(
    primaryWeekly,
    primaryPlannedMinutes,
    input.period.year,
    input.period.month,
  );

  const maternelleGross =
    maternelleSessions > 0
      ? forfaitMonthlyAmount("MATERNELLE", teacher.employmentKind, policy)
      : 0;
  const maternelleDetails = details.filter((detail) => detail.cycle === "MATERNELLE");
  const { deductions: maternelleDeductions, rates: maternelleRates } =
    applyForfaitToDetails(
      maternelleDetails,
      maternelleWeekly,
      input.period.year,
      input.period.month,
      maternelleGross,
      policy.maternelleSessionMinutes,
      currencySnapshot.currency,
    );
  const maternelleWeeklyMinutes = weeklyMinutesFromVolume(
    maternelleWeekly,
    maternellePlannedMinutes,
    input.period.year,
    input.period.month,
  );

  const secondaryDetails = details.filter((detail) => detail.cycle === "SECONDAIRE");
  const secondaryPlanned = secondaryDetails.reduce(
    (sum, detail) => sum + detail.durationMinutes,
    0,
  );
  const secondaryLost = secondaryDetails.reduce(
    (sum, detail) => sum + detail.lostMinutes,
    0,
  );
  const secondaryMonthlySessions = monthlySessionsFromWeeklyVolume(
    secondaryWeekly,
    input.period.year,
    input.period.month,
  );
  const secondaryRates =
    teacher.employmentKind === "MATRICULE"
      ? secondaryMatriculeRates(
          sessionAmount,
          policy.secondaryMatriculePrimePercent,
          policy.secondarySessionMinutes,
          currencySnapshot.currency,
        )
      : secondaryNonMatriculeRates(
          sessionAmount,
          policy.secondarySessionMinutes,
          currencySnapshot.currency,
        );
  if (teacher.employmentKind === "MATRICULE" && secondaryMonthlySessions > 0) {
    secondaryGross = roundCurrency(
      secondaryMonthlySessions * secondaryRates.ratePerSession,
      currencySnapshot.currency,
    );
    secondaryDeductions = 0;
    for (const detail of secondaryDetails) {
      const sessionGross = sessionGrossFromRate(
        secondaryRates.ratePerMinute,
        detail.durationMinutes,
        currencySnapshot.currency,
      );
      detail.gross = sessionGross;
      detail.deduction = sessionLossAmount(
        sessionGross,
        detail.lostMinutes,
        detail.durationMinutes,
        currencySnapshot.currency,
      );
      secondaryDeductions += detail.deduction;
    }
  }

  const displayWeeklyMinutes =
    weeklyPlannedMinutes > 0
      ? weeklyPlannedMinutes
      : maternelleWeeklyMinutes > 0
        ? maternelleWeeklyMinutes
        : secondaryWeekly.minutes > 0
          ? secondaryWeekly.minutes
          : secondaryPlanned > 0
            ? secondaryPlanned /
              weeksInCalendarMonth(input.period.year, input.period.month)
            : 0;
  const displayWeeklySessions =
    primaryWeekly.sessions > 0
      ? primaryWeekly.sessions
      : maternelleWeekly.sessions > 0
        ? maternelleWeekly.sessions
        : secondaryWeekly.sessions;
  const displayRatePerMinute =
    primarySessions > 0
      ? primaryRates.ratePerMinute
      : maternelleSessions > 0
        ? maternelleRates.ratePerMinute
        : secondaryRates.ratePerMinute;
  const displayRatePerSession =
    primarySessions > 0
      ? primaryRates.ratePerSession
      : maternelleSessions > 0
        ? maternelleRates.ratePerSession
        : secondaryRates.ratePerSession;

  const settled = settlePayrollTotals(
    primaryGross + maternelleGross + secondaryGross,
    primaryDeductions + maternelleDeductions + secondaryDeductions,
    currencySnapshot.currency,
  );

  return {
    teacherId: teacher.id,
    branchMemberId: teacher.branchMemberId,
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
    gross: settled.gross,
    deductions: settled.deductions,
    net: settled.net,
    sessions: primarySessions + maternelleSessions + secondarySessions,
    heldSessions: primaryHeldSessions + maternelleHeldSessions + secondaryHeldSessions,
    lateSessions: primaryLateSessions + maternelleLateSessions + secondaryLateSessions,
    justifiedAbsences:
      primaryJustifiedAbsences +
      maternelleJustifiedAbsences +
      secondaryJustifiedAbsences,
    unjustifiedAbsences:
      primaryUnjustifiedAbsences +
      maternelleUnjustifiedAbsences +
      secondaryUnjustifiedAbsences,
    plannedMinutes: roundInternal(
      primaryPlannedMinutes + maternellePlannedMinutes + secondaryPlanned,
    ),
    lostMinutes: roundInternal(
      primaryLostMinutes + maternelleLostMinutes + secondaryLost,
    ),
    weeklyPlannedMinutes: roundInternal(displayWeeklyMinutes),
    weeklySessions: displayWeeklySessions,
    secondaryWeeklyPlannedMinutes: roundInternal(
      secondaryWeekly.minutes > 0
        ? secondaryWeekly.minutes
        : secondaryPlanned > 0
          ? secondaryPlanned /
            weeksInCalendarMonth(input.period.year, input.period.month)
          : 0,
    ),
    secondaryWeeklySessions: secondaryWeekly.sessions,
    maternelleWeeklyPlannedMinutes: roundInternal(maternelleWeeklyMinutes),
    maternelleWeeklySessions: maternelleWeekly.sessions,
    ratePerMinute: roundInternal(displayRatePerMinute * 1000) / 1000,
    ratePerSession: displayRatePerSession,
    details,
  };
}

export async function persistTeacherPayroll(
  input: {
    branchId: string;
    organizationId: string;
    period: PayrollPeriod;
    branchMemberId?: string;
    teacherId?: string | null;
    personnelId?: string | null;
    agentKind?: "TEACHER" | "PERSONNEL" | "BOTH";
    personnelPayroll?: PersonnelPayrollResult | null;
    personnelRoleLabel?: string | null;
    waivedSessionIds?: string[];
  },
  result: TeacherPayrollResult,
) {
  const branchMemberId = input.branchMemberId || result.branchMemberId;
  if (!branchMemberId) {
    throw new Error("Agent sans rattachement de branche");
  }
  const teacherId = input.teacherId || result.teacherId || null;
  const personnelPayroll = input.personnelPayroll ?? null;
  const personnelGross = Math.max(
    0,
    (personnelPayroll?.gross ?? 0) + (personnelPayroll?.prime ?? 0),
  );
  const agentKind =
    input.agentKind ??
    (teacherId && personnelGross > 0
      ? "BOTH"
      : teacherId
        ? "TEACHER"
        : "PERSONNEL");

  const existing = await prisma.teacherPayslip.findUnique({
    where: {
      branchId_branchMemberId_year_month: {
        branchId: input.branchId,
        branchMemberId,
        year: input.period.year,
        month: input.period.month,
      },
    },
    select: {
      id: true,
      status: true,
      lines: { select: { sessionId: true, detail: true } },
    },
  });
  if (existing && existing.status !== "DRAFT") {
    throw new Error("Ce bulletin est déjà validé ou payé");
  }

  const waivedSessionIds = new Set([
    ...(input.waivedSessionIds ?? []),
    ...waivedSessionIdsFromLines(existing?.lines ?? []),
  ]);
  if (waivedSessionIds.size > 0) {
    let teacherWaived = 0;
    for (const detail of result.details) {
      if (!waivedSessionIds.has(detail.sessionId) || detail.deduction <= 0) continue;
      detail.waived = true;
      detail.waivedAmount = detail.deduction;
      teacherWaived += detail.deduction;
      detail.deduction = 0;
    }
    if (teacherWaived > 0) {
      const settled = settlePayrollTotals(
        result.gross,
        result.deductions - teacherWaived,
        result.currency,
      );
      result.deductions = settled.deductions;
      result.net = settled.net;
    }
    if (personnelPayroll) {
      for (const day of personnelPayroll.days) {
        if (!waivedSessionIds.has(day.sessionId) || day.deduction <= 0) continue;
        day.waived = true;
        day.waivedAmount = day.deduction;
        day.deduction = 0;
      }
      const personnelSettled = settlePayrollTotals(
        personnelGross,
        personnelPayroll.days.reduce((sum, day) => sum + day.deduction, 0),
        result.currency,
      );
      personnelPayroll.deductions = personnelSettled.deductions;
      personnelPayroll.net = personnelSettled.net;
    }
  }

  const combined = settlePayrollTotals(
    result.gross + personnelGross,
    result.deductions + (personnelPayroll?.deductions ?? 0),
    result.currency,
  );

  const data = {
    branchId: input.branchId,
    branchMemberId,
    teacherId,
    personnelId: input.personnelId ?? null,
    agentKind,
    schoolYearId: result.schoolYearId,
    policyId: result.policy.id,
    year: result.year,
    month: result.month,
    status: "DRAFT" as const,
    currency: result.currency,
    quoteCurrency: result.quoteCurrency,
    exchangeRateId: result.exchangeRateId,
    rateSnapshot: result.rateSnapshot,
    gross: combined.gross,
    deductions: combined.deductions,
    net: combined.net,
    policySnapshot: result.policy as Prisma.InputJsonValue,
    generatedAt: new Date(),
  };

  return prisma.$transaction(async (tx) => {
    const payslip = existing
      ? await tx.teacherPayslip.update({ where: { id: existing.id }, data })
      : await tx.teacherPayslip.create({ data });
    await tx.teacherPayslipLine.deleteMany({ where: { payslipId: payslip.id } });

    const lines: Prisma.TeacherPayslipLineCreateManyInput[] = result.details.map((detail) => {
      const snapshot: TeacherPayslipLineDetailSnapshot = {
        startTime: detail.startTime.toISOString(),
        endTime: detail.endTime.toISOString(),
        plannedMinutes: detail.durationMinutes,
        lateMinutes: detail.lateMinutes,
        earlyExitMinutes: detail.earlyExitMinutes,
        lostMinutes: detail.lostMinutes,
        checkIn: detail.checkIn?.toISOString() ?? null,
        checkOut: detail.checkOut?.toISOString() ?? null,
        status: detail.status,
        className: detail.className,
        courseName: detail.courseName,
        graceMinutes: detail.graceMinutes,
        reason: detail.reason,
        sessionGross: detail.gross,
        ...(detail.lateWithinGrace ? { lateWithinGrace: true } : {}),
        ...(detail.waived
          ? { waived: true, waivedAmount: detail.waivedAmount }
          : {}),
      };
      return {
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
        label: `${detail.className} · ${detail.courseName}`,
        sessions: 1,
        minutes: detail.lostMinutes,
        amount: detail.reason
          ? detail.deduction
          : detail.cycle === "SECONDAIRE"
            ? detail.gross
            : 0,
        detail: snapshot,
      };
    });
    if (result.details.some((detail) => detail.cycle === "PRIMAIRE")) {
      const primaryMinutes = result.details
        .filter((detail) => detail.cycle === "PRIMAIRE")
        .reduce((sum, detail) => sum + detail.durationMinutes, 0);
      const primaryGrossAmount = roundCurrency(
        forfaitMonthlyAmount("PRIMAIRE", result.employmentKind, result.policy),
        result.currency,
      );
      const rateLabel =
        result.ratePerSession > 0
          ? ` · ${result.weeklySessions > 0 ? `${result.weeklySessions} séances/sem · ` : ""}${roundInternal(result.weeklyPlannedMinutes)} min/sem · ${result.policy.primarySessionMinutes} min/séance · ${result.ratePerSession} /séance · ${result.ratePerMinute.toFixed(3)} /min`
          : result.ratePerMinute > 0
            ? ` · ${roundInternal(result.weeklyPlannedMinutes)} min/sem · ${roundInternal(primaryMinutes)} min/mois · ${result.ratePerMinute.toFixed(3)} /min`
            : "";
      lines.unshift({
        payslipId: payslip.id,
        cycle: "PRIMAIRE",
        kind: "GROSS",
        occurredOn: undefined,
        sessionId: undefined,
        label: `Forfait mensuel primaire${rateLabel}`,
        sessions: result.details.filter((detail) => detail.cycle === "PRIMAIRE").length,
        minutes: primaryMinutes,
        amount: primaryGrossAmount,
      });
    }
    if (result.details.some((detail) => detail.cycle === "MATERNELLE")) {
      const maternelleMinutes = result.details
        .filter((detail) => detail.cycle === "MATERNELLE")
        .reduce((sum, detail) => sum + detail.durationMinutes, 0);
      const maternelleGrossAmount = roundCurrency(
        forfaitMonthlyAmount("MATERNELLE", result.employmentKind, result.policy),
        result.currency,
      );
      const sample = result.details.find((detail) => detail.cycle === "MATERNELLE");
      const ratePerMinute =
        sample && sample.durationMinutes > 0
          ? sample.gross / sample.durationMinutes
          : 0;
      const ratePerSession = roundCurrency(
        ratePerMinute * result.policy.maternelleSessionMinutes,
        result.currency,
      );
      const rateLabel =
        ratePerSession > 0
          ? ` · ${result.maternelleWeeklySessions > 0 ? `${result.maternelleWeeklySessions} séances/sem · ` : ""}${roundInternal(result.maternelleWeeklyPlannedMinutes)} min/sem · ${result.policy.maternelleSessionMinutes} min/séance · ${ratePerSession} /séance · ${ratePerMinute.toFixed(3)} /min`
          : "";
      lines.unshift({
        payslipId: payslip.id,
        cycle: "MATERNELLE",
        kind: "GROSS",
        occurredOn: undefined,
        sessionId: undefined,
        label: `Forfait mensuel maternelle${rateLabel}`,
        sessions: result.details.filter((detail) => detail.cycle === "MATERNELLE")
          .length,
        minutes: maternelleMinutes,
        amount: maternelleGrossAmount,
      });
    }
    if (result.details.some((detail) => detail.cycle === "SECONDAIRE")) {
      const secondaryMinutes = result.details
        .filter((detail) => detail.cycle === "SECONDAIRE")
        .reduce((sum, detail) => sum + detail.durationMinutes, 0);
      const secondaryGrossAmount = result.details
        .filter((detail) => detail.cycle === "SECONDAIRE")
        .reduce((sum, detail) => sum + detail.gross, 0);
      const secondaryRatesForLabel =
        result.employmentKind === "MATRICULE"
          ? secondaryMatriculeRates(
              payrollSessionAmount(result.policy),
              result.policy.secondaryMatriculePrimePercent,
              result.policy.secondarySessionMinutes,
              result.currency,
            )
          : secondaryNonMatriculeRates(
              payrollSessionAmount(result.policy),
              result.policy.secondarySessionMinutes,
              result.currency,
            );
      const secondaryLabel =
        ` · ${result.secondaryWeeklySessions > 0 ? `${result.secondaryWeeklySessions} séances/sem · ` : ""}${roundInternal(result.secondaryWeeklyPlannedMinutes)} min/sem · ${result.policy.secondarySessionMinutes} min/séance · ${result.employmentKind === "MATRICULE" ? `${result.policy.secondaryMatriculePrimePercent} % · ` : ""}${secondaryRatesForLabel.ratePerSession} /séance · ${secondaryRatesForLabel.ratePerMinute.toFixed(3)} /min`;
      lines.unshift({
        payslipId: payslip.id,
        cycle: "SECONDAIRE",
        kind: "GROSS",
        occurredOn: undefined,
        sessionId: undefined,
        label: `${result.employmentKind === "MATRICULE" ? `Prime matriculé (${result.policy.secondaryMatriculePrimePercent} % du montant séance)` : "Secondaire à la séance (horaire)"}${secondaryLabel}`,
        sessions: result.details.filter((detail) => detail.cycle === "SECONDAIRE").length,
        minutes: secondaryMinutes,
        amount: secondaryGrossAmount,
      });
    }
    if (personnelPayroll && personnelGross > 0) {
      const roleSuffix = input.personnelRoleLabel
        ? ` · ${input.personnelRoleLabel}`
        : "";
      const personnelDayLines: Prisma.TeacherPayslipLineCreateManyInput[] =
        personnelPayroll.days
          .filter((detail) => Boolean(detail.reason) || Boolean(detail.waived))
          .map((detail) => {
          const snapshot: TeacherPayslipLineDetailSnapshot = {
            startTime: detail.startTime.toISOString(),
            endTime: detail.endTime.toISOString(),
            plannedMinutes: detail.durationMinutes,
            lateMinutes: detail.lateMinutes,
            earlyExitMinutes: detail.earlyExitMinutes,
            lostMinutes: detail.lostMinutes,
            checkIn: detail.checkIn?.toISOString() ?? null,
            checkOut: detail.checkOut?.toISOString() ?? null,
            status: detail.status,
            className: detail.className,
            courseName: detail.courseName,
            graceMinutes: detail.graceMinutes,
            reason: detail.reason,
            sessionGross: detail.gross,
            ...(detail.lateWithinGrace ? { lateWithinGrace: true } : {}),
            ...(detail.waived
              ? { waived: true, waivedAmount: detail.waivedAmount }
              : {}),
          };
          return {
            payslipId: payslip.id,
            cycle: undefined,
            kind: (detail.reason === "ABSENCE"
              ? "ABSENCE"
              : detail.reason === "LATE"
                ? "LATE"
                : detail.reason === "EARLY_EXIT"
                  ? "EARLY_EXIT"
                  : "GROSS") as Prisma.TeacherPayslipLineCreateManyInput["kind"],
            occurredOn: detail.occurredOn,
            sessionId: detail.sessionId,
            label: `${detail.className} · ${detail.courseName}`,
            sessions: 1,
            minutes: detail.lostMinutes,
            amount: detail.reason ? detail.deduction : 0,
            detail: snapshot,
          };
        });
      lines.push(...personnelDayLines);
      if (personnelPayroll.prime > 0) {
        lines.unshift({
          payslipId: payslip.id,
          cycle: undefined,
          kind: "GROSS",
          occurredOn: undefined,
          sessionId: undefined,
          label: `Prime personnel${roleSuffix} · ${personnelPayroll.weekdayCount} j · ${personnelPayroll.dayMinutes} min/j · ${personnelPayroll.ratePerDay} /j`,
          sessions: personnelPayroll.weekdayCount,
          minutes: personnelPayroll.weekdayCount * personnelPayroll.dayMinutes,
          amount: personnelPayroll.prime,
        });
      }
      if (personnelPayroll.gross > 0) {
        lines.unshift({
          payslipId: payslip.id,
          cycle: undefined,
          kind: "GROSS",
          occurredOn: undefined,
          sessionId: undefined,
          label: `Salaire brut personnel${roleSuffix} · ${personnelPayroll.weekdayCount} j · ${personnelPayroll.dayMinutes} min/j · ${personnelPayroll.ratePerDay} /j`,
          sessions: personnelPayroll.weekdayCount,
          minutes: personnelPayroll.weekdayCount * personnelPayroll.dayMinutes,
          amount: personnelPayroll.gross,
        });
      }
    }
    if (lines.length > 0) await tx.teacherPayslipLine.createMany({ data: lines });

    const personnelId = input.personnelId ?? null;
    if (!teacherId && !personnelId) return payslip;

    const linked = await tx.salaryAdvanceInstallment.findMany({
      where: { payslipId: payslip.id },
      select: { advanceId: true },
    });
    if (linked.length > 0) {
      await tx.salaryAdvanceInstallment.updateMany({
        where: { payslipId: payslip.id },
        data: { status: "PLANNED", payslipId: null, deductedAt: null },
      });
      await tx.salaryAdvance.updateMany({
        where: {
          id: { in: [...new Set(linked.map((row) => row.advanceId))] },
          status: "SETTLED",
        },
        data: { status: "APPROVED" },
      });
    }

    const dueInstallments = await tx.salaryAdvanceInstallment.findMany({
      where: {
        status: "PLANNED",
        advance: {
          branchId: input.branchId,
          status: "APPROVED",
          OR: [
            ...(teacherId ? [{ teacherId }] : []),
            ...(personnelId ? [{ personnelId }] : []),
          ],
        },
        OR: [
          { year: { lt: result.year } },
          { AND: [{ year: result.year }, { month: { lte: result.month } }] },
        ],
      },
      include: {
        advance: { select: { id: true, installmentCount: true } },
      },
      orderBy: [{ year: "asc" }, { month: "asc" }, { sequence: "asc" }],
    });

    let remainingNet = combined.net;
    const applied: typeof dueInstallments = [];
    for (const row of dueInstallments) {
      if (row.amount <= 0) continue;
      if (remainingNet < row.amount) continue;
      remainingNet = roundCurrency(remainingNet - row.amount, result.currency);
      applied.push(row);
    }

    if (applied.length === 0) return payslip;

    const advanceLines: Prisma.TeacherPayslipLineCreateManyInput[] = applied.map(
      (row) => ({
        payslipId: payslip.id,
        kind: "ADVANCE" as const,
        label: `Avance sur salaire · séance ${row.sequence}/${row.advance.installmentCount} · ${String(row.month).padStart(2, "0")}/${row.year}`,
        sessions: 1,
        minutes: 0,
        amount: row.amount,
        detail: {
          advanceId: row.advance.id,
          installmentId: row.id,
          sequence: row.sequence,
          installmentCount: row.advance.installmentCount,
          plannedYear: row.year,
          plannedMonth: row.month,
        },
      }),
    );

    await tx.teacherPayslipLine.createMany({ data: advanceLines });

    const advanceDeductions = advanceLines.reduce(
      (sum, line) => sum + (line.amount ?? 0),
      0,
    );
    const settled = settlePayrollTotals(
      combined.gross,
      combined.deductions + advanceDeductions,
      result.currency,
    );

    await tx.salaryAdvanceInstallment.updateMany({
      where: { id: { in: applied.map((row) => row.id) } },
      data: {
        status: "DEDUCTED",
        payslipId: payslip.id,
        deductedAt: new Date(),
      },
    });

    const advanceIds = [...new Set(applied.map((row) => row.advance.id))];
    for (const advanceId of advanceIds) {
      const remaining = await tx.salaryAdvanceInstallment.count({
        where: { advanceId, status: { not: "DEDUCTED" } },
      });
      if (remaining === 0) {
        await tx.salaryAdvance.update({
          where: { id: advanceId },
          data: { status: "SETTLED" },
        });
      }
    }

    return tx.teacherPayslip.update({
      where: { id: payslip.id },
      data: { deductions: settled.deductions, net: settled.net },
    });
  });
}

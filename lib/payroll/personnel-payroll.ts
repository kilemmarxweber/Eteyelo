import "server-only";

import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import { getBranchEarliestStartMinutes } from "@/lib/branch-closed-days";
import { roundCurrency } from "@/lib/exchange-rate";
import {
  billableLateMinutes,
  personnelUnitRates,
  weekdayCountInMonth,
  weekdayDatesInMonth,
} from "@/lib/payroll/primary-volume";
import {
  allocateSessionGross,
  sessionLossAmount,
  settlePayrollTotals,
} from "@/lib/payroll/session-rate";
import { prisma } from "@/lib/prisma";

type PayrollPeriod = {
  year: number;
  month: number;
  schoolYearId?: string | null;
};
import { startOfTodayInTimezone, toMinutes } from "@/lib/timezone";

export type PersonnelPayrollDay = {
  sessionId: string;
  occurredOn: Date;
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
  className: string;
  courseName: string;
};

export type PersonnelPayrollResult = {
  role: string;
  gross: number;
  prime: number;
  deductions: number;
  net: number;
  days: PersonnelPayrollDay[];
  ratePerDay: number;
  ratePerMinute: number;
  dayMinutes: number;
  weekdayCount: number;
};

function roundInternal(value: number) {
  return Math.round(value * 10) / 10;
}

function periodBounds(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

function utcWallClockOnDate(date: Date, minutesFromMidnight: number) {
  const hours = Math.floor(Math.max(0, minutesFromMidnight) / 60);
  const minutes = Math.max(0, minutesFromMidnight) % 60;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
    ),
  );
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function closedDayKeys(
  branchId: string,
  start: Date,
  end: Date,
): Promise<Set<string>> {
  const events = await prisma.calendarEvent.findMany({
    where: {
      branchId,
      isArchived: false,
      closesAttendance: true,
      dateStart: { lt: end },
      OR: [
        { dateEnd: { gte: start } },
        { AND: [{ dateEnd: null }, { dateStart: { gte: start } }] },
      ],
    },
    select: { dateStart: true, dateEnd: true },
  });
  const keys = new Set<string>();
  for (const event of events) {
    const from = startOfTodayInTimezone(event.dateStart);
    const to = event.dateEnd ? startOfTodayInTimezone(event.dateEnd) : from;
    for (let time = from.getTime(); time <= to.getTime(); time += 86_400_000) {
      const day = new Date(time);
      if (day >= start && day < end) keys.add(dateKey(day));
    }
  }
  return keys;
}

export async function calculatePersonnelPayroll(input: {
  branchId: string;
  personnelId: string;
  period: PayrollPeriod;
  pay: { role: string; gross: number; prime: number };
  policy: { lateGraceMinutes: number; personnelDayMinutes: number };
  currency: CurrencyCode;
  roleLabel: string;
}): Promise<PersonnelPayrollResult> {
  const gross = roundCurrency(Math.max(0, input.pay.gross), input.currency);
  const prime = roundCurrency(Math.max(0, input.pay.prime), input.currency);
  const total = roundCurrency(gross + prime, input.currency);
  const dayMinutes =
    input.policy.personnelDayMinutes > 0
      ? input.policy.personnelDayMinutes
      : 480;
  const weekdayCount = weekdayCountInMonth(input.period.year, input.period.month);
  const emptyRates = personnelUnitRates(total, weekdayCount, dayMinutes, input.currency);

  if (total <= 0 || weekdayCount <= 0) {
    return {
      role: input.pay.role,
      gross,
      prime,
      deductions: 0,
      net: total,
      days: [],
      ratePerDay: emptyRates.ratePerDay,
      ratePerMinute: emptyRates.ratePerMinute,
      dayMinutes,
      weekdayCount,
    };
  }

  const { start, end } = periodBounds(input.period.year, input.period.month);
  const today = startOfTodayInTimezone();
  const [attendances, startMinutes, closedDays] = await Promise.all([
    prisma.personnelAttendance.findMany({
      where: {
        personnelId: input.personnelId,
        branchId: input.branchId,
        date: { gte: start, lt: end },
      },
      select: {
        id: true,
        date: true,
        status: true,
        checkIn: true,
        checkOut: true,
        earlyExit: true,
        absenceCase: { select: { status: true } },
      },
    }),
    getBranchEarliestStartMinutes(input.branchId),
    closedDayKeys(input.branchId, start, end),
  ]);

  const byDate = new Map(attendances.map((row) => [dateKey(row.date), row]));
  const weekdays = weekdayDatesInMonth(input.period.year, input.period.month);
  const dayGrosses = allocateSessionGross(
    total,
    weekdays.map(() => dayMinutes),
    input.currency,
  );
  const rates = personnelUnitRates(total, weekdayCount, dayMinutes, input.currency);
  const grace = input.policy.lateGraceMinutes;
  const days: PersonnelPayrollDay[] = [];

  weekdays.forEach((day, index) => {
    const key = dateKey(day);
    const dayGross = dayGrosses[index] ?? 0;
    const attendance = byDate.get(key);
    const closed = closedDays.has(key);
    const future = day.getTime() > today.getTime();
    const status = (attendance?.status ?? "PRESENT") as PersonnelPayrollDay["status"];
    const justified =
      closed ||
      future ||
      status === "EXCUSED" ||
      attendance?.absenceCase?.status === "ACCEPTED";
    const checkInMinutes = attendance?.checkIn
      ? toMinutes(attendance.checkIn)
      : null;
    const rawLate =
      checkInMinutes != null ? Math.max(0, checkInMinutes - startMinutes) : 0;
    const lateMinutes = billableLateMinutes(rawLate, grace);
    const endMinutes = startMinutes + dayMinutes;
    const checkOutMinutes = attendance?.checkOut
      ? toMinutes(attendance.checkOut)
      : null;
    const earlyExitMinutes =
      attendance?.earlyExit && checkOutMinutes != null
        ? Math.max(0, endMinutes - checkOutMinutes)
        : 0;
    const lost = justified
      ? 0
      : status === "ABSENT"
        ? dayMinutes
        : Math.min(dayMinutes, Math.max(0, lateMinutes) + Math.max(0, earlyExitMinutes));
    const payrollStatus: PersonnelPayrollDay["status"] =
      status === "ABSENT" || status === "EXCUSED"
        ? status
        : rawLate > 0 || status === "LATE"
          ? "LATE"
          : status;
    const lateWithinGrace =
      !justified && payrollStatus === "LATE" && lost <= 0 && rawLate > 0;
    const reason: PersonnelPayrollDay["reason"] =
      lost > 0
        ? status === "ABSENT"
          ? "ABSENCE"
          : earlyExitMinutes > 0
            ? "EARLY_EXIT"
            : "LATE"
        : lateWithinGrace
          ? "LATE"
          : null;
    const startTime = utcWallClockOnDate(day, startMinutes);
    const endTime = utcWallClockOnDate(day, endMinutes);
    days.push({
      sessionId: attendance?.id ?? `personnel-day:${key}`,
      occurredOn: day,
      status: payrollStatus,
      startTime,
      endTime,
      durationMinutes: roundInternal(dayMinutes),
      lateMinutes: roundInternal(rawLate),
      earlyExitMinutes: roundInternal(earlyExitMinutes),
      lostMinutes: roundInternal(lost),
      checkIn: attendance?.checkIn ?? null,
      checkOut: attendance?.checkOut ?? null,
      graceMinutes: grace,
      deduction: sessionLossAmount(dayGross, lost, dayMinutes, input.currency),
      gross: dayGross,
      reason,
      lateWithinGrace,
      className: input.roleLabel,
      courseName: "Journée",
    });
  });

  const deductions = days.reduce((sum, day) => sum + day.deduction, 0);
  const settled = settlePayrollTotals(total, deductions, input.currency);
  return {
    role: input.pay.role,
    gross,
    prime,
    deductions: settled.deductions,
    net: settled.net,
    days,
    ratePerDay: rates.ratePerDay,
    ratePerMinute: rates.ratePerMinute,
    dayMinutes,
    weekdayCount,
  };
}

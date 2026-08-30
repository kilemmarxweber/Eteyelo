"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { assertStudentReadableInBranch } from "@/lib/auth/data-scope";
import { auth } from "@/lib/auth";
import { getServerTranslator } from "@/lib/i18n-server";
import { resolvePreferredLocale } from "@/lib/resolve-preferred-locale";
import { intlLocaleFromUserLocale } from "@/lib/user-locale";
import { AttendanceStatus } from "@/prisma/generated/prisma/client";
import {
  CHART_WEEKDAY_INDICES,
  getAttendanceStatusLabel,
  weekdayIndexFromDate,
} from "../../attendance/attendance-labels";
import {
  type AttendanceHourStat,
  type AttendanceReportFilters,
  type AttendanceWeekdayStat,
} from "../../attendance/attendance-report-types";

async function getReportIntlLocale() {
  const session = await auth.api.getSession({ headers: await headers() });
  const locale = await resolvePreferredLocale(
    (session?.user as { locale?: string | null } | undefined)?.locale,
  );
  return intlLocaleFromUserLocale(locale);
}

function formatTime(
  date: Date | null | undefined,
  locale: string,
): string | null {
  if (!date) return null;
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatWeekday(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "long" });
}

export type StudentPresenceRow = {
  id: string;
  date: string;
  dayLabel: string;
  courseName: string;
  status: AttendanceStatus;
  statusLabel: string;
  arrival: string | null;
  departure: string | null;
};

export type StudentPresenceStats = {
  records: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

export type StudentPresenceReport = {
  stats: StudentPresenceStats;
  weekdayStats: AttendanceWeekdayStat[];
  hourStats: AttendanceHourStat[];
  rows: StudentPresenceRow[];
};

function buildWeekdayStats(
  records: Array<{ date: Date; status: AttendanceStatus }>,
): AttendanceWeekdayStat[] {
  const totals = new Map<number, { present: number; total: number }>();

  for (const dayIndex of CHART_WEEKDAY_INDICES) {
    totals.set(dayIndex, { present: 0, total: 0 });
  }

  for (const record of records) {
    const dayIndex = weekdayIndexFromDate(record.date);
    if (dayIndex == null || !totals.has(dayIndex)) continue;

    const current = totals.get(dayIndex)!;
    current.total += 1;
    if (record.status === "PRESENT" || record.status === "LATE") {
      current.present += 1;
    }
    totals.set(dayIndex, current);
  }

  return CHART_WEEKDAY_INDICES.map((dayIndex) => {
    const value = totals.get(dayIndex)!;
    const percent =
      value.total > 0 ? Math.round((value.present / value.total) * 100) : 0;

    return {
      dayIndex,
      present: value.present,
      total: value.total,
      percent,
    };
  });
}

function getDateRange(filters: AttendanceReportFilters) {
  const now = new Date();
  const year = filters.year ?? now.getFullYear();
  const month = filters.month ?? now.getMonth();

  switch (filters.period) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "week": {
      const start = new Date(now);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "year":
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    case "month":
    default:
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
  }
}

function buildHourStats(
  records: Array<{ arrivalAt: Date | null }>,
): AttendanceHourStat[] {
  const counts = new Map<number, number>();

  for (let hour = 6; hour <= 18; hour += 1) {
    counts.set(hour, 0);
  }

  for (const record of records) {
    if (!record.arrivalAt) continue;
    const hour = record.arrivalAt.getHours();
    if (hour < 6 || hour > 18) continue;
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([hour, count]) => ({ hour, count }));
}

export async function getStudentPresenceReportAction(
  studentId: string,
  filters: AttendanceReportFilters = {},
): Promise<StudentPresenceReport> {
  const { branchId, session, userId } = await requireBranchContext();
  await assertStudentReadableInBranch({
    session,
    userId,
    branchId,
    studentId,
  });
  const { start, end } = getDateRange(filters);
  const t = await getServerTranslator("attendance");
  const intlLocale = await getReportIntlLocale();
  const statusFilter =
    filters.status && filters.status !== "ALL" ? filters.status : undefined;

  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      branchMember: { branchId },
    },
    select: { id: true },
  });

  if (!student) {
    throw new Error("Eleve introuvable dans cette branche.");
  }

  const records = await prisma.studentAttendance.findMany({
    where: {
      branchId,
      studentId,
      session: {
        date: { gte: start, lte: end },
      },
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      session: {
        include: {
          teaching: {
            include: {
              cours: { select: { nameCours: true } },
            },
          },
        },
      },
    },
    orderBy: [{ session: { date: "desc" } }, { recordedAt: "desc" }],
  });

  const mapped = records.map((record) => {
    const sessionDate = record.session.date;
    const isAbsentLike =
      record.status === "ABSENT" || record.status === "EXCUSED";
    const arrivalAt = isAbsentLike
      ? null
      : (record.checkIn ?? record.recordedAt);
    // Aligné sur les rapports attendance : checkOut réel, sinon fin de séance.
    const departureAt = isAbsentLike
      ? null
      : (record.checkOut ??
        (record.earlyExit ? null : (record.session.endTime ?? null)));

    return {
      id: record.id,
      date: sessionDate,
      status: record.status,
      arrivalAt,
      departureAt,
      courseName: record.session.teaching?.cours?.nameCours?.trim() || "Cours",
    };
  });

  const stats: StudentPresenceStats = {
    records: mapped.length,
    present: mapped.filter((r) => r.status === "PRESENT").length,
    absent: mapped.filter((r) => r.status === "ABSENT").length,
    late: mapped.filter((r) => r.status === "LATE").length,
    excused: mapped.filter((r) => r.status === "EXCUSED").length,
  };

  const rows: StudentPresenceRow[] = mapped.map((record) => ({
    id: record.id,
    date: record.date.toISOString(),
    dayLabel: formatWeekday(record.date, intlLocale),
    courseName: record.courseName,
    status: record.status,
    statusLabel: getAttendanceStatusLabel(t, record.status),
    arrival: formatTime(record.arrivalAt, intlLocale),
    departure: formatTime(record.departureAt, intlLocale),
  }));

  return {
    stats,
    weekdayStats: buildWeekdayStats(
      mapped.map((record) => ({ date: record.date, status: record.status })),
    ),
    hourStats: buildHourStats(mapped),
    rows,
  };
}

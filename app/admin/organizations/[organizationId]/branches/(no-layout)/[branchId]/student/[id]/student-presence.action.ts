"use server";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { AttendanceStatus } from "@/prisma/generated/prisma/client";
import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceHourStat,
  type AttendanceReportFilters,
  type AttendanceWeekdayStat,
} from "../../attendance/attendance-report-types";

const WEEKDAY_LABELS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

const CHART_WEEKDAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

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

function formatTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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

function buildWeekdayStats(
  records: Array<{ date: Date; status: AttendanceStatus }>,
): AttendanceWeekdayStat[] {
  const totals = new Map<string, { present: number; total: number }>();

  for (const day of CHART_WEEKDAYS) {
    totals.set(day, { present: 0, total: 0 });
  }

  for (const record of records) {
    const day = WEEKDAY_LABELS[record.date.getDay()];
    if (!CHART_WEEKDAYS.includes(day)) continue;

    const current = totals.get(day)!;
    current.total += 1;
    if (record.status === "PRESENT" || record.status === "LATE") {
      current.present += 1;
    }
    totals.set(day, current);
  }

  return CHART_WEEKDAYS.map((day) => {
    const value = totals.get(day)!;
    const percent =
      value.total > 0 ? Math.round((value.present / value.total) * 100) : 0;

    return {
      day,
      present: value.present,
      total: value.total,
      percent,
    };
  });
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
  const { branchId } = await requireBranchContext();
  const { start, end } = getDateRange(filters);
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
    const arrivalAt =
      record.status === "ABSENT" || record.status === "EXCUSED"
        ? null
        : record.recordedAt;
    const departureAt =
      record.status === "ABSENT" || record.status === "EXCUSED"
        ? null
        : (record.session.endTime ?? null);

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
    dayLabel: WEEKDAY_LABELS[record.date.getDay()],
    courseName: record.courseName,
    status: record.status,
    statusLabel: ATTENDANCE_STATUS_LABELS[record.status],
    arrival: formatTime(record.arrivalAt),
    departure: formatTime(record.departureAt),
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

import { prisma } from "@/lib/prisma";
import { PRESENT_STATUSES } from "./definitions";
import {
  buildBranchIdFilter,
  monthKey,
  monthLabelFr,
  pct,
  type BranchScopeInput,
} from "./scope";

export type AttendanceStatusRow = { name: string; value: number; key: string };
export type AttendanceMonthRow = {
  month: string;
  label: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

export type TrackAttendanceReport = {
  total: number;
  presentRate: number;
  byStatus: AttendanceStatusRow[];
  byMonth: AttendanceMonthRow[];
};

export type AttendanceReport = {
  students: TrackAttendanceReport;
  teachers: TrackAttendanceReport;
  personnel: TrackAttendanceReport;
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Présents",
  ABSENT: "Absents",
  LATE: "Retards",
  EXCUSED: "Excusés",
};

function buildTrack(
  rows: Array<{ status: string; date: Date }>,
): TrackAttendanceReport {
  const statusCounts = new Map<string, number>();
  const monthMap = new Map<
    string,
    AttendanceMonthRow & { sort: string }
  >();

  for (const row of rows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    const key = monthKey(row.date);
    const current = monthMap.get(key) ?? {
      month: key,
      label: monthLabelFr(row.date),
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
      sort: key,
    };
    current.total += 1;
    if (row.status === "PRESENT") current.present += 1;
    else if (row.status === "ABSENT") current.absent += 1;
    else if (row.status === "LATE") current.late += 1;
    else if (row.status === "EXCUSED") current.excused += 1;
    monthMap.set(key, current);
  }

  const total = rows.length;
  const presentLike = rows.filter((r) =>
    (PRESENT_STATUSES as readonly string[]).includes(r.status),
  ).length;

  const byStatus: AttendanceStatusRow[] = [
    "PRESENT",
    "ABSENT",
    "LATE",
    "EXCUSED",
  ].map((key) => ({
    key,
    name: STATUS_LABELS[key] ?? key,
    value: statusCounts.get(key) ?? 0,
  }));

  const byMonth = Array.from(monthMap.values())
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map(({ sort: _s, ...rest }) => rest);

  return {
    total,
    presentRate: pct(presentLike, total),
    byStatus,
    byMonth,
  };
}

export async function getAttendanceReport(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
}): Promise<AttendanceReport> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const sessionYearFilter =
    params.schoolYearIds.length > 0
      ? { schoolYearId: { in: params.schoolYearIds } }
      : {};

  const [studentRows, teacherRows, personnelRows] = await Promise.all([
    prisma.studentAttendance.findMany({
      where: {
        ...branchFilter,
        ...(params.schoolYearIds.length > 0
          ? { session: sessionYearFilter }
          : {}),
      },
      select: { status: true, recordedAt: true },
    }),
    prisma.teacherAttendance.findMany({
      where: {
        ...branchFilter,
        ...(params.schoolYearIds.length > 0
          ? { session: sessionYearFilter }
          : {}),
      },
      select: { status: true, date: true },
    }),
    prisma.personnelAttendance.findMany({
      where: branchFilter,
      select: { status: true, date: true },
    }),
  ]);

  return {
    students: buildTrack(
      studentRows.map((r) => ({ status: r.status, date: r.recordedAt })),
    ),
    teachers: buildTrack(
      teacherRows.map((r) => ({ status: r.status, date: r.date })),
    ),
    personnel: buildTrack(
      personnelRows.map((r) => ({ status: r.status, date: r.date })),
    ),
  };
}

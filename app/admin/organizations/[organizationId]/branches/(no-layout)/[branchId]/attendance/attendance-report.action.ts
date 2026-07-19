"use server";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { AttendanceStatus } from "@/prisma/generated/prisma/client";
import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceHourStat,
  type AttendanceRecentItem,
  type AttendanceReportData,
  type AttendanceReportFilters,
  type AttendanceReportRow,
  type AttendanceWeekdayStat,
} from "./attendance-report-types";

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

type UserInfo = {
  name: string;
  postnom: string | null;
  prenom: string | null;
  username: string | null;
};

type UnifiedRecord = {
  id: string;
  date: Date;
  status: AttendanceStatus;
  arrivalAt: Date | null;
  departureAt: Date | null;
  sortAt: Date;
  user: UserInfo | null;
  poste: string;
  personKey: string;
};

function formatTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatShortTime(date: Date | null | undefined): string {
  if (!date) return "--:--";
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR");
}

function getAgentName(user: UserInfo | null | undefined) {
  if (!user) return "Inconnu";
  return [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim();
}

function getInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
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

function buildUserSearch(search: string) {
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { prenom: { contains: search, mode: "insensitive" as const } },
      { postnom: { contains: search, mode: "insensitive" as const } },
      { username: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

function buildWeekdayStats(records: Array<{ date: Date; status: AttendanceStatus }>) {
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
    } satisfies AttendanceWeekdayStat;
  });
}

function buildHourStats(records: Array<{ arrivalAt: Date | null }>): AttendanceHourStat[] {
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

function mapStudentRecords(
  records: Awaited<
    ReturnType<
      typeof prisma.studentAttendance.findMany<{
        include: {
          student: {
            include: {
              branchMember: { include: { member: { include: { user: true } } } };
            };
          };
          session: { include: { teaching: { include: { classe: true } } } };
        };
      }>
    >
  >,
): UnifiedRecord[] {
  return records.map((record) => {
    const user = record.student.branchMember?.member?.user;
    const classe = record.session.teaching?.classe?.codeClasse;

    return {
      id: record.id,
      date: record.recordedAt,
      status: record.status,
      arrivalAt: record.recordedAt,
      departureAt: record.session.endTime ?? null,
      sortAt: record.recordedAt,
      user: user
        ? {
            name: user.name,
            postnom: user.postnom,
            prenom: user.prenom,
            username: user.username,
          }
        : null,
      poste: classe ? classe.toLowerCase() : "eleve",
      personKey: `student-${record.studentId}`,
    };
  });
}

function mapTeacherRecords(
  records: Awaited<
    ReturnType<
      typeof prisma.teacherAttendance.findMany<{
        include: {
          teacher: {
            include: {
              branchMember: { include: { member: { include: { user: true } } } };
            };
          };
          session: true;
        };
      }>
    >
  >,
): UnifiedRecord[] {
  return records.map((record) => {
    const user = record.teacher.branchMember?.member?.user;

    return {
      id: record.id,
      date: record.date,
      status: record.status,
      arrivalAt: record.session?.startTime ?? record.createdAt,
      departureAt: record.session?.endTime ?? null,
      sortAt: record.createdAt,
      user: user
        ? {
            name: user.name,
            postnom: user.postnom,
            prenom: user.prenom,
            username: user.username,
          }
        : null,
      poste: "enseignant",
      personKey: `teacher-${record.teacherId}`,
    };
  });
}

function mapPersonnelRecords(
  records: Awaited<
    ReturnType<
      typeof prisma.personnelAttendance.findMany<{
        include: {
          personnel: {
            include: {
              branchMember: { include: { member: { include: { user: true } } } };
            };
          };
        };
      }>
    >
  >,
): UnifiedRecord[] {
  return records.map((record) => {
    const user = record.personnel.branchMember?.member?.user;
    const member = record.personnel.branchMember?.member;
    const poste = member?.role ? orgRoleLabel(member.role) : "Personnel";

    return {
      id: record.id,
      date: record.date,
      status: record.status,
      arrivalAt: record.checkIn ?? (record.status === "PRESENT" || record.status === "LATE" ? record.createdAt : null),
      departureAt: record.checkOut,
      sortAt: record.checkIn ?? record.createdAt,
      user: user
        ? {
            name: user.name,
            postnom: user.postnom,
            prenom: user.prenom,
            username: user.username,
          }
        : null,
      poste: poste.toLowerCase(),
      personKey: `personnel-${record.personnelId}`,
    };
  });
}

export async function getAttendanceReportAction(
  filters: AttendanceReportFilters = {},
): Promise<AttendanceReportData> {
  const { branchId } = await requireBranchContext();
  const { start, end } = getDateRange(filters);
  const statusFilter =
    filters.status && filters.status !== "ALL" ? filters.status : undefined;
  const search = filters.search?.trim();
  const userSearch = search ? buildUserSearch(search) : undefined;

  const [students, teachers, personnels, totalStudents, totalTeachers, totalPersonnel] =
    await Promise.all([
      prisma.studentAttendance.findMany({
        where: {
          branchId,
          recordedAt: { gte: start, lte: end },
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(userSearch
            ? {
                student: {
                  branchMember: { member: { user: userSearch } },
                },
              }
            : {}),
        },
        include: {
          student: {
            include: {
              branchMember: {
                include: {
                  member: { include: { user: true } },
                },
              },
            },
          },
          session: {
            include: {
              teaching: { include: { classe: true } },
            },
          },
        },
      }),
      prisma.teacherAttendance.findMany({
        where: {
          branchId,
          date: { gte: start, lte: end },
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(userSearch
            ? {
                teacher: {
                  branchMember: { member: { user: userSearch } },
                },
              }
            : {}),
        },
        include: {
          teacher: {
            include: {
              branchMember: {
                include: {
                  member: { include: { user: true } },
                },
              },
            },
          },
          session: true,
        },
      }),
      prisma.personnelAttendance.findMany({
        where: {
          branchId,
          date: { gte: start, lte: end },
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(userSearch
            ? {
                personnel: {
                  branchMember: { member: { user: userSearch } },
                },
              }
            : {}),
        },
        include: {
          personnel: {
            include: {
              branchMember: {
                include: {
                  member: { include: { user: true } },
                },
              },
            },
          },
        },
      }),
      prisma.student.count({ where: { branchMember: { branchId } } }),
      prisma.teacher.count({ where: { branchMember: { branchId } } }),
      prisma.personnel.count({ where: { branchMember: { branchId } } }),
    ]);

  const records = [
    ...mapStudentRecords(students),
    ...mapTeacherRecords(teachers),
    ...mapPersonnelRecords(personnels),
  ].sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());

  const totalExpected = totalStudents + totalTeachers + totalPersonnel;
  const checkedPersonKeys = new Set(
    records.filter((record) => record.arrivalAt).map((record) => record.personKey),
  );

  const presences = records.filter(
    (record) => record.status === "PRESENT" || record.status === "LATE",
  ).length;
  const absences = records.filter((record) => record.status === "ABSENT").length;
  const checkedIn = records.filter((record) => record.arrivalAt).length;
  const notCheckedIn = Math.max(totalExpected - checkedPersonKeys.size, 0);

  const rows: AttendanceReportRow[] = records.map((record) => {
    const agentName = getAgentName(record.user);

    return {
      id: record.id,
      date: record.date.toISOString(),
      dayLabel: WEEKDAY_LABELS[record.date.getDay()],
      agentName: agentName.toUpperCase(),
      agentInitials: getInitials(agentName),
      agentId: record.user?.username ?? record.id.slice(0, 8).toUpperCase(),
      poste: record.poste,
      status: record.status,
      statusLabel: ATTENDANCE_STATUS_LABELS[record.status],
      arrival: formatTime(record.arrivalAt),
      departure: formatTime(record.departureAt),
    };
  });

  const recent: AttendanceRecentItem[] = records.slice(0, 8).map((record) => {
    const agentName = getAgentName(record.user);

    return {
      id: record.id,
      dateLabel: formatDate(record.date),
      name: agentName.toUpperCase(),
      timeLabel: formatShortTime(record.arrivalAt ?? record.sortAt),
      status: record.status,
      statusLabel: ATTENDANCE_STATUS_LABELS[record.status],
    };
  });

  return {
    stats: {
      records: records.length,
      presences,
      absences,
      checkedIn,
      notCheckedIn,
    },
    recent,
    weekdayStats: buildWeekdayStats(
      records.map((record) => ({ date: record.date, status: record.status })),
    ),
    hourStats: buildHourStats(records),
    rows,
  };
}

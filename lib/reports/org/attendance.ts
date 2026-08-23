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

export type AttendancePersonDetailRow = {
  id: string;
  matricule: string;
  name: string;
  role: string;
  branch: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

/** Pointage individuel absent ou en retard. */
export type AttendanceIncidentRow = {
  date: string;
  /** Heure d'arrivée / pointage. */
  time: string;
  /** Heure de fin / sortie (checkOut ou fin de séance). */
  endTime: string;
  dateSort: string;
  matricule: string;
  name: string;
  role: string;
  branch: string;
  status: "Absent" | "Retard";
  remark: string;
};

export type TrackAttendanceReport = {
  total: number;
  presentRate: number;
  byStatus: AttendanceStatusRow[];
  byMonth: AttendanceMonthRow[];
  /** Personnes ayant au moins 1 absence ou retard (synthèse). */
  details: AttendancePersonDetailRow[];
  /** Liste des pointages absents / retards. */
  incidents: AttendanceIncidentRow[];
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

const BRANCH_ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Directeur",
  CAISSIER: "Caissier",
  ADMIN: "Admin",
  TEACHER: "Enseignant",
  PARENT: "Parent",
  STUDENT: "Élève",
};

type AttendanceRawRow = {
  personId: string;
  status: string;
  /** Jour du pointage (affichage date). */
  day: Date;
  /** Horodatage pour l’heure d’arrivée (et le tri). */
  at: Date;
  /** Horodatage de sortie / fin (null si absent). */
  endAt: Date | null;
  matricule: string;
  name: string;
  role: string;
  branch: string;
  remark: string;
};

function formatPersonName(user: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null): string {
  if (!user) return "—";
  return (
    [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim() ||
    "—"
  );
}

function formatDateFr(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTimeFr(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/** True if the Date carries a non-midnight clock time. */
function hasClockTime(date: Date) {
  return (
    date.getHours() !== 0 ||
    date.getMinutes() !== 0 ||
    date.getSeconds() !== 0 ||
    date.getMilliseconds() !== 0
  );
}

function roleLabel(role: string | null | undefined, fallback: string) {
  if (!role?.trim()) return fallback;
  return BRANCH_ROLE_LABELS[role] ?? role;
}

function bumpStatus(
  counts: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  },
  status: string,
) {
  counts.total += 1;
  if (status === "PRESENT") counts.present += 1;
  else if (status === "ABSENT") counts.absent += 1;
  else if (status === "LATE") counts.late += 1;
  else if (status === "EXCUSED") counts.excused += 1;
}

function buildTrack(rows: AttendanceRawRow[]): TrackAttendanceReport {
  const statusCounts = new Map<string, number>();
  const monthMap = new Map<string, AttendanceMonthRow & { sort: string }>();
  const personMap = new Map<string, AttendancePersonDetailRow>();
  const incidents: AttendanceIncidentRow[] = [];

  for (const row of rows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);

    const key = monthKey(row.day);
    const current = monthMap.get(key) ?? {
      month: key,
      label: monthLabelFr(row.day),
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
      sort: key,
    };
    bumpStatus(current, row.status);
    monthMap.set(key, current);

    let person = personMap.get(row.personId);
    if (!person) {
      person = {
        id: row.personId,
        matricule: row.matricule,
        name: row.name,
        role: row.role,
        branch: row.branch,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
      };
      personMap.set(row.personId, person);
    }
    bumpStatus(person, row.status);

    if (row.status === "ABSENT" || row.status === "LATE") {
      incidents.push({
        date: formatDateFr(row.day),
        time: formatTimeFr(row.at),
        endTime: row.endAt ? formatTimeFr(row.endAt) : "—",
        dateSort: row.at.toISOString(),
        matricule: row.matricule,
        name: row.name,
        role: row.role,
        branch: row.branch,
        status: row.status === "ABSENT" ? "Absent" : "Retard",
        remark: row.remark || "—",
      });
    }
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

  const details = Array.from(personMap.values())
    .filter((p) => p.absent > 0 || p.late > 0)
    .sort((a, b) => {
      const byAbs = b.absent - a.absent;
      if (byAbs !== 0) return byAbs;
      const byLate = b.late - a.late;
      if (byLate !== 0) return byLate;
      const byBranch = a.branch.localeCompare(b.branch, "fr");
      if (byBranch !== 0) return byBranch;
      return a.name.localeCompare(b.name, "fr");
    });

  incidents.sort((a, b) => {
    const byDate = b.dateSort.localeCompare(a.dateSort);
    if (byDate !== 0) return byDate;
    return a.name.localeCompare(b.name, "fr");
  });

  return {
    total,
    presentRate: pct(presentLike, total),
    byStatus,
    byMonth,
    details,
    incidents,
  };
}

const userSelect = {
  username: true,
  name: true,
  postnom: true,
  prenom: true,
} as const;

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
      select: {
        status: true,
        recordedAt: true,
        checkIn: true,
        checkOut: true,
        earlyExit: true,
        remark: true,
        studentId: true,
        student: {
          select: {
            branchMember: {
              select: {
                member: {
                  select: {
                    user: { select: userSelect },
                  },
                },
              },
            },
          },
        },
        branch: { select: { name: true } },
        session: {
          select: {
            endTime: true,
            teaching: {
              select: {
                classe: {
                  select: { nameClasse: true, codeClasse: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.teacherAttendance.findMany({
      where: {
        ...branchFilter,
        ...(params.schoolYearIds.length > 0
          ? { session: sessionYearFilter }
          : {}),
      },
      select: {
        status: true,
        date: true,
        createdAt: true,
        checkIn: true,
        checkOut: true,
        earlyExit: true,
        remark: true,
        teacherId: true,
        teacher: {
          select: {
            branchMember: {
              select: {
                role: true,
                member: {
                  select: {
                    user: { select: userSelect },
                  },
                },
              },
            },
          },
        },
        branch: { select: { name: true } },
        session: { select: { endTime: true, startTime: true } },
      },
    }),
    prisma.personnelAttendance.findMany({
      where: branchFilter,
      select: {
        status: true,
        date: true,
        checkIn: true,
        checkOut: true,
        createdAt: true,
        remark: true,
        personnelId: true,
        personnel: {
          select: {
            branchMember: {
              select: {
                role: true,
                member: {
                  select: {
                    role: true,
                    user: { select: userSelect },
                  },
                },
              },
            },
          },
        },
        branch: { select: { name: true } },
      },
    }),
  ]);

  return {
    students: buildTrack(
      studentRows.map((r) => {
        const user = r.student?.branchMember?.member?.user ?? null;
        const classe = r.session?.teaching?.classe;
        const role =
          classe?.nameClasse?.trim() ||
          classe?.codeClasse?.trim() ||
          "Élève";
        const isAbsentLike = r.status === "ABSENT" || r.status === "EXCUSED";
        return {
          personId: r.studentId,
          status: r.status,
          day: r.recordedAt,
          at: r.checkIn ?? r.recordedAt,
          endAt: isAbsentLike
            ? null
            : (r.checkOut ??
              (r.earlyExit ? null : (r.session?.endTime ?? null))),
          matricule: user?.username?.trim() || "—",
          name: formatPersonName(user),
          role,
          branch: r.branch?.name?.trim() || "—",
          remark: r.remark?.trim() || "",
        };
      }),
    ),
    teachers: buildTrack(
      teacherRows.map((r) => {
        const user = r.teacher?.branchMember?.member?.user ?? null;
        const isAbsentLike = r.status === "ABSENT" || r.status === "EXCUSED";
        return {
          personId: r.teacherId,
          status: r.status,
          day: r.date,
          at:
            r.checkIn ??
            (hasClockTime(r.date) ? r.date : r.createdAt),
          endAt: isAbsentLike
            ? null
            : (r.checkOut ??
              (r.earlyExit ? null : (r.session?.endTime ?? null))),
          matricule: user?.username?.trim() || "—",
          name: formatPersonName(user),
          role: roleLabel(r.teacher?.branchMember?.role, "Enseignant"),
          branch: r.branch?.name?.trim() || "—",
          remark: r.remark?.trim() || "",
        };
      }),
    ),
    personnel: buildTrack(
      personnelRows.map((r) => {
        const bm = r.personnel?.branchMember;
        const user = bm?.member?.user ?? null;
        const fromBranch = bm?.role
          ? roleLabel(bm.role, "Personnel")
          : null;
        const fromMember = bm?.member?.role?.trim() || null;
        const isAbsentLike = r.status === "ABSENT" || r.status === "EXCUSED";
        return {
          personId: r.personnelId,
          status: r.status,
          day: r.date,
          at:
            r.checkIn ??
            (hasClockTime(r.date) ? r.date : r.createdAt),
          endAt: isAbsentLike ? null : (r.checkOut ?? null),
          matricule: user?.username?.trim() || "—",
          name: formatPersonName(user),
          role: fromBranch || fromMember || "Personnel",
          branch: r.branch?.name?.trim() || "—",
          remark: r.remark?.trim() || "",
        };
      }),
    ),
  };
}

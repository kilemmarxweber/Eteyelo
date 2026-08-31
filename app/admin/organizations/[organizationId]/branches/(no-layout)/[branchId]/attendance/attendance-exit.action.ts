"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyTeacherPayrollImpact } from "@/lib/payroll/teacher-payroll-notifications";
import { action } from "@/lib/zsa";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  assertStudentAttendanceWriteAccess,
  assertTeacherAttendanceWriteAccess,
} from "@/lib/auth/data-scope";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { AttendanceExitReason } from "@/prisma/generated/prisma/client";
import {
  ATTENDANCE_EXIT_REASON_LABELS,
  combineDateWithCreneauTime,
  formatSessionOrdinal,
  minutesBetween,
} from "@/lib/attendance-exit";
import { nowLocal } from "@/lib/timezone";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";

const exitReasonSchema = z.object({
  reasonCode: z.nativeEnum(AttendanceExitReason),
  reasonNote: z.string().trim().max(500).optional().or(z.literal("")),
});

function buildExitReasonText(
  code: AttendanceExitReason,
  note?: string | null,
) {
  const label = ATTENDANCE_EXIT_REASON_LABELS[code];
  const trimmed = note?.trim();
  return trimmed ? `${label} — ${trimmed}` : label;
}

async function resolveStudentExpectedEnd(
  studentId: string,
  branchId: string,
  day: Date,
): Promise<Date | null> {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentId,
      branchId,
      OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      classe: {
        select: {
          creneau: {
            select: { endTime: true },
          },
        },
      },
    },
  });

  const endTime = enrollment?.classe?.creneau?.endTime;
  if (!endTime) return null;
  return combineDateWithCreneauTime(day, endTime);
}

/** Sortie anticipée élève (maladie, etc.) avec motif. */
export const recordStudentEarlyExitAction = action
  .input(
    exitReasonSchema.extend({
      attendanceId: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, session, userId } = await requireBranchContext();
    const now = nowLocal();

    const attendance = await prisma.studentAttendance.findFirst({
      where: { id: input.attendanceId, branchId },
      select: {
        id: true,
        studentId: true,
        sessionId: true,
        checkOut: true,
        status: true,
      },
    });

    if (!attendance) throw new Error("Présence élève introuvable.");
    if (attendance.status === "ABSENT") {
      throw new Error("Impossible de signaler une sortie pour un absent.");
    }

    await assertStudentAttendanceWriteAccess({
      session,
      userId,
      branchId,
      sessionId: attendance.sessionId,
      studentId: attendance.studentId,
    });

    const exitReason = buildExitReasonText(
      input.reasonCode,
      input.reasonNote,
    );

    return prisma.studentAttendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        earlyExit: true,
        exitReasonCode: input.reasonCode,
        exitReason,
        status:
          input.reasonCode === "MALADIE" || input.reasonCode === "AUTORISE"
            ? "EXCUSED"
            : attendance.status,
        remark: exitReason,
      },
    });
  });

/** Sortie anticipée enseignant (fin brusque de cours) avec motif. */
export const recordTeacherEarlyExitAction = action
  .input(
    exitReasonSchema.extend({
      attendanceId: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId } = await requireBranchContext();
    const now = nowLocal();

    const attendance = await prisma.teacherAttendance.findFirst({
      where: { id: input.attendanceId, branchId },
      select: {
        id: true,
        teacherId: true,
        sessionId: true,
        status: true,
      },
    });

    if (!attendance) throw new Error("Présence enseignant introuvable.");

    await assertTeacherAttendanceWriteAccess({
      session,
      userId,
      branchId,
      sessionId: attendance.sessionId,
      teacherId: attendance.teacherId,
    });

    const exitReason = buildExitReasonText(
      input.reasonCode,
      input.reasonNote,
    );

    const updated = await prisma.teacherAttendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        earlyExit: true,
        exitReasonCode: input.reasonCode,
        exitReason,
        remark: exitReason,
        status:
          input.reasonCode === "MALADIE" || input.reasonCode === "AUTORISE"
            ? "EXCUSED"
            : attendance.status,
      },
    });
    if (updated.status !== "EXCUSED") {
      await notifyTeacherPayrollImpact({
        branchId,
        organizationId,
        teacherId: updated.teacherId,
        sessionId: updated.sessionId,
        status: "EARLY_EXIT",
      });
    }
    return updated;
  });

/** Sortie anticipée personnel avec motif. */
export const recordPersonnelEarlyExitAction = action
  .input(
    exitReasonSchema.extend({
      attendanceId: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, session } = await requireBranchContext();
    if (!canManageOrganization(session)) {
      throw new Error("Seuls les responsables peuvent pointer le personnel.");
    }

    const now = nowLocal();
    const attendance = await prisma.personnelAttendance.findFirst({
      where: { id: input.attendanceId, branchId },
      select: { id: true, checkIn: true, status: true },
    });

    if (!attendance) throw new Error("Présence personnel introuvable.");
    if (!attendance.checkIn) {
      throw new Error("Le personnel n'a pas encore pointé l'arrivée.");
    }

    const exitReason = buildExitReasonText(
      input.reasonCode,
      input.reasonNote,
    );

    return prisma.personnelAttendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        earlyExit: true,
        exitReasonCode: input.reasonCode,
        exitReason,
        remark: exitReason,
        status:
          input.reasonCode === "MALADIE" || input.reasonCode === "AUTORISE"
            ? "EXCUSED"
            : attendance.status,
      },
    });
  });

/** Clôture normale élève : heure de fin = fin de vacation (créneau). */
export const closeStudentDayByVacationAction = action
  .input(
    z.object({
      attendanceId: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId } = await requireBranchContext();

    const attendance = await prisma.studentAttendance.findFirst({
      where: { id: input.attendanceId, branchId },
      select: {
        id: true,
        studentId: true,
        sessionId: true,
        checkOut: true,
        earlyExit: true,
        recordedAt: true,
      },
    });

    if (!attendance) throw new Error("Présence élève introuvable.");
    if (attendance.earlyExit) {
      throw new Error("Sortie anticipée déjà enregistrée.");
    }

    await assertStudentAttendanceWriteAccess({
      session,
      userId,
      branchId,
      sessionId: attendance.sessionId,
      studentId: attendance.studentId,
    });

    const expectedEnd =
      (await resolveStudentExpectedEnd(
        attendance.studentId,
        branchId,
        attendance.recordedAt,
      )) ?? nowLocal();

    return prisma.studentAttendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: expectedEnd,
        earlyExit: false,
      },
    });
  });

/** Clôture normale enseignant : fin = fin de séance planifiée. */
export const closeTeacherSessionAction = action
  .input(
    z.object({
      attendanceId: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, session, userId } = await requireBranchContext();

    const attendance = await prisma.teacherAttendance.findFirst({
      where: { id: input.attendanceId, branchId },
      include: {
        session: { select: { id: true, endTime: true } },
      },
    });

    if (!attendance) throw new Error("Présence enseignant introuvable.");
    if (attendance.earlyExit) {
      throw new Error("Sortie anticipée déjà enregistrée.");
    }

    await assertTeacherAttendanceWriteAccess({
      session,
      userId,
      branchId,
      sessionId: attendance.sessionId,
      teacherId: attendance.teacherId,
    });

    return prisma.teacherAttendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: attendance.session.endTime,
        earlyExit: false,
      },
    });
  });

/** Clôture normale (fin de vacation / fin de journée / fin de cours). */
export const recordNormalCheckoutAction = action
  .input(
    z.object({
      personType: z.enum(["student", "teacher", "personnel"]),
      attendanceId: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, session, userId } = await requireBranchContext();
    const now = nowLocal();

    if (input.personType === "student") {
      const attendance = await prisma.studentAttendance.findFirst({
        where: { id: input.attendanceId, branchId },
        select: {
          id: true,
          studentId: true,
          sessionId: true,
          earlyExit: true,
          checkOut: true,
          recordedAt: true,
        },
      });
      if (!attendance) throw new Error("Présence élève introuvable.");
      if (attendance.earlyExit || attendance.checkOut) {
        throw new Error("Sortie déjà enregistrée.");
      }
      await assertStudentAttendanceWriteAccess({
        session,
        userId,
        branchId,
        sessionId: attendance.sessionId,
        studentId: attendance.studentId,
      });
      const expectedEnd =
        (await resolveStudentExpectedEnd(
          attendance.studentId,
          branchId,
          attendance.recordedAt,
        )) ?? now;
      return prisma.studentAttendance.update({
        where: { id: attendance.id },
        data: { checkOut: expectedEnd, earlyExit: false },
      });
    }

    if (input.personType === "teacher") {
      const attendance = await prisma.teacherAttendance.findFirst({
        where: { id: input.attendanceId, branchId },
        include: { session: { select: { endTime: true } } },
      });
      if (!attendance) throw new Error("Présence enseignant introuvable.");
      if (attendance.earlyExit || attendance.checkOut) {
        throw new Error("Sortie déjà enregistrée.");
      }
      await assertTeacherAttendanceWriteAccess({
        session,
        userId,
        branchId,
        sessionId: attendance.sessionId,
        teacherId: attendance.teacherId,
      });
      return prisma.teacherAttendance.update({
        where: { id: attendance.id },
        data: {
          checkOut: attendance.session.endTime,
          earlyExit: false,
        },
      });
    }

    if (!canManageOrganization(session)) {
      throw new Error("Seuls les responsables peuvent pointer le personnel.");
    }
    const attendance = await prisma.personnelAttendance.findFirst({
      where: { id: input.attendanceId, branchId },
      select: { id: true, checkIn: true, checkOut: true, earlyExit: true },
    });
    if (!attendance) throw new Error("Présence personnel introuvable.");
    if (!attendance.checkIn) {
      throw new Error("Le personnel n'a pas encore pointé l'arrivée.");
    }
    if (attendance.earlyExit || attendance.checkOut) {
      throw new Error("Sortie déjà enregistrée.");
    }
    return prisma.personnelAttendance.update({
      where: { id: attendance.id },
      data: { checkOut: now, earlyExit: false },
    });
  });

/* =========================
   RAPPORTS JOURNALIER / SÉANCES
========================= */

export type AttendanceDailyExitRow = {
  id: string;
  personType: "student" | "teacher" | "personnel";
  personName: string;
  contextLabel: string;
  checkIn: string | null;
  checkOut: string | null;
  exitReason: string;
  statusLabel: string;
};

export type TeacherSessionReportRow = {
  id: string;
  date: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  classeName: string;
  sessionLabel: string;
  sessionIndex: number;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  minutesDone: number | null;
  minutesLabel: string;
  earlyExit: boolean;
  exitReason: string | null;
  status: string;
  statusLabel: string;
};

export type TeacherSessionReport = {
  dateStart: string;
  dateEnd: string;
  teacherId: string | null;
  teacherName: string | null;
  classeId: string | null;
  classeName: string | null;
  rows: TeacherSessionReportRow[];
  summary: {
    sessions: number;
    minutesTotal: number;
    earlyExits: number;
  };
};

export type AttendanceDailyJournal = {
  date: string;
  teacherSessions: TeacherSessionReportRow[];
  earlyExits: AttendanceDailyExitRow[];
  stats: {
    teacherSessions: number;
    teacherMinutes: number;
    studentEarlyExits: number;
    teacherEarlyExits: number;
    personnelEarlyExits: number;
  };
};

function formatTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateIso(date: Date): string {
  return date.toISOString();
}

function personName(user: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  if (!user) return "—";
  return (
    [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim() ||
    "—"
  );
}

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "Retard",
  EXCUSED: "Excusé",
};

export const getAttendanceReportContextAction = action.handler(async () => {
  const { branchId, organizationId } = await requireBranchContext();
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: schoolReportBranchSelect,
  });
  if (!branch) throw new Error("Contexte introuvable.");
  return buildSchoolReportContext(branch);
});

export const getTeacherSessionReportAction = action
  .input(
    z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      teacherId: z.string().optional().nullable(),
      classeId: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }): Promise<TeacherSessionReport> => {
    const { branchId } = await requireBranchContext();

    const start = new Date(input.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);
    if (end < start) {
      throw new Error("La date de fin doit être postérieure à la date de début.");
    }

    const teacherId = input.teacherId?.trim() || null;
    const classeId = input.classeId?.trim() || null;

    const records = await prisma.teacherAttendance.findMany({
      where: {
        branchId,
        date: { gte: start, lte: end },
        ...(teacherId ? { teacherId } : {}),
        ...(classeId
          ? { session: { teaching: { classeId } } }
          : {}),
      },
      include: {
        teacher: {
          include: {
            branchMember: {
              include: { member: { include: { user: true } } },
            },
          },
        },
        session: {
          include: {
            teaching: {
              include: {
                cours: { select: { nameCours: true } },
                classe: {
                  select: { id: true, nameClasse: true, codeClasse: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ date: "asc" }, { checkIn: "asc" }],
    });

    const byTeacherDay = new Map<string, number>();
    const rows: TeacherSessionReportRow[] = [];

    for (const record of records) {
      const dayKey = `${record.teacherId}:${record.date.toISOString().slice(0, 10)}`;
      const index = byTeacherDay.get(dayKey) ?? 0;
      byTeacherDay.set(dayKey, index + 1);

      const actualStart = record.checkIn ?? record.createdAt;
      const actualEnd =
        record.checkOut ??
        (record.earlyExit ? null : record.session.endTime);
      const minutes = minutesBetween(actualStart, actualEnd);

      const classe = record.session.teaching?.classe;
      rows.push({
        id: record.id,
        date: formatDateIso(record.date),
        teacherId: record.teacherId,
        teacherName: personName(
          record.teacher?.branchMember?.member?.user ?? null,
        ),
        subject:
          record.session.teaching?.cours?.nameCours?.trim() || "Matière",
        classeName:
          classe?.nameClasse?.trim() ||
          classe?.codeClasse?.trim() ||
          "Classe",
        sessionLabel: formatSessionOrdinal(index),
        sessionIndex: index + 1,
        plannedStart: formatTime(record.session.startTime) ?? "—",
        plannedEnd: formatTime(record.session.endTime) ?? "—",
        actualStart: formatTime(actualStart),
        actualEnd: formatTime(actualEnd),
        minutesDone: minutes,
        minutesLabel:
          minutes == null
            ? "—"
            : `${Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)} h ` : ""}${minutes % 60} min`.trim(),
        earlyExit: record.earlyExit,
        exitReason: record.exitReason,
        status: record.status,
        statusLabel: STATUS_LABELS[record.status] ?? record.status,
      });
    }

    let teacherName: string | null = null;
    let classeName: string | null = null;
    if (teacherId) {
      teacherName =
        rows.find((r) => r.teacherId === teacherId)?.teacherName ?? null;
    }
    if (classeId) {
      const classe = await prisma.classe.findFirst({
        where: { id: classeId, branchId },
        select: { nameClasse: true, codeClasse: true },
      });
      classeName =
        classe?.nameClasse?.trim() || classe?.codeClasse?.trim() || null;
    }

    const minutesTotal = rows.reduce(
      (acc, row) => acc + (row.minutesDone ?? 0),
      0,
    );

    return {
      dateStart: start.toISOString(),
      dateEnd: end.toISOString(),
      teacherId,
      teacherName,
      classeId,
      classeName,
      rows,
      summary: {
        sessions: rows.length,
        minutesTotal,
        earlyExits: rows.filter((r) => r.earlyExit).length,
      },
    };
  });

export const getAttendanceDailyJournalAction = action
  .input(
    z.object({
      date: z.coerce.date(),
    }),
  )
  .handler(async ({ input }): Promise<AttendanceDailyJournal> => {
    const { branchId } = await requireBranchContext();
    const start = new Date(input.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(input.date);
    end.setHours(23, 59, 59, 999);

    const [students, teachers, personnels, rebuilt] = await Promise.all([
      prisma.studentAttendance.findMany({
        where: {
          branchId,
          earlyExit: true,
          OR: [
            { checkOut: { gte: start, lte: end } },
            { recordedAt: { gte: start, lte: end } },
          ],
        },
        include: {
          student: {
            include: {
              branchMember: {
                include: { member: { include: { user: true } } },
              },
            },
          },
          session: {
            include: {
              teaching: {
                include: {
                  classe: { select: { nameClasse: true, codeClasse: true } },
                  cours: { select: { nameCours: true } },
                },
              },
            },
          },
        },
      }),
      prisma.teacherAttendance.findMany({
        where: {
          branchId,
          earlyExit: true,
          date: { gte: start, lte: end },
        },
        include: {
          teacher: {
            include: {
              branchMember: {
                include: { member: { include: { user: true } } },
              },
            },
          },
          session: {
            include: {
              teaching: {
                include: {
                  classe: { select: { nameClasse: true, codeClasse: true } },
                  cours: { select: { nameCours: true } },
                },
              },
            },
          },
        },
      }),
      prisma.personnelAttendance.findMany({
        where: {
          branchId,
          earlyExit: true,
          date: { gte: start, lte: end },
        },
        include: {
          personnel: {
            include: {
              branchMember: {
                include: { member: { include: { user: true } } },
              },
            },
          },
        },
      }),
      prisma.teacherAttendance.findMany({
        where: {
          branchId,
          date: { gte: start, lte: end },
        },
        include: {
          teacher: {
            include: {
              branchMember: {
                include: { member: { include: { user: true } } },
              },
            },
          },
          session: {
            include: {
              teaching: {
                include: {
                  cours: { select: { nameCours: true } },
                  classe: {
                    select: { id: true, nameClasse: true, codeClasse: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ date: "asc" }, { checkIn: "asc" }],
      }),
    ]);

    const byTeacherDay = new Map<string, number>();
    const teacherSessionRows: TeacherSessionReportRow[] = [];
    for (const record of rebuilt) {
      const dayKey = `${record.teacherId}:${record.date.toISOString().slice(0, 10)}`;
      const index = byTeacherDay.get(dayKey) ?? 0;
      byTeacherDay.set(dayKey, index + 1);
      const actualStart = record.checkIn ?? record.createdAt;
      const actualEnd =
        record.checkOut ??
        (record.earlyExit ? null : record.session.endTime);
      const minutes = minutesBetween(actualStart, actualEnd);
      const classe = record.session.teaching?.classe;
      teacherSessionRows.push({
        id: record.id,
        date: formatDateIso(record.date),
        teacherId: record.teacherId,
        teacherName: personName(
          record.teacher?.branchMember?.member?.user ?? null,
        ),
        subject:
          record.session.teaching?.cours?.nameCours?.trim() || "Matière",
        classeName:
          classe?.nameClasse?.trim() ||
          classe?.codeClasse?.trim() ||
          "Classe",
        sessionLabel: formatSessionOrdinal(index),
        sessionIndex: index + 1,
        plannedStart: formatTime(record.session.startTime) ?? "—",
        plannedEnd: formatTime(record.session.endTime) ?? "—",
        actualStart: formatTime(actualStart),
        actualEnd: formatTime(actualEnd),
        minutesDone: minutes,
        minutesLabel:
          minutes == null
            ? "—"
            : `${Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)} h ` : ""}${minutes % 60} min`.trim(),
        earlyExit: record.earlyExit,
        exitReason: record.exitReason,
        status: record.status,
        statusLabel: STATUS_LABELS[record.status] ?? record.status,
      });
    }

    const earlyExits: AttendanceDailyExitRow[] = [
      ...students.map((row) => ({
        id: row.id,
        personType: "student" as const,
        personName: personName(
          row.student?.branchMember?.member?.user ?? null,
        ),
        contextLabel: [
          row.session.teaching?.classe?.nameClasse ||
            row.session.teaching?.classe?.codeClasse,
          row.session.teaching?.cours?.nameCours,
        ]
          .filter(Boolean)
          .join(" · "),
        checkIn: formatTime(row.checkIn ?? row.recordedAt),
        checkOut: formatTime(row.checkOut),
        exitReason: row.exitReason || "—",
        statusLabel: STATUS_LABELS[row.status] ?? row.status,
      })),
      ...teachers.map((row) => ({
        id: row.id,
        personType: "teacher" as const,
        personName: personName(
          row.teacher?.branchMember?.member?.user ?? null,
        ),
        contextLabel: [
          row.session.teaching?.classe?.nameClasse ||
            row.session.teaching?.classe?.codeClasse,
          row.session.teaching?.cours?.nameCours,
        ]
          .filter(Boolean)
          .join(" · "),
        checkIn: formatTime(row.checkIn ?? row.createdAt),
        checkOut: formatTime(row.checkOut),
        exitReason: row.exitReason || "—",
        statusLabel: STATUS_LABELS[row.status] ?? row.status,
      })),
      ...personnels.map((row) => ({
        id: row.id,
        personType: "personnel" as const,
        personName: personName(
          row.personnel?.branchMember?.member?.user ?? null,
        ),
        contextLabel: "Personnel",
        checkIn: formatTime(row.checkIn),
        checkOut: formatTime(row.checkOut),
        exitReason: row.exitReason || "—",
        statusLabel: STATUS_LABELS[row.status] ?? row.status,
      })),
    ];

    return {
      date: start.toISOString(),
      teacherSessions: teacherSessionRows,
      earlyExits,
      stats: {
        teacherSessions: teacherSessionRows.length,
        teacherMinutes: teacherSessionRows.reduce(
          (acc, row) => acc + (row.minutesDone ?? 0),
          0,
        ),
        studentEarlyExits: students.length,
        teacherEarlyExits: teachers.length,
        personnelEarlyExits: personnels.length,
      },
    };
  });

/* =========================
   ROSTER ÉLÈVES / PERSONNEL
========================= */

export type PersonRosterRow = {
  id: string;
  date: string;
  personId: string;
  personName: string;
  contextLabel: string;
  status: string;
  statusLabel: string;
  checkIn: string | null;
  checkOut: string | null;
  earlyExit: boolean;
  exitReason: string | null;
};

export type PersonRosterReport = {
  dateStart: string;
  dateEnd: string;
  classeId: string | null;
  classeName: string | null;
  rows: PersonRosterRow[];
  summary: {
    total: number;
    present: number;
    late: number;
    excused: number;
    absent: number;
    earlyExits: number;
  };
};

function emptyRosterSummary(): PersonRosterReport["summary"] {
  return {
    total: 0,
    present: 0,
    late: 0,
    excused: 0,
    absent: 0,
    earlyExits: 0,
  };
}

function bumpRosterSummary(
  summary: PersonRosterReport["summary"],
  status: string,
  earlyExit: boolean,
) {
  summary.total += 1;
  if (status === "PRESENT") summary.present += 1;
  else if (status === "LATE") summary.late += 1;
  else if (status === "EXCUSED") summary.excused += 1;
  else summary.absent += 1;
  if (earlyExit) summary.earlyExits += 1;
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function resolveDayStatus(
  statuses: string[],
): "PRESENT" | "LATE" | "EXCUSED" | "ABSENT" {
  if (statuses.length === 0) return "ABSENT";
  if (statuses.includes("LATE")) return "LATE";
  if (statuses.includes("PRESENT")) return "PRESENT";
  if (statuses.includes("EXCUSED")) return "EXCUSED";
  if (statuses.every((s) => s === "ABSENT")) return "ABSENT";
  return "ABSENT";
}

/** Rapport élèves : tout le monde, arrivée/sortie, absents, sorties motivées. */
export const getStudentRosterReportAction = action
  .input(
    z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      classeId: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }): Promise<PersonRosterReport> => {
    const { branchId } = await requireBranchContext();
    const start = new Date(input.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);
    if (end < start) {
      throw new Error("La date de fin doit être postérieure à la date de début.");
    }

    const classeId = input.classeId?.trim() || null;
    let classeName: string | null = null;
    if (classeId) {
      const classe = await prisma.classe.findFirst({
        where: { id: classeId, branchId },
        select: { nameClasse: true, codeClasse: true },
      });
      classeName =
        classe?.nameClasse?.trim() || classe?.codeClasse?.trim() || null;
    }

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        branchId,
        OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
        schoolYear: { branchId, isCurrentYear: true },
        ...(classeId ? { classeId } : {}),
      },
      select: {
        studentId: true,
        classe: {
          select: {
            id: true,
            nameClasse: true,
            codeClasse: true,
            creneau: { select: { endTime: true } },
          },
        },
        student: {
          select: {
            id: true,
            branchMember: {
              select: {
                member: {
                  select: {
                    user: {
                      select: { name: true, postnom: true, prenom: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      distinct: ["studentId"],
    });

    const attendance = await prisma.studentAttendance.findMany({
      where: {
        branchId,
        session: {
          date: { gte: start, lte: end },
          ...(classeId ? { teaching: { classeId } } : {}),
        },
      },
      select: {
        id: true,
        studentId: true,
        status: true,
        checkIn: true,
        checkOut: true,
        earlyExit: true,
        exitReason: true,
        recordedAt: true,
        session: { select: { date: true, endTime: true } },
      },
    });

    const byStudentDay = new Map<
      string,
      {
        statuses: string[];
        checkIns: Date[];
        checkOuts: Date[];
        earlyExit: boolean;
        exitReason: string | null;
        attendanceId: string;
      }
    >();

    for (const row of attendance) {
      const dayKey = `${row.studentId}:${row.session.date.toISOString().slice(0, 10)}`;
      const entry = byStudentDay.get(dayKey) ?? {
        statuses: [],
        checkIns: [],
        checkOuts: [],
        earlyExit: false,
        exitReason: null,
        attendanceId: row.id,
      };
      entry.statuses.push(row.status);
      if (row.checkIn) entry.checkIns.push(row.checkIn);
      else entry.checkIns.push(row.recordedAt);
      if (row.checkOut) entry.checkOuts.push(row.checkOut);
      else if (!row.earlyExit && row.session.endTime) {
        entry.checkOuts.push(row.session.endTime);
      }
      if (row.earlyExit) {
        entry.earlyExit = true;
        entry.exitReason = row.exitReason;
        entry.attendanceId = row.id;
      }
      byStudentDay.set(dayKey, entry);
    }

    const days = eachDay(start, end);
    const rows: PersonRosterRow[] = [];
    const summary = emptyRosterSummary();

    for (const day of days) {
      const dayIso = day.toISOString().slice(0, 10);
      for (const enrollment of enrollments) {
        const student = enrollment.student;
        const classe = enrollment.classe;
        if (!student || !classe) continue;
        const key = `${student.id}:${dayIso}`;
        const entry = byStudentDay.get(key);
        const status = resolveDayStatus(entry?.statuses ?? []);
        const vacationEnd = classe.creneau?.endTime
          ? combineDateWithCreneauTime(day, classe.creneau.endTime)
          : null;

        let checkOutDate: Date | null = null;
        if (entry?.checkOuts.length) {
          checkOutDate = new Date(
            Math.max(...entry.checkOuts.map((d) => d.getTime())),
          );
        } else if (status !== "ABSENT" && !entry?.earlyExit) {
          checkOutDate = vacationEnd;
        }

        const checkInDate = entry?.checkIns.length
          ? new Date(Math.min(...entry.checkIns.map((d) => d.getTime())))
          : null;

        const row: PersonRosterRow = {
          id: entry?.attendanceId ?? `${student.id}-${dayIso}`,
          date: day.toISOString(),
          personId: student.id,
          personName: personName(
            student.branchMember?.member?.user ?? null,
          ),
          contextLabel:
            classe.nameClasse?.trim() ||
            classe.codeClasse?.trim() ||
            "Classe",
          status,
          statusLabel: STATUS_LABELS[status] ?? status,
          checkIn: formatTime(checkInDate),
          checkOut: formatTime(checkOutDate),
          earlyExit: Boolean(entry?.earlyExit),
          exitReason: entry?.exitReason ?? null,
        };
        rows.push(row);
        bumpRosterSummary(summary, status, row.earlyExit);
      }
    }

    rows.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      const byClass = a.contextLabel.localeCompare(b.contextLabel, "fr");
      if (byClass !== 0) return byClass;
      return a.personName.localeCompare(b.personName, "fr");
    });

    return {
      dateStart: start.toISOString(),
      dateEnd: end.toISOString(),
      classeId,
      classeName,
      rows,
      summary,
    };
  });

/** Rapport personnel : tout le monde, arrivée/sortie, absents, sorties motivées. */
export const getPersonnelRosterReportAction = action
  .input(
    z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    }),
  )
  .handler(async ({ input }): Promise<PersonRosterReport> => {
    const { branchId } = await requireBranchContext();
    const start = new Date(input.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);
    if (end < start) {
      throw new Error("La date de fin doit être postérieure à la date de début.");
    }

    const personnelList = await prisma.personnel.findMany({
      where: { branchMember: { branchId } },
      select: {
        id: true,
        branchMember: {
          select: {
            member: {
              select: {
                role: true,
                user: {
                  select: { name: true, postnom: true, prenom: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const attendance = await prisma.personnelAttendance.findMany({
      where: {
        branchId,
        date: { gte: start, lte: end },
      },
      select: {
        id: true,
        personnelId: true,
        date: true,
        status: true,
        checkIn: true,
        checkOut: true,
        earlyExit: true,
        exitReason: true,
      },
    });

    const byPersonDay = new Map<string, (typeof attendance)[number]>();
    for (const row of attendance) {
      byPersonDay.set(
        `${row.personnelId}:${row.date.toISOString().slice(0, 10)}`,
        row,
      );
    }

    const days = eachDay(start, end);
    const rows: PersonRosterRow[] = [];
    const summary = emptyRosterSummary();

    for (const day of days) {
      const dayIso = day.toISOString().slice(0, 10);
      for (const person of personnelList) {
        const record = byPersonDay.get(`${person.id}:${dayIso}`);
        const status = (record?.status ?? "ABSENT") as
          | "PRESENT"
          | "LATE"
          | "EXCUSED"
          | "ABSENT";
        const role = person.branchMember?.member?.role;
        const row: PersonRosterRow = {
          id: record?.id ?? `${person.id}-${dayIso}`,
          date: day.toISOString(),
          personId: person.id,
          personName: personName(
            person.branchMember?.member?.user ?? null,
          ),
          contextLabel: role ? String(role) : "Personnel",
          status,
          statusLabel: STATUS_LABELS[status] ?? status,
          checkIn: formatTime(record?.checkIn ?? null),
          checkOut: formatTime(record?.checkOut ?? null),
          earlyExit: Boolean(record?.earlyExit),
          exitReason: record?.exitReason ?? null,
        };
        rows.push(row);
        bumpRosterSummary(summary, status, row.earlyExit);
      }
    }

    rows.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.personName.localeCompare(b.personName, "fr");
    });

    return {
      dateStart: start.toISOString(),
      dateEnd: end.toISOString(),
      classeId: null,
      classeName: null,
      rows,
      summary,
    };
  });

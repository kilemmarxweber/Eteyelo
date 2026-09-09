"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyTeacherPayrollImpact } from "@/lib/payroll/teacher-payroll-notifications";
import { action } from "@/lib/zsa";
import { requireAttendanceScanContext } from "@/lib/auth/attendance-kiosk-context";
import {
  assertStudentAttendanceWriteAccess,
  assertTeacherAttendanceWriteAccess,
} from "@/lib/auth/data-scope";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { memberIsAttendanceOwner } from "@/lib/attendance/owner-pointage";
import { AttendanceExitReason } from "@/prisma/generated/prisma/client";
import {
  ATTENDANCE_EXIT_REASON_LABELS,
  combineDateWithCreneauTime,
  formatDurationMinutes,
  formatSessionOrdinal,
  minutesBetween,
} from "@/lib/attendance-exit";
import { isStudentNormalCheckoutAllowed } from "@/lib/attendance-student-session";
import {
  getTeacherDayCreneauEnd,
  isTeacherNormalCheckoutAllowed,
  teacherUsesDayLevelPunch,
} from "@/lib/attendance-teacher-session";
import { nowLocal, startOfTodayParis } from "@/lib/timezone";
import {
  getBranchLatestEndMinutes,
  isPersonnelNormalCheckoutAllowed,
  minutesToLocalDate,
} from "@/lib/branch-closed-days";
import {
  buildLocalizedSchoolReportContext,
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
    const { branchId, session, userId } = await requireAttendanceScanContext();
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
    const { branchId, organizationId, session, userId } = await requireAttendanceScanContext();
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
    const { branchId, session } = await requireAttendanceScanContext();
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
    const { branchId, organizationId, session, userId } = await requireAttendanceScanContext();

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

    const allowNormal = await isStudentNormalCheckoutAllowed(
      attendance.studentId,
      branchId,
    );
    if (!allowNormal) {
      throw new Error(
        "La fin normale n'est possible qu'à l'heure de fin du créneau. Avant cela, enregistrez une sortie anticipée avec justification.",
      );
    }

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
    const { branchId, session, userId } = await requireAttendanceScanContext();

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

    const dayLevel = await teacherUsesDayLevelPunch(
      attendance.teacherId,
      branchId,
    );
    if (dayLevel) {
      const allowNormal = await isTeacherNormalCheckoutAllowed(
        attendance.teacherId,
        branchId,
      );
      if (!allowNormal) {
        throw new Error(
          "La fin normale n'est possible qu'à l'heure de fin du créneau. Avant cela, enregistrez une sortie anticipée avec justification.",
        );
      }
    }

    const checkoutAt = dayLevel
      ? ((await getTeacherDayCreneauEnd(attendance.teacherId, branchId)) ??
        combineDateWithCreneauTime(
          attendance.date ?? nowLocal(),
          attendance.session.endTime,
        ))
      : combineDateWithCreneauTime(
          attendance.date ?? nowLocal(),
          attendance.session.endTime,
        );

    return prisma.teacherAttendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: checkoutAt,
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
    const { branchId, session, userId } = await requireAttendanceScanContext();
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
      const allowNormal = await isStudentNormalCheckoutAllowed(
        attendance.studentId,
        branchId,
        now,
      );
    if (!allowNormal) {
      throw new Error(
        "La fin normale n'est possible qu'à l'heure de fin du créneau. Avant cela, enregistrez une sortie anticipée avec justification.",
      );
    }
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
      const dayLevel = await teacherUsesDayLevelPunch(
        attendance.teacherId,
        branchId,
      );
      if (dayLevel) {
        const allowNormal = await isTeacherNormalCheckoutAllowed(
          attendance.teacherId,
          branchId,
          now,
        );
        if (!allowNormal) {
          throw new Error(
            "La fin normale n'est possible qu'à l'heure de fin du créneau. Avant cela, enregistrez une sortie anticipée avec justification.",
          );
        }
      }
      const checkoutAt = dayLevel
        ? ((await getTeacherDayCreneauEnd(attendance.teacherId, branchId)) ??
          combineDateWithCreneauTime(
            attendance.date ?? now,
            attendance.session.endTime,
          ))
        : combineDateWithCreneauTime(
            attendance.date ?? now,
            attendance.session.endTime,
          );
      return prisma.teacherAttendance.update({
        where: { id: attendance.id },
        data: {
          checkOut: checkoutAt,
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
    const allowNormal = await isPersonnelNormalCheckoutAllowed(branchId, now);
    if (!allowNormal) {
      throw new Error(
        "La fin normale n'est possible qu'à l'heure de fin du créneau. Avant cela, enregistrez une sortie anticipée avec justification.",
      );
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
  IN_CLASS: "En classe",
  IN_PROGRESS: "En cours",
};

export const getAttendanceReportContextAction = action.handler(async () => {
  const { branchId, organizationId } = await requireAttendanceScanContext();
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: schoolReportBranchSelect,
  });
  if (!branch) throw new Error("Contexte introuvable.");
  return buildLocalizedSchoolReportContext(branch);
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
    const { branchId } = await requireAttendanceScanContext();
    const now = nowLocal();
    const { start, endDay, queryEnd } = reportDayRange(
      input.startDate,
      input.endDate,
    );

    const teacherId = input.teacherId?.trim() || null;
    const classeId = input.classeId?.trim() || null;

    const records = await prisma.teacherAttendance.findMany({
      where: {
        branchId,
        date: { gte: start, lte: queryEnd },
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
      const dayKey = `${record.teacherId}:${calendarDayIso(record.date)}`;
      const index = byTeacherDay.get(dayKey) ?? 0;
      byTeacherDay.set(dayKey, index + 1);

      const actualStart = record.checkIn ?? null;
      const periodEnd = combineDateWithCreneauTime(
        record.date ?? now,
        record.session.endTime,
      );
      const stillOpen =
        Boolean(actualStart) &&
        !record.checkOut &&
        !record.earlyExit &&
        now.getTime() < periodEnd.getTime();
      const actualEnd = record.checkOut ?? null;
      const minutes = minutesBetween(actualStart, actualEnd);
      const status = !actualStart
        ? now.getTime() >= periodEnd.getTime() || record.status === "ABSENT"
          ? "ABSENT"
          : record.status
        : stillOpen
          ? "IN_PROGRESS"
          : record.status;

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
        minutesLabel: formatDurationMinutes(minutes),
        earlyExit: record.earlyExit,
        exitReason: record.exitReason,
        status,
        statusLabel: STATUS_LABELS[status] ?? status,
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
      dateEnd: endDay.toISOString(),
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
    const { branchId } = await requireAttendanceScanContext();
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
      const actualStart = record.checkIn ?? null;
      const periodEnd = combineDateWithCreneauTime(
        record.date ?? nowLocal(),
        record.session.endTime,
      );
      const stillOpen =
        Boolean(actualStart) &&
        !record.checkOut &&
        !record.earlyExit &&
        nowLocal().getTime() < periodEnd.getTime();
      const actualEnd =
        record.checkOut ??
        (record.earlyExit ? null : record.session.endTime);
      const minutes = minutesBetween(actualStart, actualEnd);
      const status = !actualStart
        ? nowLocal().getTime() >= periodEnd.getTime() || record.status === "ABSENT"
          ? "ABSENT"
          : record.status
        : stillOpen
          ? "IN_PROGRESS"
          : record.status;
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
        minutesLabel: formatDurationMinutes(minutes),
        earlyExit: record.earlyExit,
        exitReason: record.exitReason,
        status,
        statusLabel: STATUS_LABELS[status] ?? status,
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
        checkIn: formatTime(row.checkIn),
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
        checkIn: formatTime(row.checkIn),
        checkOut: formatTime(row.checkOut),
        exitReason: row.exitReason || "—",
        statusLabel: STATUS_LABELS[row.status] ?? row.status,
      })),
      ...personnels
        .filter(
          (row) =>
            !memberIsAttendanceOwner(row.personnel?.branchMember?.member),
        )
        .map((row) => ({
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
        personnelEarlyExits: earlyExits.filter(
          (row) => row.personType === "personnel",
        ).length,
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
  if (status === "PRESENT" || status === "IN_CLASS" || status === "IN_PROGRESS") {
    summary.present += 1;
  } else if (status === "LATE") summary.late += 1;
  else if (status === "EXCUSED") summary.excused += 1;
  else summary.absent += 1;
  if (earlyExit) summary.earlyExits += 1;
}

function calendarDayIso(date: Date): string {
  return startOfTodayParis(date).toISOString().slice(0, 10);
}

function reportDayRange(startDate: Date, endDate: Date) {
  const start = startOfTodayParis(startDate);
  const endDay = startOfTodayParis(endDate);
  if (endDay.getTime() < start.getTime()) {
    throw new Error("La date de fin doit être postérieure à la date de début.");
  }
  const queryEnd = new Date(endDay);
  queryEnd.setUTCHours(23, 59, 59, 999);
  return { start, endDay, queryEnd };
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfTodayParis(start);
  const last = startOfTodayParis(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function pickTime(dates: Date[], which: "min" | "max"): Date | null {
  const valid = dates.filter(
    (value) =>
      Number.isFinite(value.getTime()) && value.getUTCFullYear() >= 1990,
  );
  if (!valid.length) return null;
  const ts = valid.map((value) => value.getTime());
  return new Date(which === "min" ? Math.min(...ts) : Math.max(...ts));
}

function resolveOpenRosterStatus(params: {
  baseStatus: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";
  checkIn: Date | null;
  checkOut: Date | null;
  earlyExit: boolean;
  periodEnd: Date | null;
  openStatus: "IN_CLASS" | "IN_PROGRESS";
}) {
  const base =
    params.checkIn && params.baseStatus === "ABSENT"
      ? "PRESENT"
      : params.baseStatus;

  if (!params.checkIn) {
    return {
      status: "ABSENT" as const,
      statusLabel: STATUS_LABELS.ABSENT,
      checkOut: null as Date | null,
    };
  }

  if (params.earlyExit || params.checkOut) {
    return {
      status: base,
      statusLabel: STATUS_LABELS[base] ?? base,
      checkOut: params.checkOut,
    };
  }

  const now = nowLocal();
  const periodEnded = params.periodEnd ? now.getTime() >= params.periodEnd.getTime() : false;
  if (!periodEnded) {
    return {
      status: params.openStatus,
      statusLabel: STATUS_LABELS[params.openStatus],
      checkOut: null,
    };
  }

  return {
    status: base,
    statusLabel: STATUS_LABELS[base] ?? base,
    checkOut: null,
  };
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
    const { branchId } = await requireAttendanceScanContext();
    const { start, endDay, queryEnd } = reportDayRange(
      input.startDate,
      input.endDate,
    );

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
            creneau: { select: { startTime: true, endTime: true } },
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
          date: { gte: start, lte: queryEnd },
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
        session: { select: { date: true } },
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
      const dayKey = `${row.studentId}:${calendarDayIso(row.session.date)}`;
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
      if (row.checkOut) entry.checkOuts.push(row.checkOut);
      if (row.earlyExit) {
        entry.earlyExit = true;
        entry.exitReason = row.exitReason;
        entry.attendanceId = row.id;
      }
      byStudentDay.set(dayKey, entry);
    }

    const days = eachDay(start, endDay);
    const rows: PersonRosterRow[] = [];
    const summary = emptyRosterSummary();

    for (const day of days) {
      const dayIso = calendarDayIso(day);
      for (const enrollment of enrollments) {
        const student = enrollment.student;
        const classe = enrollment.classe;
        if (!student || !classe) continue;
        const key = `${student.id}:${dayIso}`;
        const entry = byStudentDay.get(key);
        const baseStatus = resolveDayStatus(entry?.statuses ?? []);
        const vacationEnd = classe.creneau?.endTime
          ? combineDateWithCreneauTime(day, classe.creneau.endTime)
          : null;
        const checkInDate = pickTime(entry?.checkIns ?? [], "min");
        const checkOutDate = pickTime(entry?.checkOuts ?? [], "max");
        const resolved = resolveOpenRosterStatus({
          baseStatus,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          earlyExit: Boolean(entry?.earlyExit),
          periodEnd: vacationEnd,
          openStatus: "IN_CLASS",
        });

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
          status: resolved.status,
          statusLabel: resolved.statusLabel,
          checkIn: formatTime(checkInDate),
          checkOut: formatTime(resolved.checkOut),
          earlyExit: Boolean(entry?.earlyExit),
          exitReason: entry?.exitReason ?? null,
        };
        rows.push(row);
        bumpRosterSummary(summary, resolved.status, row.earlyExit);
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
      dateEnd: endDay.toISOString(),
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
    const { branchId } = await requireAttendanceScanContext();
    const { start, endDay, queryEnd } = reportDayRange(
      input.startDate,
      input.endDate,
    );
    const dayEndMinutes = await getBranchLatestEndMinutes(branchId);

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
                  select: { name: true, postnom: true, prenom: true, role: true },
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
        date: { gte: start, lte: queryEnd },
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
        `${row.personnelId}:${calendarDayIso(row.date)}`,
        row,
      );
    }

    const days = eachDay(start, endDay);
    const rows: PersonRosterRow[] = [];
    const summary = emptyRosterSummary();

    for (const day of days) {
      const dayIso = calendarDayIso(day);
      for (const person of personnelList) {
        if (memberIsAttendanceOwner(person.branchMember?.member)) {
          continue;
        }
        const record = byPersonDay.get(`${person.id}:${dayIso}`);
        const baseStatus = (record?.status ?? "ABSENT") as
          | "PRESENT"
          | "LATE"
          | "EXCUSED"
          | "ABSENT";
        const resolved = resolveOpenRosterStatus({
          baseStatus,
          checkIn: record?.checkIn ?? null,
          checkOut: record?.checkOut ?? null,
          earlyExit: Boolean(record?.earlyExit),
          periodEnd: minutesToLocalDate(dayEndMinutes, day),
          openStatus: "IN_PROGRESS",
        });
        const role = person.branchMember?.member?.role;
        const row: PersonRosterRow = {
          id: record?.id ?? `${person.id}-${dayIso}`,
          date: day.toISOString(),
          personId: person.id,
          personName: personName(
            person.branchMember?.member?.user ?? null,
          ),
          contextLabel: role ? String(role) : "Personnel",
          status: resolved.status,
          statusLabel: resolved.statusLabel,
          checkIn: formatTime(record?.checkIn ?? null),
          checkOut: formatTime(resolved.checkOut),
          earlyExit: Boolean(record?.earlyExit),
          exitReason: record?.exitReason ?? null,
        };
        rows.push(row);
        bumpRosterSummary(summary, resolved.status, row.earlyExit);
      }
    }

    rows.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.personName.localeCompare(b.personName, "fr");
    });

    return {
      dateStart: start.toISOString(),
      dateEnd: endDay.toISOString(),
      classeId: null,
      classeName: null,
      rows,
      summary,
    };
  });

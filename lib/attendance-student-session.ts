import { prisma } from "@/lib/prisma";
import { Day, type Prisma } from "@/prisma/generated/prisma/client";
import { formatExpectedSessionLabel } from "@/lib/attendance-schedule-label";
import { isBranchClosedOn } from "@/lib/branch-closed-days";
import {
  ensureAttendanceSessionForSchedule,
  getBranchCourseDurationMinutes,
  getOrCreateTeacherAttendanceSession,
} from "@/lib/attendance-teacher-session";
import {
  combineDateWithCreneauTime,
  creneauEndTimeDate,
  creneauStartTimeDate,
  resolveCreneauClockHours,
  isAtOrAfterCreneauEnd,
} from "@/lib/attendance-exit";
import {
  TEACHER_COURSE_DURATION_MINUTES,
  getParisWeekday,
  isTeacherCheckInWindow,
  nowLocal,
  scheduleHourToMinutes,
  startOfTodayParis,
  toMinutes,
} from "@/lib/timezone";
import { hmToUtcTimeDate } from "@/lib/creneau-saturday";

const DAY_BY_WEEKDAY = {
  0: Day.Dimanche,
  1: Day.Lundi,
  2: Day.Mardi,
  3: Day.Mercredi,
  4: Day.Jeudi,
  5: Day.Vendredi,
  6: Day.Samedi,
} as const;

type StudentScheduleCandidate = {
  teachingId: string;
  scheduleId: string;
  startMinutes: number;
};

function getTodayDay(date = nowLocal()) {
  return DAY_BY_WEEKDAY[getParisWeekday(date) as keyof typeof DAY_BY_WEEKDAY];
}

function teachingBranchWhere(branchId: string, classeId: string) {
  return {
    classeId,
    OR: [{ branchId }, { branchId: null, classe: { branchId } }],
    schoolYear: {
      branchId,
      isCurrentYear: true,
    },
  };
}

function rankScheduleCandidates(
  candidates: StudentScheduleCandidate[],
  currentMinutes: number,
  courseDurationMinutes: number,
) {
  return [...candidates].sort((left, right) => {
    const leftDistance = Math.abs(left.startMinutes - currentMinutes);
    const rightDistance = Math.abs(right.startMinutes - currentMinutes);

    const leftUpcoming = left.startMinutes >= currentMinutes;
    const rightUpcoming = right.startMinutes >= currentMinutes;
    if (leftUpcoming !== rightUpcoming) {
      return leftUpcoming ? -1 : 1;
    }

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return left.startMinutes - right.startMinutes;
  });
}

export async function listClassScheduleCandidates(
  classeId: string,
  branchId: string,
  now = nowLocal(),
) {
  if (await isBranchClosedOn(branchId, now)) return [];

  const currentMinutes = toMinutes(now);
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);
  const today = getTodayDay(now);

  const schedules = await prisma.schedule.findMany({
    where: {
      day: today,
      isArchived: false,
      teaching: teachingBranchWhere(branchId, classeId),
    },
    include: {
      teaching: {
        include: {
          cours: { select: { nameCours: true } },
          classe: { select: { codeClasse: true, nameClasse: true } },
        },
      },
    },
  });

  const candidates: StudentScheduleCandidate[] = [];

  for (const schedule of schedules) {
    if (!schedule.hour || !schedule.teachingId) continue;

    const startMinutes = scheduleHourToMinutes(schedule.hour);
    if (
      !isTeacherCheckInWindow(
        currentMinutes,
        startMinutes,
        courseDurationMinutes,
      )
    ) {
      continue;
    }

    candidates.push({
      teachingId: schedule.teachingId,
      scheduleId: schedule.id,
      startMinutes,
    });
  }

  return rankScheduleCandidates(
    candidates,
    currentMinutes,
    courseDurationMinutes,
  );
}

export async function listStudentScheduleCandidates(
  studentId: string,
  branchId: string,
  now = nowLocal(),
) {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentId,
      branchId,
      OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
    },
    orderBy: { createdAt: "desc" },
    select: { classeId: true },
  });

  if (!enrollment) return [];

  return listClassScheduleCandidates(enrollment.classeId, branchId, now);
}

export async function getOrCreateStudentAttendanceSession(
  teachingId: string,
  scheduleId: string,
  branchId: string,
  courseDurationMinutes = TEACHER_COURSE_DURATION_MINUTES,
) {
  return getOrCreateTeacherAttendanceSession(
    teachingId,
    scheduleId,
    branchId,
    courseDurationMinutes,
  );
}

export async function findStudentCheckInSession(
  studentId: string,
  branchId: string,
  include?: Prisma.AttendanceSessionInclude,
) {
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);
  const candidates = await listStudentScheduleCandidates(studentId, branchId);

  for (const candidate of candidates) {
    const session = await getOrCreateStudentAttendanceSession(
      candidate.teachingId,
      candidate.scheduleId,
      branchId,
      courseDurationMinutes,
    );

    if (!session) continue;

    return prisma.attendanceSession.findFirst({
      where: { id: session.id },
      include,
    });
  }

  return null;
}

export async function getExpectedStudentSessionLabel(
  studentId: string,
  branchId: string,
  now = nowLocal(),
) {
  const candidates = await listStudentScheduleCandidates(
    studentId,
    branchId,
    now,
  );
  if (!candidates.length) return null;

  const schedule = await prisma.schedule.findFirst({
    where: { id: candidates[0].scheduleId },
    include: {
      teaching: {
        include: {
          cours: { select: { nameCours: true } },
          classe: { select: { codeClasse: true, nameClasse: true } },
        },
      },
    },
  });

  if (!schedule?.hour || !schedule.teaching) return null;

  return formatExpectedSessionLabel(schedule.hour, schedule.teaching);
}

type ClassDaySchedule = {
  teachingId: string;
  scheduleId: string;
  startMinutes: number;
  hour: Date;
};

export async function listClassDaySchedules(
  classeId: string,
  branchId: string,
  now = nowLocal(),
): Promise<ClassDaySchedule[]> {
  if (await isBranchClosedOn(branchId, now)) return [];

  const today = getTodayDay(now);
  const schedules = await prisma.schedule.findMany({
    where: {
      day: today,
      isArchived: false,
      teaching: teachingBranchWhere(branchId, classeId),
    },
    select: {
      id: true,
      hour: true,
      teachingId: true,
    },
  });

  return schedules
    .filter(
      (row): row is typeof row & { hour: Date; teachingId: string } =>
        Boolean(row.hour && row.teachingId),
    )
    .map((row) => ({
      teachingId: row.teachingId,
      scheduleId: row.id,
      startMinutes: scheduleHourToMinutes(row.hour),
      hour: row.hour,
    }))
    .sort((left, right) => left.startMinutes - right.startMinutes);
}

/** Lecture seule : le pointage élève du jour aurait une session (sans la créer). */
export async function classHasDayArrivalSession(
  classeId: string,
  branchId: string,
  now = nowLocal(),
) {
  if (await isBranchClosedOn(branchId, now)) return false;

  const schedules = await listClassDaySchedules(classeId, branchId, now);
  if (schedules.length > 0) return true;

  const teachingWhere = teachingBranchWhere(branchId, classeId);
  let teaching = await prisma.teaching.findFirst({
    where: teachingWhere,
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!teaching) {
    teaching = await prisma.teaching.findFirst({
      where: {
        classeId,
        OR: [{ branchId }, { branchId: null, classe: { branchId } }],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!teaching) return false;

  const classe = await prisma.classe.findFirst({
    where: { id: classeId, branchId },
    select: {
      creneau: { select: { startTime: true, endTime: true } },
    },
  });
  return Boolean(classe?.creneau?.startTime && classe?.creneau?.endTime);
}

export async function studentHasDayArrivalSession(
  studentId: string,
  branchId: string,
  now = nowLocal(),
) {
  const enrollment = await getStudentEnrollmentClasse(studentId, branchId);
  if (!enrollment) return false;
  return classHasDayArrivalSession(enrollment.classeId, branchId, now);
}

async function getStudentEnrollmentClasse(
  studentId: string,
  branchId: string,
) {
  return prisma.classEnrollment.findFirst({
    where: {
      studentId,
      branchId,
      OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      classeId: true,
      classe: {
        select: {
          creneau: {
            select: {
              nameCreneau: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      },
    },
  });
}

/** Session d'arrivée du jour : 1re séance du créneau, pas chaque cours. */
export async function findStudentDayArrivalSession(
  studentId: string,
  branchId: string,
  include?: Prisma.AttendanceSessionInclude,
) {
  const enrollment = await getStudentEnrollmentClasse(studentId, branchId);
  if (!enrollment) return null;

  const schedules = await listClassDaySchedules(enrollment.classeId, branchId);
  const first = schedules[0];
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);

  if (first) {
    const session = await ensureAttendanceSessionForSchedule(
      first.teachingId,
      first.scheduleId,
      branchId,
      courseDurationMinutes,
      { requireCheckInWindow: false },
    );
    if (session) {
      return prisma.attendanceSession.findFirst({
        where: { id: session.id },
        include,
      });
    }
  }

  const fallback = await ensureStudentDaySessionFromClasse(
    enrollment.classeId,
    branchId,
  );
  if (fallback) {
    return prisma.attendanceSession.findFirst({
      where: { id: fallback.id },
      include,
    });
  }

  return findStudentCheckInSession(studentId, branchId, include);
}

async function ensureStudentDaySessionFromClasse(
  classeId: string,
  branchId: string,
) {
  if (await isBranchClosedOn(branchId)) return null;

  const teachingWhere = teachingBranchWhere(branchId, classeId);
  let teaching = await prisma.teaching.findFirst({
    where: teachingWhere,
    select: { id: true, schoolYearId: true, branchId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!teaching) {
    teaching = await prisma.teaching.findFirst({
      where: {
        classeId,
        OR: [{ branchId }, { branchId: null, classe: { branchId } }],
      },
      select: { id: true, schoolYearId: true, branchId: true },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!teaching) return null;

  const classe = await prisma.classe.findFirst({
    where: { id: classeId, branchId },
    select: {
      creneau: { select: { startTime: true, endTime: true } },
    },
  });

  const startTime = classe?.creneau?.startTime;
  const endTime = classe?.creneau?.endTime;
  if (!startTime || !endTime) return null;

  const resolved = resolveCreneauClockHours({ startTime, endTime });
  const sessionStart = hmToUtcTimeDate(resolved.startTime) ?? startTime;
  const sessionEnd = hmToUtcTimeDate(resolved.endTime) ?? endTime;

  const today = startOfTodayParis();
  const existing = await prisma.attendanceSession.findFirst({
    where: {
      teachingId: teaching.id,
      date: today,
      startTime: sessionStart,
    },
  });
  if (existing) {
    if (existing.branchId !== branchId) {
      return prisma.attendanceSession.update({
        where: { id: existing.id },
        data: { branchId },
      });
    }
    return existing;
  }

  return prisma.attendanceSession.create({
    data: {
      teachingId: teaching.id,
      branchId,
      date: today,
      startTime: sessionStart,
      endTime: sessionEnd,
      schoolYearId: teaching.schoolYearId,
    },
  });
}

/** Heure de début de pointage du jour (créneau, samedi inclus). */
export async function getStudentPointageStart(
  studentId: string,
  branchId: string,
  fallback: Date,
  now = nowLocal(),
): Promise<Date> {
  const enrollment = await getStudentEnrollmentClasse(studentId, branchId);
  const creneau = enrollment?.classe?.creneau;
  if (creneau?.startTime && creneau.endTime) {
    return creneauStartTimeDate(creneau, now);
  }
  return fallback;
}

export async function getStudentDayPeriodEnd(
  studentId: string,
  branchId: string,
  now = nowLocal(),
): Promise<Date | null> {
  const enrollment = await getStudentEnrollmentClasse(studentId, branchId);
  if (!enrollment) return null;

  const creneau = enrollment.classe?.creneau;
  if (creneau?.startTime && creneau.endTime) {
    return combineDateWithCreneauTime(now, creneauEndTimeDate(creneau, now));
  }

  const schedules = await listClassDaySchedules(
    enrollment.classeId,
    branchId,
    now,
  );
  const last = schedules[schedules.length - 1];
  if (!last) return null;
  const duration = await getBranchCourseDurationMinutes(branchId);
  const end = new Date(now);
  const endMinutes = last.startMinutes + duration;
  end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  return end;
}

export async function isStudentNormalCheckoutAllowed(
  studentId: string,
  branchId: string,
  now = nowLocal(),
) {
  const enrollment = await getStudentEnrollmentClasse(studentId, branchId);
  if (!enrollment) return false;

  const creneau = enrollment.classe?.creneau;
  if (creneau?.startTime && creneau.endTime) {
    return isAtOrAfterCreneauEnd(creneau, now);
  }

  const schedules = await listClassDaySchedules(enrollment.classeId, branchId, now);
  const last = schedules[schedules.length - 1];
  if (!last) return true;
  const duration = await getBranchCourseDurationMinutes(branchId);
  return toMinutes(now) >= last.startMinutes + duration;
}

export async function getStudentDayPointageLabel(
  studentId: string,
  branchId: string,
  phase: "arrival" | "departure",
  now = nowLocal(),
) {
  const enrollment = await getStudentEnrollmentClasse(studentId, branchId);
  if (!enrollment) return null;

  const creneau = enrollment.classe?.creneau;
  if (creneau?.startTime && creneau.endTime) {
    const resolved = resolveCreneauClockHours(creneau, now);
    return phase === "arrival"
      ? `Arrivée · ${resolved.startTime}`
      : `Sortie · ${resolved.endTime}`;
  }

  const schedules = await listClassDaySchedules(
    enrollment.classeId,
    branchId,
    now,
  );

  const slot = phase === "arrival" ? schedules[0] : schedules[schedules.length - 1];
  if (slot) {
    const schedule = await prisma.schedule.findFirst({
      where: { id: slot.scheduleId },
      include: {
        teaching: {
          include: {
            cours: { select: { nameCours: true } },
            classe: { select: { codeClasse: true, nameClasse: true } },
          },
        },
      },
    });
    if (schedule?.hour && schedule.teaching) {
      const label = formatExpectedSessionLabel(schedule.hour, schedule.teaching);
      return phase === "arrival"
        ? `Arrivée · ${label}`
        : `Sortie · ${label}`;
    }
  }

  return phase === "arrival" ? "Arrivée" : "Sortie";
}

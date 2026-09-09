import { prisma } from "@/lib/prisma";
import { Day, type Prisma } from "@/prisma/generated/prisma/client";
import { formatExpectedSessionLabel } from "@/lib/attendance-schedule-label";
import { isBranchClosedOn } from "@/lib/branch-closed-days";
import {
  isAtOrAfterCreneauEnd,
  resolveCreneauClockHours,
  creneauStartTimeDate,
  creneauEndTimeDate,
} from "@/lib/attendance-exit";
import { isPrimaryLikeCycle, resolveCycle } from "@/lib/cycle";
import {
  getParisWeekday,
  isTeacherCheckInWindow,
  nowLocal,
  scheduleHourToMinutes,
  startOfTodayParis,
  TEACHER_COURSE_DURATION_MINUTES,
  toMinutes,
} from "@/lib/timezone";

const DAY_BY_WEEKDAY = {
  0: Day.Dimanche,
  1: Day.Lundi,
  2: Day.Mardi,
  3: Day.Mercredi,
  4: Day.Jeudi,
  5: Day.Vendredi,
  6: Day.Samedi,
} as const;

export async function getBranchCourseDurationMinutes(branchId: string) {
  const creneau = await prisma.creneau.findFirst({
    where: { branchId, isArchived: false },
    orderBy: { createdAt: "desc" },
    select: { durationCourse: true },
  });

  return creneau?.durationCourse ?? TEACHER_COURSE_DURATION_MINUTES;
}

function getTodayDay(date = nowLocal()) {
  return DAY_BY_WEEKDAY[getParisWeekday(date) as keyof typeof DAY_BY_WEEKDAY];
}

function teachingBranchWhere(branchId: string) {
  return {
    OR: [
      { branchId },
      {
        branchId: null,
        classe: { branchId },
      },
    ],
    schoolYear: {
      branchId,
      isCurrentYear: true,
    },
  };
}

type TeacherScheduleCandidate = {
  teachingId: string;
  scheduleId: string;
  startMinutes: number;
};

function rankTeacherScheduleCandidates(
  candidates: TeacherScheduleCandidate[],
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

    const leftEndsAt =
      left.startMinutes + courseDurationMinutes;
    const rightEndsAt =
      right.startMinutes + courseDurationMinutes;

    if (leftEndsAt !== rightEndsAt) {
      return leftEndsAt - rightEndsAt;
    }

    return left.startMinutes - right.startMinutes;
  });
}

export async function listTeacherScheduleCandidates(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
) {
  if (await isBranchClosedOn(branchId, now)) return [];

  const currentMinutes = toMinutes(now);
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);
  const today = getTodayDay(now);

  const teacher = await prisma.teacher.findFirst({
    where: {
      id: teacherId,
      branchMember: { branchId },
    },
    include: {
      teaching: {
        where: teachingBranchWhere(branchId),
        include: {
          Schedule: {
            where: {
              day: today,
              isArchived: false,
            },
          },
        },
      },
    },
  });

  if (!teacher) return [];

  const candidates: TeacherScheduleCandidate[] = [];

  for (const teaching of teacher.teaching) {
    for (const schedule of teaching.Schedule) {
      if (!schedule.hour) continue;

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
        teachingId: teaching.id,
        scheduleId: schedule.id,
        startMinutes,
      });
    }
  }

  return rankTeacherScheduleCandidates(
    candidates,
    currentMinutes,
    courseDurationMinutes,
  );
}

export async function getOrCreateTeacherAttendanceSession(
  teachingId: string,
  scheduleId: string,
  branchId: string,
  courseDurationMinutes = TEACHER_COURSE_DURATION_MINUTES,
) {
  return ensureAttendanceSessionForSchedule(
    teachingId,
    scheduleId,
    branchId,
    courseDurationMinutes,
    { requireCheckInWindow: true },
  );
}

/**
 * Crée la session du jour même après la fenêtre de pointage
 * (pour signaler les absences auto une fois le cours terminé).
 */
export async function ensureAttendanceSessionForSchedule(
  teachingId: string,
  scheduleId: string,
  branchId: string,
  courseDurationMinutes = TEACHER_COURSE_DURATION_MINUTES,
  options?: { requireCheckInWindow?: boolean },
) {
  const now = nowLocal();

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: scheduleId,
      teachingId,
      isArchived: false,
      teaching: teachingBranchWhere(branchId),
    },
    include: { teaching: true },
  });

  if (!schedule?.teachingId || !schedule.hour || !schedule.teaching) {
    return null;
  }

  if (
    schedule.teaching.branchId &&
    schedule.teaching.branchId !== branchId
  ) {
    return null;
  }

  const today = startOfTodayParis(now);
  const end = new Date(
    new Date(schedule.hour).getTime() + courseDurationMinutes * 60 * 1000,
  );

  const existing = await prisma.attendanceSession.findFirst({
    where: {
      teachingId,
      date: today,
      startTime: schedule.hour,
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

  if (options?.requireCheckInWindow !== false) {
    const currentMinutes = toMinutes(now);
    const startMinutes = scheduleHourToMinutes(schedule.hour);
    if (
      !isTeacherCheckInWindow(
        currentMinutes,
        startMinutes,
        courseDurationMinutes,
      )
    ) {
      return null;
    }
  }

  return prisma.attendanceSession.create({
    data: {
      teachingId,
      branchId,
      date: today,
      startTime: schedule.hour,
      endTime: end,
      schoolYearId: schedule.teaching.schoolYearId,
    },
  });
}

export async function getExpectedTeacherSessionLabel(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
) {
  const context = await getTeacherDayPunchContext(teacherId, branchId, now);
  if (context.usesDayLevel) {
    return getTeacherDayPointageLabelFromContext(context, "arrival", now);
  }

  const candidates = await listTeacherScheduleCandidates(
    teacherId,
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

export async function findTeacherCheckInSession(
  teacherId: string,
  branchId: string,
  include?: Prisma.AttendanceSessionInclude,
) {
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);
  const candidates = await listTeacherScheduleCandidates(
    teacherId,
    branchId,
  );

  for (const candidate of candidates) {
    const session = await getOrCreateTeacherAttendanceSession(
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

type TeacherDayPunchContext = {
  usesDayLevel: boolean;
  creneau: {
    nameCreneau: string | null;
    startTime: Date;
    endTime: Date;
  } | null;
  firstSchedule: {
    teachingId: string;
    scheduleId: string;
    startMinutes: number;
  } | null;
  firstTeachingId: string | null;
};

async function loadTeacherDayTeachings(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
) {
  return prisma.teacher.findFirst({
    where: {
      id: teacherId,
      branchMember: { branchId },
    },
    select: {
      teaching: {
        where: teachingBranchWhere(branchId),
        select: {
          id: true,
          schoolYearId: true,
          classe: {
            select: {
              cycle: true,
              creneau: {
                select: {
                  nameCreneau: true,
                  startTime: true,
                  endTime: true,
                },
              },
              branch: { select: { typebranch: true } },
            },
          },
          Schedule: {
            where: {
              day: getTodayDay(now),
              isArchived: false,
            },
            select: { id: true, hour: true },
          },
        },
      },
    },
  });
}

export async function getTeacherDayPunchContext(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
): Promise<TeacherDayPunchContext> {
  const empty: TeacherDayPunchContext = {
    usesDayLevel: false,
    creneau: null,
    firstSchedule: null,
    firstTeachingId: null,
  };
  if (await isBranchClosedOn(branchId, now)) return empty;

  const teacher = await loadTeacherDayTeachings(teacherId, branchId, now);
  if (!teacher) return empty;

  const primaryTeachings = [];
  const secondaryToday = [];

  for (const teaching of teacher.teaching) {
    const cycle = resolveCycle(teaching.classe, teaching.classe?.branch);
    const todaySchedules = teaching.Schedule.filter((row) => row.hour);
    if (cycle === "SECONDAIRE" && todaySchedules.length > 0) {
      secondaryToday.push(teaching);
    }
    if (isPrimaryLikeCycle(cycle)) {
      primaryTeachings.push(teaching);
    }
  }

  if (secondaryToday.length > 0 || primaryTeachings.length === 0) {
    return empty;
  }

  const schedules = primaryTeachings
    .flatMap((teaching) =>
      teaching.Schedule.filter(
        (row): row is typeof row & { hour: Date } => Boolean(row.hour),
      ).map((row) => ({
        teachingId: teaching.id,
        scheduleId: row.id,
        startMinutes: scheduleHourToMinutes(row.hour),
        creneau: teaching.classe?.creneau ?? null,
      })),
    )
    .sort((left, right) => left.startMinutes - right.startMinutes);

  const firstSchedule = schedules[0]
    ? {
        teachingId: schedules[0].teachingId,
        scheduleId: schedules[0].scheduleId,
        startMinutes: schedules[0].startMinutes,
      }
    : null;

  const creneau =
    schedules[0]?.creneau ??
    primaryTeachings.find((row) => row.classe?.creneau)?.classe?.creneau ??
    null;

  return {
    usesDayLevel: true,
    creneau: creneau?.startTime && creneau.endTime ? creneau : null,
    firstSchedule,
    firstTeachingId: firstSchedule?.teachingId ?? primaryTeachings[0]?.id ?? null,
  };
}

export async function teacherUsesDayLevelPunch(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
) {
  const context = await getTeacherDayPunchContext(teacherId, branchId, now);
  return context.usesDayLevel;
}

function getTeacherDayPointageLabelFromContext(
  context: TeacherDayPunchContext,
  phase: "arrival" | "departure",
  now = nowLocal(),
) {
  if (context.creneau) {
    const resolved = resolveCreneauClockHours(context.creneau, now);
    return phase === "arrival"
      ? `Arrivée · ${resolved.startTime}`
      : `Sortie · ${resolved.endTime}`;
  }
  return phase === "arrival" ? "Arrivée" : "Sortie";
}

export async function getTeacherDayPointageLabel(
  teacherId: string,
  branchId: string,
  phase: "arrival" | "departure",
  now = nowLocal(),
) {
  const context = await getTeacherDayPunchContext(teacherId, branchId, now);
  if (!context.usesDayLevel) return null;
  return getTeacherDayPointageLabelFromContext(context, phase, now);
}

export async function isTeacherNormalCheckoutAllowed(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
) {
  const context = await getTeacherDayPunchContext(teacherId, branchId, now);
  if (!context.usesDayLevel) return true;
  if (context.creneau) return isAtOrAfterCreneauEnd(context.creneau, now);
  if (!context.firstSchedule) return true;
  const duration = await getBranchCourseDurationMinutes(branchId);
  return toMinutes(now) >= context.firstSchedule.startMinutes + duration;
}

export async function getTeacherDayCreneauEnd(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
) {
  const context = await getTeacherDayPunchContext(teacherId, branchId, now);
  if (!context.creneau) return null;
  return creneauEndTimeDate(context.creneau, now);
}

async function ensureTeacherDaySessionFromCreneau(
  teachingId: string,
  schoolYearId: string,
  branchId: string,
  creneau: { startTime: Date; endTime: Date },
) {
  const sessionStart = creneauStartTimeDate(creneau);
  const sessionEnd = creneauEndTimeDate(creneau);
  const today = startOfTodayParis();
  const existing = await prisma.attendanceSession.findFirst({
    where: {
      teachingId,
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
      teachingId,
      branchId,
      date: today,
      startTime: sessionStart,
      endTime: sessionEnd,
      schoolYearId,
    },
  });
}

export async function findTeacherDayArrivalSession(
  teacherId: string,
  branchId: string,
  include?: Prisma.AttendanceSessionInclude,
) {
  const context = await getTeacherDayPunchContext(teacherId, branchId);
  if (!context.usesDayLevel) return null;

  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);

  if (context.firstSchedule) {
    const session = await ensureAttendanceSessionForSchedule(
      context.firstSchedule.teachingId,
      context.firstSchedule.scheduleId,
      branchId,
      courseDurationMinutes,
      { requireCheckInWindow: false },
    );
    if (session) {
      if (context.creneau) {
        const expectedEnd = creneauEndTimeDate(context.creneau);
        if (session.endTime.getTime() !== expectedEnd.getTime()) {
          await prisma.attendanceSession.update({
            where: { id: session.id },
            data: { endTime: expectedEnd },
          });
        }
      }
      return prisma.attendanceSession.findFirst({
        where: { id: session.id },
        include,
      });
    }
  }

  if (context.firstTeachingId && context.creneau) {
    const teaching = await prisma.teaching.findFirst({
      where: { id: context.firstTeachingId },
      select: { schoolYearId: true },
    });
    if (!teaching?.schoolYearId) return null;
    const fallback = await ensureTeacherDaySessionFromCreneau(
      context.firstTeachingId,
      teaching.schoolYearId,
      branchId,
      context.creneau,
    );
    return prisma.attendanceSession.findFirst({
      where: { id: fallback.id },
      include,
    });
  }

  return null;
}

import { prisma } from "@/lib/prisma";
import { Day, type Prisma } from "@/prisma/generated/prisma/client";
import { formatExpectedSessionLabel } from "@/lib/attendance-schedule-label";
import { isBranchClosedOn } from "@/lib/branch-closed-days";
import {
  isAtOrAfterCreneauEnd,
  resolveCreneauClockHours,
  combineDateWithCreneauTime,
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

/** Créneau du jour (entrée du regroupement d'affilée). */
export type ScheduleBlockSlot = {
  teachingId: string;
  scheduleId: string;
  startMinutes: number;
};

/**
 * Bloc de cours d'affilée : même teaching, créneaux adjacents
 * (start(n+1) === start(n) + durationCourse).
 */
export type ConsecutiveScheduleBlock = {
  teachingId: string;
  scheduleIds: string[];
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  firstScheduleId: string;
};

/**
 * Regroupe les créneaux d'un même teaching en blocs d'affilée.
 * Un trou ou un autre teaching coupe le bloc.
 */
export function groupConsecutiveScheduleBlocks(
  slots: ScheduleBlockSlot[],
  courseDurationMinutes: number,
): ConsecutiveScheduleBlock[] {
  const duration = Math.max(1, courseDurationMinutes);
  const byTeaching = new Map<string, ScheduleBlockSlot[]>();

  for (const slot of slots) {
    const list = byTeaching.get(slot.teachingId) ?? [];
    list.push(slot);
    byTeaching.set(slot.teachingId, list);
  }

  const blocks: ConsecutiveScheduleBlock[] = [];

  for (const [teachingId, teachingSlots] of byTeaching) {
    const sorted = [...teachingSlots].sort(
      (left, right) => left.startMinutes - right.startMinutes,
    );
    let current: ScheduleBlockSlot[] = [];

    const flush = () => {
      if (!current.length) return;
      const first = current[0]!;
      const last = current[current.length - 1]!;
      const durationMinutes = current.length * duration;
      blocks.push({
        teachingId,
        scheduleIds: current.map((slot) => slot.scheduleId),
        startMinutes: first.startMinutes,
        endMinutes: last.startMinutes + duration,
        durationMinutes,
        firstScheduleId: first.scheduleId,
      });
      current = [];
    };

    for (const slot of sorted) {
      if (!current.length) {
        current = [slot];
        continue;
      }
      const prev = current[current.length - 1]!;
      if (slot.startMinutes === prev.startMinutes + duration) {
        current.push(slot);
      } else {
        flush();
        current = [slot];
      }
    }
    flush();
  }

  return blocks.sort((left, right) => left.startMinutes - right.startMinutes);
}

function rankTeacherScheduleCandidates(
  candidates: Array<TeacherScheduleCandidate & { durationMinutes?: number }>,
  currentMinutes: number,
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
      left.startMinutes + (left.durationMinutes ?? TEACHER_COURSE_DURATION_MINUTES);
    const rightEndsAt =
      right.startMinutes +
      (right.durationMinutes ?? TEACHER_COURSE_DURATION_MINUTES);

    if (leftEndsAt !== rightEndsAt) {
      return leftEndsAt - rightEndsAt;
    }

    return left.startMinutes - right.startMinutes;
  });
}

async function resolveTeachingDayBlockForSchedule(
  teachingId: string,
  scheduleId: string,
  courseDurationMinutes: number,
  now = nowLocal(),
): Promise<ConsecutiveScheduleBlock | null> {
  const daySchedules = await prisma.schedule.findMany({
    where: {
      teachingId,
      day: getTodayDay(now),
      isArchived: false,
    },
    select: { id: true, hour: true },
  });

  const slots: ScheduleBlockSlot[] = [];
  for (const row of daySchedules) {
    if (!row.hour) continue;
    slots.push({
      teachingId,
      scheduleId: row.id,
      startMinutes: scheduleHourToMinutes(row.hour),
    });
  }

  const blocks = groupConsecutiveScheduleBlocks(slots, courseDurationMinutes);
  return blocks.find((block) => block.scheduleIds.includes(scheduleId)) ?? null;
}

export async function listTeacherDaySchedules(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
): Promise<TeacherScheduleCandidate[]> {
  if (await isBranchClosedOn(branchId, now, "teachers")) return [];

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
      candidates.push({
        teachingId: teaching.id,
        scheduleId: schedule.id,
        startMinutes: scheduleHourToMinutes(schedule.hour),
      });
    }
  }

  return candidates.sort((left, right) => left.startMinutes - right.startMinutes);
}

export async function teacherIdsWithScheduledCourseToday(
  teacherIds: string[],
  branchId: string,
  now = nowLocal(),
): Promise<Set<string>> {
  if (teacherIds.length === 0) return new Set();
  if (await isBranchClosedOn(branchId, now, "teachers")) return new Set();

  const today = getTodayDay(now);
  const rows = await prisma.teaching.findMany({
    where: {
      teacherId: { in: teacherIds },
      ...teachingBranchWhere(branchId),
      Schedule: {
        some: {
          day: today,
          isArchived: false,
        },
      },
    },
    select: { teacherId: true },
  });

  return new Set(rows.map((row) => row.teacherId));
}

export async function listTeacherScheduleCandidates(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
) {
  const currentMinutes = toMinutes(now);
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);
  const daySchedules = await listTeacherDaySchedules(teacherId, branchId, now);
  const blocks = groupConsecutiveScheduleBlocks(
    daySchedules,
    courseDurationMinutes,
  );

  const candidates = blocks
    .filter((block) =>
      isTeacherCheckInWindow(
        currentMinutes,
        block.startMinutes,
        block.durationMinutes,
      ),
    )
    .map((block) => ({
      teachingId: block.teachingId,
      scheduleId: block.firstScheduleId,
      startMinutes: block.startMinutes,
      durationMinutes: block.durationMinutes,
    }));

  return rankTeacherScheduleCandidates(candidates, currentMinutes);
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
 * Si le créneau fait partie d'un bloc d'affilée, une seule session
 * couvre le bloc (start = 1ʳᵉ heure, end = fin de la dernière).
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

  const block =
    (await resolveTeachingDayBlockForSchedule(
      teachingId,
      scheduleId,
      courseDurationMinutes,
      now,
    )) ?? {
      teachingId,
      scheduleIds: [scheduleId],
      startMinutes: scheduleHourToMinutes(schedule.hour),
      endMinutes:
        scheduleHourToMinutes(schedule.hour) + courseDurationMinutes,
      durationMinutes: courseDurationMinutes,
      firstScheduleId: scheduleId,
    };

  const firstSchedule =
    block.firstScheduleId === scheduleId
      ? schedule
      : await prisma.schedule.findFirst({
          where: {
            id: block.firstScheduleId,
            teachingId,
            isArchived: false,
          },
        });

  if (!firstSchedule?.hour) return null;

  const today = startOfTodayParis(now);
  const sessionStart = firstSchedule.hour;
  const sessionEnd = new Date(
    new Date(sessionStart).getTime() + block.durationMinutes * 60 * 1000,
  );

  const existing = await prisma.attendanceSession.findFirst({
    where: {
      teachingId,
      date: today,
      startTime: sessionStart,
    },
  });

  if (existing) {
    const patch: { branchId?: string; endTime?: Date } = {};
    if (existing.branchId !== branchId) patch.branchId = branchId;
    if (existing.endTime.getTime() < sessionEnd.getTime()) {
      patch.endTime = sessionEnd;
    }
    if (Object.keys(patch).length) {
      return prisma.attendanceSession.update({
        where: { id: existing.id },
        data: patch,
      });
    }
    return existing;
  }

  if (options?.requireCheckInWindow !== false) {
    const currentMinutes = toMinutes(now);
    if (
      !isTeacherCheckInWindow(
        currentMinutes,
        block.startMinutes,
        block.durationMinutes,
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
      startTime: sessionStart,
      endTime: sessionEnd,
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

  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);
  const block = await resolveTeachingDayBlockForSchedule(
    candidates[0].teachingId,
    candidates[0].scheduleId,
    courseDurationMinutes,
    now,
  );
  const endHour =
    block && block.durationMinutes > courseDurationMinutes
      ? new Date(
          new Date(schedule.hour).getTime() +
            block.durationMinutes * 60 * 1000,
        )
      : null;

  return formatExpectedSessionLabel(schedule.hour, schedule.teaching, endHour);
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
  if (await isBranchClosedOn(branchId, now, "teachers")) return empty;

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

/** Heure de début de pointage : créneau du jour si primaire, sinon séance. */
export async function getTeacherPointageStart(
  teacherId: string,
  branchId: string,
  fallback: Date,
  now = nowLocal(),
): Promise<Date> {
  const context = await getTeacherDayPunchContext(teacherId, branchId, now);
  if (context.usesDayLevel && context.creneau) {
    return creneauStartTimeDate(context.creneau, now);
  }
  return fallback;
}

export async function getTeacherDayPeriodEnd(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
): Promise<Date | null> {
  const context = await getTeacherDayPunchContext(teacherId, branchId, now);
  if (context.usesDayLevel) {
    if (context.creneau) {
      return combineDateWithCreneauTime(
        now,
        creneauEndTimeDate(context.creneau, now),
      );
    }
    if (!context.firstSchedule) return null;
    const duration = await getBranchCourseDurationMinutes(branchId);
    const endMinutes = context.firstSchedule.startMinutes + duration;
    const end = new Date(now);
    end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    return end;
  }

  const schedules = await listTeacherDaySchedules(teacherId, branchId, now);
  const last = schedules[schedules.length - 1];
  if (!last) return null;
  const duration = await getBranchCourseDurationMinutes(branchId);
  const endMinutes = last.startMinutes + duration;
  const end = new Date(now);
  end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  return end;
}

export async function isTeacherNormalCheckoutAllowed(
  teacherId: string,
  branchId: string,
  now = nowLocal(),
) {
  const context = await getTeacherDayPunchContext(teacherId, branchId, now);
  if (context.usesDayLevel) {
    if (context.creneau) return isAtOrAfterCreneauEnd(context.creneau, now);
    if (!context.firstSchedule) return true;
    const duration = await getBranchCourseDurationMinutes(branchId);
    return toMinutes(now) >= context.firstSchedule.startMinutes + duration;
  }

  const schedules = await listTeacherDaySchedules(teacherId, branchId, now);
  const last = schedules[schedules.length - 1];
  if (!last) return true;
  const duration = await getBranchCourseDurationMinutes(branchId);
  return toMinutes(now) >= last.startMinutes + duration;
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

import { prisma } from "@/lib/prisma";
import { Day, type Prisma } from "@/prisma/generated/prisma/client";
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

import { prisma } from "@/lib/prisma";
import { Day, type Prisma } from "@/prisma/generated/prisma/client";
import { formatExpectedSessionLabel } from "@/lib/attendance-schedule-label";
import {
  getBranchCourseDurationMinutes,
  getOrCreateTeacherAttendanceSession,
} from "@/lib/attendance-teacher-session";
import {
  TEACHER_COURSE_DURATION_MINUTES,
  getParisWeekday,
  isTeacherCheckInWindow,
  nowLocal,
  scheduleHourToMinutes,
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

export async function listStudentScheduleCandidates(
  studentId: string,
  branchId: string,
  now = nowLocal(),
) {
  const currentMinutes = toMinutes(now);
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);
  const today = getTodayDay(now);

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

  const schedules = await prisma.schedule.findMany({
    where: {
      day: today,
      isArchived: false,
      teaching: teachingBranchWhere(branchId, enrollment.classeId),
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

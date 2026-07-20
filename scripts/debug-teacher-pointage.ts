import { prisma } from "../lib/prisma";
import {
  getParisWeekday,
  isTeacherCheckInWindow,
  nowLocal,
  scheduleHourToMinutes,
  startOfTodayParis,
  toMinutes,
} from "../lib/timezone";
import { Day } from "../prisma/generated/prisma/client";

const dayMap = {
  0: Day.Dimanche,
  1: Day.Lundi,
  2: Day.Mardi,
  3: Day.Mercredi,
  4: Day.Jeudi,
  5: Day.Vendredi,
  6: Day.Samedi,
} as const;

async function getOrCreateSession(
  teachingId: string,
  scheduleId: string,
  branchId: string,
) {
  const now = nowLocal();

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: scheduleId,
      teachingId,
      OR: [
        { branchMember: { branchId } },
        { teaching: { branchId } },
        { teaching: { branchId: null, classe: { branchId } } },
      ],
    },
    include: { teaching: true },
  });

  if (!schedule?.teachingId || !schedule.hour) return null;
  if (schedule.teaching?.branchId && schedule.teaching.branchId !== branchId) {
    return null;
  }

  const end = new Date(new Date(schedule.hour).getTime() + 60 * 60 * 1000);
  const today = startOfTodayParis(now);

  const existing = await prisma.attendanceSession.findFirst({
    where: {
      teachingId,
      branchId,
      date: today,
      startTime: schedule.hour,
    },
  });

  if (existing) return existing;

  const currentMinutes = toMinutes(now);
  const startMinutes = scheduleHourToMinutes(schedule.hour);
  if (!isTeacherCheckInWindow(currentMinutes, startMinutes)) return null;

  return prisma.attendanceSession.create({
    data: {
      teachingId,
      branchId,
      date: today,
      startTime: schedule.hour,
      endTime: end,
      schoolYearId: schedule.teaching!.schoolYearId!,
    },
  });
}

async function findSessionForTeacher(teacherId: string, branchId: string) {
  const now = nowLocal();
  const current = toMinutes(now);
  const today = dayMap[getParisWeekday(now) as keyof typeof dayMap];

  const teacher = await prisma.teacher.findFirst({
    where: {
      id: teacherId,
      branchMember: { branchId },
    },
    include: {
      teaching: {
        where: {
          OR: [{ branchId }, { branchId: null, classe: { branchId } }],
        },
        include: {
          Schedule: { where: { day: today } },
          cours: true,
          classe: true,
        },
      },
    },
  });

  if (!teacher) return null;

  for (const teaching of teacher.teaching) {
    for (const schedule of teaching.Schedule) {
      if (!schedule.hour) continue;

      const start = scheduleHourToMinutes(schedule.hour);
      const isActive = isTeacherCheckInWindow(current, start);

      if (!isActive) continue;

      const session = await getOrCreateSession(teaching.id, schedule.id, branchId);
      if (!session) {
        console.log("getOrCreateSession returned null for", schedule.id);
        continue;
      }

      return prisma.attendanceSession.findFirst({
        where: { id: session.id, branchId },
        include: {
          teaching: {
            include: {
              cours: { select: { nameCours: true } },
              classe: { select: { codeClasse: true, nameClasse: true } },
            },
          },
        },
      });
    }
  }

  return null;
}

async function main() {
  const branchId = "cmrs00k1x0014zovreb94caej";
  const teacherId = "cmrsxh83l0006lgvrxb0ym0u7";

  const creneau = await prisma.creneau.findFirst({
    where: { branchId, isArchived: false },
    orderBy: { createdAt: "desc" },
  });
  console.log("creneau:", creneau);

  const session = await findSessionForTeacher(teacherId, branchId);
  console.log(
    "findSessionForTeacher result:",
    session?.id ?? null,
    session?.teaching?.cours?.nameCours,
  );

  const allSchedules = await prisma.schedule.findMany({
    where: { isArchived: false },
    include: {
      teaching: {
        include: {
          teacher: {
            include: {
              branchMember: {
                include: { member: { include: { user: true } } },
              },
            },
          },
          cours: true,
        },
      },
    },
    orderBy: { hour: "asc" },
  });

  const now = nowLocal();
  const current = toMinutes(now);
  const today = dayMap[getParisWeekday(now) as keyof typeof dayMap];
  const duration = creneau?.durationCourse ?? 60;

  console.log("\nAll schedules for", today, "duration", duration);
  for (const s of allSchedules.filter((x) => x.day === today)) {
    const start = scheduleHourToMinutes(s.hour);
    const active = isTeacherCheckInWindow(current, start, duration);
    const name =
      s.teaching?.teacher?.branchMember?.member?.user?.name ?? "?";
    console.log({
      teacher: name,
      cours: s.teaching?.cours?.nameCours,
      hour: s.hour.toISOString(),
      start,
      active,
      minsUntil: start - current,
      createdBy: s.createdBy,
      teachingBranchId: s.teaching?.branchId,
    });
  const sessions = await prisma.attendanceSession.findMany({
    where: { date: startOfTodayParis(nowLocal()) },
    select: {
      id: true,
      branchId: true,
      teachingId: true,
      startTime: true,
      date: true,
    },
  });
  console.log("\nToday's sessions:", sessions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

"use server";

import { prisma } from "@/lib/prisma"; // Assumes Prisma client is in lib/prisma
import { action } from "@/lib/zsa";
import { Day } from "@/prisma/generated/prisma/client";
//const Dayj = ...Day, 0:"Dimanche"
import { nowLocal, toMinutes } from "@/lib/timezone";
import { z } from "zod";
import { personnelAttendanceSchema } from "./interface/Attendance";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

/* =========================
   SESSIONS
========================= */

export async function getCurrentBranch() {
  const { branchId, organizationId, userId } = await requireBranchContext();

  return {
    branchId,
    organizationId,
    userId,
  };
}
export const getAttendanceSessions = action.handler(async () => {
  const { branchId } = await getCurrentBranch();
  await autoCloseSessions(branchId);

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      branchId,
    },
    include: {
      teaching: {
        include: {
          classe: true,
          cours: true,
          teacher: {
            include: {
              branchMember: {
                include: {
                  member: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      attendances: true,
    },
    orderBy: { date: "desc" },
  });

  return sessions.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    isClosed: s.isClosed,
    type: "Teacher",

    teaching: {
      classe: s.teaching?.classe
        ? { nameClasse: s.teaching.classe.nameClasse }
        : undefined,

      teacheur: s.teaching?.teacher?.branchMember?.member?.user
        ? {
            nom: s.teaching.teacher.branchMember.member.user.name,
            postnom: s.teaching.teacher.branchMember.member.user.postnom,
            prenom: s.teaching.teacher.branchMember.member.user.prenom,
          }
        : undefined,

      cours: s.teaching?.cours
        ? { nameCours: s.teaching.cours.nameCours }
        : undefined,
    },

    attendances: s.attendances,
  }));
});

export const getAttendanceHistory = action.handler(async () => {
  const { branchId } = await getCurrentBranch();
  const teachers = await prisma.teacherAttendance.findMany({
    where: {
      branchId,
    },
    include: {
      teacher: {
        include: {
          branchMember: {
            include: {
              member: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
      session: {
        include: {
          teaching: {
            include: {
              cours: true,
              classe: true,
            },
          },
        },
      },
    },
  });

  const students = await prisma.studentAttendance.findMany({
    where: {
      branchId,
    },
    include: {
      student: {
        include: {
          branchMember: {
            include: {
              member: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
      session: {
        include: {
          teaching: {
            include: {
              cours: true,
              classe: true,
            },
          },
        },
      },
    },
  });

  const personnels = await prisma.personnelAttendance.findMany({
    where: {
      branchId,
    },
    include: {
      personnel: {
        include: {
          branchMember: {
            include: {
              member: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return [
    ...teachers.map((t) => {
      const user = t.teacher?.branchMember?.member?.user;

      return {
        id: t.id,
        type: "Teacher",
        date: t.date,
        status: t.status,

        nom: user ? `${user.name} ${user.prenom ?? ""}` : "",

        cours: t.session.teaching?.cours?.nameCours ?? "-",
        classe: t.session.teaching?.classe?.codeClasse ?? "-",

        startTime: t.session?.startTime,
        endTime: t.session?.endTime,
        isClosed: t.session?.isClosed ?? null,
      };
    }),

    ...students.map((s) => {
      const user = s.student?.branchMember?.member?.user;

      return {
        id: s.id,
        type: "Student",
        date: s.recordedAt,
        status: s.status,

        nom: user ? `${user.name} ${user.prenom ?? ""}` : "",

        cours: s.session.teaching?.cours?.nameCours ?? "-",
        classe: s.session.teaching?.classe?.codeClasse ?? "-",

        startTime: "-",
        endTime: "-",
        isClosed: null,
      };
    }),

    ...personnels.map((p) => {
      const user = p.personnel?.branchMember?.member?.user;

      return {
        id: p.id,
        type: "Personnel",
        date: p.date,
        status: p.status,

        nom: user ? `${user.name} ${user.prenom ?? ""}` : "",

        cours: "-",
        classe: "-",
        startTime: "-",
        endTime: "-",
        isClosed: null,
      };
    }),
  ];
});

async function autoCloseSessions(branchId: string) {
  const now = nowLocal();

  return prisma.attendanceSession.updateMany({
    where: {
      branchId,
      isClosed: false,
      endTime: {
        lte: now,
      },
    },
    data: {
      isClosed: true,
      closedAt: now,
    },
  });
}

export async function generateTodaySessions(branchId: string) {
  const now = nowLocal();

  const day = [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ][now.getDay()];

  const schedules = await prisma.schedule.findMany({
    where: {
      teaching: {
        branchId,
      },
    },
    include: {
      teaching: true,
    },
  });

  const sessionDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  for (const s of schedules) {
    if (s.day !== day) continue;
    if (!s.teachingId || !s.teaching) continue;

    const start = new Date(s.hour);

    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await prisma.attendanceSession.upsert({
      where: {
        teachingId_date_startTime: {
          teachingId: s.teachingId,
          date: sessionDate,
          startTime: s.hour,
        },
      },
      update: {},
      create: {
        teachingId: s.teachingId,
        branchId, // 🔥 IMPORTANT

        date: sessionDate,
        startTime: s.hour,
        endTime: end,

        schoolYearId: s.teaching.schoolYearId!,
      },
    });
  }
}

export const getAttendanceSessionById = action
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const { branchId } = await getCurrentBranch();

    return prisma.attendanceSession.findFirst({
      where: {
        id: input.id,
        branchId, // 🔥 important multi-tenant
      },
      include: {
        teaching: {
          include: {
            classe: {
              include: {
                classEnrollment: {
                  where: {
                    branchId,
                  },
                  include: {
                    student: {
                      include: {
                        branchMember: {
                          include: {
                            member: {
                              include: {
                                user: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            cours: true,
            teacher: {
              include: {
                branchMember: {
                  include: {
                    member: {
                      include: {
                        user: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },

        attendances: {
          include: {
            student: {
              include: {
                branchMember: {
                  include: {
                    member: {
                      include: {
                        user: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });

/* =========================
   STUDENT ATTENDANCE
========================= */

export const markStudentAttendance = action
  .input(
    z.object({
      studentId: z.string(),
      sessionId: z.string(),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      remark: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId } = await getCurrentBranch();
    const [session, student] = await Promise.all([
      prisma.attendanceSession.findFirst({
        where: { id: input.sessionId, branchId },
        select: { id: true },
      }),
      prisma.student.findFirst({
        where: {
          id: input.studentId,
          branchMember: {
            branchId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (!session || !student) {
      throw new Error("Presence eleve impossible dans cette branche");
    }

    return prisma.studentAttendance.upsert({
      where: {
        branchId_sessionId_studentId: {
          studentId: input.studentId,
          sessionId: input.sessionId,
          branchId,
        },
      },
      update: {
        status: input.status,
        remark: input.remark,
      },
      create: {
        studentId: input.studentId,
        sessionId: input.sessionId,
        status: input.status,
        remark: input.remark,
        branchId, // 🔥 IMPORTANT
      },
    });
  });

export async function getTeacherCurrentSession(teacherId: string) {
  const { branchId } = await getCurrentBranch();

  const teacher = await prisma.teacher.findFirst({
    where: {
      id: teacherId,
      branchMember: {
        branchId,
      },
    },
    include: {
      branchMember: {
        include: {
          member: {
            include: {
              user: true,
            },
          },
        },
      },
      teaching: {
        where: {
          branchId,
        },
        include: {
          Schedule: {
            where: {
              branchMember: {
                branchId,
              },
            },
          },
        },
      },
    },
  });

  if (!teacher) return null;

  for (const teaching of teacher.teaching) {
    for (const schedule of teaching.Schedule) {
      const session = await getOrCreateSession(teaching.id, schedule.id);

      if (session) {
        return prisma.attendanceSession.findFirst({
          where: {
            id: session.id,
            branchId, // 🔥 IMPORTANT
          },
          include: {
            attendances: {
              include: {
                student: {
                  include: {
                    branchMember: {
                      include: {
                        member: {
                          include: {
                            user: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            teaching: {
              include: {
                classe: {
                      include: {
                        classEnrollment: {
                          where: {
                            branchId,
                          },
                          include: {
                            student: {
                              include: {
                            branchMember: {
                              include: {
                                member: {
                                  include: {
                                    user: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                cours: true,
              },
            },
          },
        });
      }
    }
  }

  return null;
}
/* =========================
   TEACHER ATTENDANCE
========================= */

export const markTeacherAttendance = action
  .input(
    z.object({
      teacherId: z.string(),
      sessionId: z.string(),
      status: z.enum(["PRESENT", "ABSENT", "LATE"]),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId } = await getCurrentBranch();
    const [session, teacher] = await Promise.all([
      prisma.attendanceSession.findFirst({
        where: { id: input.sessionId, branchId },
        select: { id: true },
      }),
      prisma.teacher.findFirst({
        where: {
          id: input.teacherId,
          branchMember: {
            branchId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (!session || !teacher) {
      throw new Error("Presence enseignant impossible dans cette branche");
    }

    return prisma.teacherAttendance.upsert({
      where: {
        teacherId_sessionId_branchId: {
          teacherId: input.teacherId,
          sessionId: input.sessionId,
          branchId,
        },
      },
      update: {
        status: input.status,
      },
      create: {
        teacherId: input.teacherId,
        sessionId: input.sessionId,
        status: input.status,
        date: nowLocal(),
        branchId, // 🔥 IMPORTANT
      },
    });
  });

export async function getActiveSession(teachingId: string) {
  const { branchId } = await getCurrentBranch();
  const now = nowLocal();

  return prisma.attendanceSession.findFirst({
    where: {
      teachingId,
      branchId, // 🔥 IMPORTANT
      isClosed: false,
      startTime: { lte: now },
      endTime: { gte: now },
    },
  });
}

export async function getOrCreateSession(
  teachingId: string,
  scheduleId: string,
) {
  const { branchId } = await getCurrentBranch();
  const now = nowLocal();

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: scheduleId,
      teachingId,
      OR: [
        {
          branchMember: {
            branchId,
          },
        },
        {
          teaching: {
            branchId,
          },
        },
        {
          teaching: {
            branchId: null,
            classe: {
              branchId,
            },
          },
        },
      ],
    },
    include: {
      teaching: true,
    },
  });

  if (!schedule || !schedule.teachingId || !schedule.hour) return null;
  if (
    schedule.teaching?.branchId &&
    schedule.teaching.branchId !== branchId
  ) {
    return null;
  }

  // 🔥 NORMALISATION
  const start = new Date(schedule.hour);
  start.setSeconds(0, 0);

  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // 1. check existing session (branch SAFE)
  const existing = await prisma.attendanceSession.findFirst({
    where: {
      teachingId,
      branchId, // 🔥 IMPORTANT
      date: today,
      startTime: schedule.hour,
    },
  });

  if (existing) return existing;

  // 2. time window
  const currentMinutes = toMinutes(now);
  const startMinutes = toMinutes(schedule.hour);

  const isValidWindow =
    currentMinutes >= startMinutes - 30 && currentMinutes <= startMinutes + 10;

  if (!isValidWindow) return null;

  // 3. create session
  return prisma.attendanceSession.create({
    data: {
      teachingId,
      branchId, // 🔥 IMPORTANT
      date: today,
      startTime: schedule.hour,
      endTime: end,
      schoolYearId: schedule.teaching!.schoolYearId!,
    },
  });
}

export async function autoMarkTeacherAbsent() {
  const { branchId } = await getCurrentBranch();
  const now = nowLocal();
  const current = toMinutes(now);

  const schedules = await prisma.schedule.findMany({
    where: {
      OR: [
        {
          branchMember: {
            branchId,
          },
        },
        {
          teaching: {
            branchId,
          },
        },
      ],
    },
    include: {
      teaching: true,
    },
  });

  for (const s of schedules) {
    if (!s.teachingId || !s.hour) continue;

    const start = toMinutes(s.hour);
    const end = start + 60;

    const isPast = current > end + 15;
    if (!isPast) continue;

    const session = await prisma.attendanceSession.findFirst({
      where: {
        teachingId: s.teachingId,
        branchId, // 🔥 IMPORTANT
        startTime: s.hour,
        date: new Date(now.toDateString()),
      },
    });

    if (!session) continue;

    const teacherId = s.teaching?.teacherId;
    if (!teacherId) continue;

    await prisma.teacherAttendance.upsert({
      where: {
        teacherId_sessionId_branchId: {
          teacherId,
          sessionId: session.id,
          branchId,
        },
      },
      update: {
        status: "ABSENT",
      },
      create: {
        teacherId,
        sessionId: session.id,
        status: "ABSENT",
        date: nowLocal(),
        branchId, // 🔥 IMPORTANT
      },
    });
  }
}
/* =========================
   PERSONNEL ATTENDANCE
========================= */

export const markPersonnelAttendance = action
  .input(personnelAttendanceSchema)
  .handler(async ({ input }) => {
    const { branchId } = await getCurrentBranch();
    const personnel = await prisma.personnel.findFirst({
      where: {
        id: input.personnelId,
        branchMember: {
          branchId,
        },
      },
      select: { id: true },
    });

    if (!personnel) {
      throw new Error("Presence personnel impossible dans cette branche");
    }

    return prisma.personnelAttendance.upsert({
      where: {
        personnelId_date_branchId: {
          personnelId: input.personnelId,
          date: input.date,
          branchId,
        },
      },
      update: {
        status: input.status,
        remark: input.remark,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
      },
      create: {
        ...input,
        branchId, // 🔥 IMPORTANT
      },
    });
  });

function getDayEnum(date = new Date()) {
  const days = [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ];

  return days[date.getDay()];
}

export async function getTodayTeachers(search?: string) {
  const { branchId } = await getCurrentBranch();
  const day = getDayEnum(new Date());

  return prisma.teacher.findMany({
    where: {
      branchMember: {
        branchId,
        ...(search
          ? {
              member: {
                user: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            }
          : {}),
      },

      teaching: {
        some: {
          OR: [{ branchId }, { branchId: null }],
          Schedule: {
            some: {
              day: day as any,
            },
          },
        },
      },
    },

    include: {
      branchMember: {
        include: {
          member: {
            include: {
              user: true,
            },
          },
        },
      },

      teaching: {
        include: {
          classe: true,
          cours: true,
          Schedule: true,
        },
      },
    },
  });
}

export async function getActiveTeachersNow(search?: string) {
  const { branchId } = await getCurrentBranch();
  const now = nowLocal();
  const current = toMinutes(now);

  const dayMap = {
    0: Day.Dimanche,
    1: Day.Lundi,
    2: Day.Mardi,
    3: Day.Mercredi,
    4: Day.Jeudi,
    5: Day.Vendredi,
    6: Day.Samedi,
  } as const;

  const dayj = dayMap[now.getDay() as keyof typeof dayMap];

  const teachers = await prisma.teacher.findMany({
    where: {
      branchMember: {
        branchId,
        ...(search
          ? {
              member: {
                user: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            }
          : {}),
      },
    },

    include: {
      branchMember: {
        include: {
          member: {
            include: {
              user: true,
            },
          },
        },
      },

      teaching: {
        where: {
          OR: [{ branchId }, { branchId: null }],
        },
        include: {
          Schedule: {
            where: {
              day: dayj,
            },
          },
        },
      },
    },
  });

  const results: any[] = [];

  for (const t of teachers) {
    let activeSession = null;

    for (const teach of t.teaching) {
      for (const s of teach.Schedule) {
        if (!s.hour) continue;

        const start = toMinutes(s.hour);
        const end = start + 60;

        const isActive = current >= start - 30 && current <= end + 10;

        if (!isActive) continue;

        const session = await getOrCreateSession(teach.id, s.id);

        if (session) {
          activeSession = session;
          break;
        }
      }

      if (activeSession) break;
    }

    if (!activeSession) continue;

    const user = t.branchMember?.member?.user;

    results.push({
      id: t.id,
      user: {
        name: user?.name,
      },
      activeSession: {
        id: activeSession.id,
      },
    });
  }

  return results;
}

export async function getTeacherCurrentSessions(teacherId: string) {
  const { branchId } = await getCurrentBranch();
  const now = nowLocal();
  const current = toMinutes(now);

  const dayMap = {
    0: Day.Dimanche,
    1: Day.Lundi,
    2: Day.Mardi,
    3: Day.Mercredi,
    4: Day.Jeudi,
    5: Day.Vendredi,
    6: Day.Samedi,
  } as const;

  const today = dayMap[now.getDay() as keyof typeof dayMap];

  const teacher = await prisma.teacher.findFirst({
    where: {
      id: teacherId,
      branchMember: {
        branchId,
      },
    },

    include: {
      branchMember: {
        include: {
          member: {
            include: {
              user: true,
            },
          },
        },
      },

      teaching: {
        where: {
          OR: [
            { branchId },
            {
              branchId: null,
              classe: {
                branchId,
              },
            },
          ],
        },
        include: {
          Schedule: {
            where: {
              day: today,
            },
          },
          cours: true,
          classe: {
            include: {
              classEnrollment: {
                where: {
                  branchId,
                },
                include: {
                  student: {
                    include: {
                      branchMember: {
                        include: {
                          member: {
                            include: {
                              user: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!teacher) return [];

  const sessions = [];

  for (const teaching of teacher.teaching) {
    for (const schedule of teaching.Schedule) {
      if (!schedule.hour) continue;

      const start = toMinutes(schedule.hour);
      const end = start + 60;

      // fenêtre large (cohérente avec tes autres fonctions)
      const isActive = current >= start - 30 && current <= end + 10;

      if (!isActive) continue;

      const session = await getOrCreateSession(teaching.id, schedule.id);

      if (!session) continue;

      const fullSession = await prisma.attendanceSession.findFirst({
        where: {
          id: session.id,
          branchId,
        },

        include: {
          attendances: {
            where: {
              branchId,
            },
          },

          teaching: {
            include: {
              cours: true,
              classe: {
                include: {
                  classEnrollment: {
                    where: {
                      branchId,
                    },
                    include: {
                      student: {
                        include: {
                          branchMember: {
                            include: {
                              member: {
                                include: {
                                  user: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (fullSession) {
        sessions.push(fullSession);
      }
    }
  }

  return sessions;
}

export async function checkTeacherAttendanceNeeded({
  organizationId,
  branchId,
}: {
  organizationId: string;
  branchId: string;
}) {
  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });

    const userId = session?.user?.id;
    if (!userId) return null;

    // =========================
    // 1. VERIFY BRANCH
    // =========================
    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId,
      },
    });

    if (!branch) return null;

    // =========================
    // 2. GET TEACHER IN BRANCH
    // =========================
    const teacher = await prisma.teacher.findFirst({
      where: {
        branchMember: {
          branchId,
          member: {
            userId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!teacher) return null;

    // =========================
    // 3. TODAY
    // =========================
    const days = [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ] as const;

    const today = days[new Date().getDay()];

    // =========================
    // 4. SCHEDULE
    // =========================
    const schedule = await prisma.schedule.findFirst({
      where: {
        day: today,

        teaching: {
          teacherId: teacher.id,
          branchId, // 🔥 important multi-tenant safety
        },
      },

      include: {
        teaching: {
          include: {
            cours: true,
            classe: true,
          },
        },
      },
    });

    if (!schedule?.teachingId) return null;

    // =========================
    // 5. CHECK SESSION (NORMALIZED DATE)
    // =========================
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const existingSession = await prisma.attendanceSession.findFirst({
      where: {
        teachingId: schedule.teachingId,
        branchId,
        date: todayDate,
      },
      select: { id: true },
    });

    if (existingSession) return null;

    return {
      teacherId: teacher.id,
      teachingId: schedule.teachingId,
      cours: schedule.teaching?.cours?.nameCours ?? null,
      classe: schedule.teaching?.classe?.nameClasse ?? null,
      branch,
    };
  } catch (error) {
    console.error("checkTeacherAttendanceNeeded error:", error);
    return null;
  }
}

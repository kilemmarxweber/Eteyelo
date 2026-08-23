"use server";

import { prisma } from "@/lib/prisma"; // Assumes Prisma client is in lib/prisma
import { action } from "@/lib/zsa";
import { Day } from "@/prisma/generated/prisma/client";
//const Dayj = ...Day, 0:"Dimanche"
import {
  getParisWeekday,
  isTeacherCheckInWindow,
  nowLocal,
  scheduleHourToMinutes,
  startOfTodayParis,
  TEACHER_COURSE_DURATION_MINUTES,
  toMinutes,
} from "@/lib/timezone";
import { z } from "zod";
import { personnelAttendanceSchema } from "./interface/Attendance";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  assertClassRosterAccess,
  assertStudentAttendanceWriteAccess,
  assertTeacherAttendanceWriteAccess,
  getTeacherAttendanceReadScope,
} from "@/lib/auth/data-scope";
import { assertWithinBranchAttendanceRadius } from "@/lib/attendance-geo.server";
import {
  getBranchCourseDurationMinutes,
  getOrCreateTeacherAttendanceSession,
  listTeacherScheduleCandidates,
} from "@/lib/attendance-teacher-session";
import {
  afterPersonnelAttendanceWrite,
  afterStudentAttendanceWrite,
  afterTeacherAttendanceWrite,
  signalEndedAbsencesForBranchDebounced,
} from "@/lib/attendance-absence";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";

const geoCoordsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** Fenêtre par défaut pour l'historique présences (évite un full scan). */
const ATTENDANCE_HISTORY_DAYS = 90;

const attendanceMemberUserSelect = {
  select: {
    name: true,
    prenom: true,
    postnom: true,
  },
} as const;

const attendancePersonInclude = {
  branchMember: {
    include: {
      member: {
        include: {
          user: attendanceMemberUserSelect,
        },
      },
    },
  },
} as const;

const attendanceTeachingSessionInclude = {
  include: {
    teaching: {
      include: {
        cours: { select: { nameCours: true } },
        classe: { select: { nameClasse: true, codeClasse: true } },
      },
    },
  },
} as const;

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
  const { branchId, session, userId } = await requireBranchContext();
  await autoCloseSessions(branchId);
  void signalEndedAbsencesForBranchDebounced(branchId).catch((error) => {
    console.error("[getAttendanceSessions] absence signal", error);
  });

  const teacherScope = await getTeacherAttendanceReadScope({
    session,
    userId,
    branchId,
  });

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      branchId,
      ...(teacherScope
        ? { teachingId: { in: teacherScope.teachingIds } }
        : {}),
    },
    include: {
      teaching: {
        include: {
          classe: { select: { nameClasse: true } },
          cours: { select: { nameCours: true } },
          teacher: {
            include: {
              branchMember: {
                include: {
                  member: {
                    include: {
                      user: attendanceMemberUserSelect,
                    },
                  },
                },
              },
            },
          },
        },
      },
      attendances: {
        select: {
          studentId: true,
          status: true,
          remark: true,
        },
      },
    },
    orderBy: { date: "desc" },
    take: 200,
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
  const { branchId, session, userId } = await requireBranchContext();
  const teacherScope = await getTeacherAttendanceReadScope({
    session,
    userId,
    branchId,
  });

  const historySince = new Date();
  historySince.setDate(historySince.getDate() - ATTENDANCE_HISTORY_DAYS);

  const [teachers, students, personnels] = await Promise.all([
    prisma.teacherAttendance.findMany({
      where: {
        branchId,
        date: { gte: historySince },
        ...(teacherScope ? { teacherId: teacherScope.teacherId } : {}),
      },
      include: {
        teacher: {
          include: attendancePersonInclude,
        },
        session: attendanceTeachingSessionInclude,
      },
      orderBy: { date: "desc" },
      take: 500,
    }),

    prisma.studentAttendance.findMany({
      where: {
        branchId,
        recordedAt: { gte: historySince },
        ...(teacherScope
          ? { session: { teachingId: { in: teacherScope.teachingIds } } }
          : {}),
      },
      include: {
        student: {
          include: attendancePersonInclude,
        },
        session: attendanceTeachingSessionInclude,
      },
      orderBy: { recordedAt: "desc" },
      take: 500,
    }),

    teacherScope
      ? Promise.resolve([])
      : prisma.personnelAttendance.findMany({
          where: {
            branchId,
            date: { gte: historySince },
          },
          include: {
            personnel: {
              include: attendancePersonInclude,
            },
          },
          orderBy: { date: "desc" },
          take: 500,
        }),
  ]);

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
        classe:
          t.session.teaching?.classe?.nameClasse?.trim() ||
          t.session.teaching?.classe?.codeClasse ||
          "-",

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
        classe:
          s.session.teaching?.classe?.nameClasse?.trim() ||
          s.session.teaching?.classe?.codeClasse ||
          "-",

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
  ][getParisWeekday(now)];

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
    const { branchId, session, userId } = await requireBranchContext();
    const teacherScope = await getTeacherAttendanceReadScope({
      session,
      userId,
      branchId,
    });

    return prisma.attendanceSession.findFirst({
      where: {
        id: input.id,
        branchId,
        ...(teacherScope
          ? { teachingId: { in: teacherScope.teachingIds } }
          : {}),
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
                      select: {
                        id: true,
                        branchMember: {
                          include: {
                            member: {
                              include: {
                                user: attendanceMemberUserSelect,
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
            cours: { select: { nameCours: true } },
            teacher: {
              include: {
                branchMember: {
                  include: {
                    member: {
                      include: {
                        user: attendanceMemberUserSelect,
                      },
                    },
                  },
                },
              },
            },
          },
        },

        attendances: {
          select: {
            studentId: true,
            status: true,
            remark: true,
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
      latitude: geoCoordsSchema.shape.latitude,
      longitude: geoCoordsSchema.shape.longitude,
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId } =
      await requireBranchContext();

    await assertWithinBranchAttendanceRadius({
      branchId,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    await assertStudentAttendanceWriteAccess({
      session,
      userId,
      branchId,
      sessionId: input.sessionId,
      studentId: input.studentId,
    });

    const [attendanceSession, student] = await Promise.all([
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

    if (!attendanceSession || !student) {
      throw new Error("Presence eleve impossible dans cette branche");
    }

    const attendance = await prisma.studentAttendance.upsert({
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
        ...(input.status === "PRESENT" || input.status === "LATE"
          ? { checkIn: nowLocal() }
          : {}),
      },
      create: {
        studentId: input.studentId,
        sessionId: input.sessionId,
        status: input.status,
        remark: input.remark,
        branchId,
        ...(input.status === "PRESENT" || input.status === "LATE"
          ? { checkIn: nowLocal() }
          : {}),
      },
    });

    void afterStudentAttendanceWrite({
      branchId,
      organizationId,
      studentId: input.studentId,
      sessionId: input.sessionId,
      attendanceId: attendance.id,
      status: input.status,
      checkIn: attendance.checkIn,
    }).catch((error) => {
      console.error("[markStudentAttendance] absence sync", error);
    });

    return attendance;
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
      latitude: geoCoordsSchema.shape.latitude,
      longitude: geoCoordsSchema.shape.longitude,
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId } =
      await requireBranchContext();

    await assertWithinBranchAttendanceRadius({
      branchId,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    await assertTeacherAttendanceWriteAccess({
      session,
      userId,
      branchId,
      sessionId: input.sessionId,
      teacherId: input.teacherId,
    });

    const [attendanceSession, teacher] = await Promise.all([
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

    if (!attendanceSession || !teacher) {
      throw new Error("Presence enseignant impossible dans cette branche");
    }

    const attendance = await prisma.teacherAttendance.upsert({
      where: {
        teacherId_sessionId_branchId: {
          teacherId: input.teacherId,
          sessionId: input.sessionId,
          branchId,
        },
      },
      update: {
        status: input.status,
        checkIn:
          input.status === "ABSENT" ? undefined : nowLocal(),
      },
      create: {
        teacherId: input.teacherId,
        sessionId: input.sessionId,
        status: input.status,
        date: nowLocal(),
        checkIn: input.status === "ABSENT" ? undefined : nowLocal(),
        branchId,
      },
    });

    void afterTeacherAttendanceWrite({
      branchId,
      organizationId,
      teacherId: input.teacherId,
      sessionId: input.sessionId,
      attendanceId: attendance.id,
      status: input.status,
      checkIn: attendance.checkIn,
    }).catch((error) => {
      console.error("[markTeacherAttendance] absence sync", error);
    });

    return attendance;
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
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);

  return getOrCreateTeacherAttendanceSession(
    teachingId,
    scheduleId,
    branchId,
    courseDurationMinutes,
  );
}

export async function autoMarkTeacherAbsent() {
  const { branchId } = await getCurrentBranch();
  return signalEndedAbsencesForBranchDebounced(branchId);
}
/* =========================
   PERSONNEL ATTENDANCE
========================= */

export const markPersonnelAttendance = action
  .input(personnelAttendanceSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
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

    const attendance = await prisma.personnelAttendance.upsert({
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
        branchId,
      },
    });

    void afterPersonnelAttendanceWrite({
      branchId,
      organizationId,
      personnelId: input.personnelId,
      attendanceId: attendance.id,
      date: input.date,
      status: input.status,
      checkIn: attendance.checkIn,
    }).catch((error) => {
      console.error("[markPersonnelAttendance] absence sync", error);
    });

    return attendance;
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
  const courseDurationMinutes = await getBranchCourseDurationMinutes(branchId);

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
    },
  });

  const results: any[] = [];

  for (const teacher of teachers) {
    const candidates = await listTeacherScheduleCandidates(
      teacher.id,
      branchId,
    );

    let activeSession = null;

    for (const candidate of candidates) {
      const session = await getOrCreateTeacherAttendanceSession(
        candidate.teachingId,
        candidate.scheduleId,
        branchId,
        courseDurationMinutes,
      );

      if (session) {
        activeSession = session;
        break;
      }
    }

    if (!activeSession) continue;

    const user = teacher.branchMember?.member?.user;

    results.push({
      id: teacher.id,
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

  const today = dayMap[getParisWeekday(now) as keyof typeof dayMap];

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

      const start = scheduleHourToMinutes(schedule.hour);
      const isActive = isTeacherCheckInWindow(current, start);

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

    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        attendanceRadius: true,
      },
    });

    if (!branch) return null;

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

    const courseDurationMinutes =
      await getBranchCourseDurationMinutes(branchId);
    const candidates = await listTeacherScheduleCandidates(
      teacher.id,
      branchId,
    );

    for (const candidate of candidates) {
      const attendanceSession = await getOrCreateTeacherAttendanceSession(
        candidate.teachingId,
        candidate.scheduleId,
        branchId,
        courseDurationMinutes,
      );

      if (!attendanceSession) continue;

      const alreadyMarked = await prisma.teacherAttendance.findUnique({
        where: {
          teacherId_sessionId_branchId: {
            teacherId: teacher.id,
            sessionId: attendanceSession.id,
            branchId,
          },
        },
        select: { id: true },
      });

      if (alreadyMarked) continue;

      const teaching = await prisma.teaching.findFirst({
        where: { id: candidate.teachingId },
        include: {
          cours: { select: { nameCours: true } },
          classe: { select: { nameClasse: true, codeClasse: true } },
        },
      });

      return {
        teacherId: teacher.id,
        teachingId: candidate.teachingId,
        sessionId: attendanceSession.id,
        cours: teaching?.cours?.nameCours ?? null,
        classe:
          teaching?.classe?.nameClasse ??
          teaching?.classe?.codeClasse ??
          null,
        branch,
      };
    }

    return null;
  } catch (error) {
    console.error("checkTeacherAttendanceNeeded error:", error);
    return null;
  }
}

/* =========================
   RAPPORT PRÉSENCES ÉLÈVES
========================= */

export type StudentAttendanceStatusCounts = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

export type StudentAttendanceDetailRow = {
  studentId: string;
  studentName: string;
  classeName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

export type StudentAttendanceReport = {
  dateStart: string;
  dateEnd: string;
  classeId: string | null;
  classeName: string | null;
  summary: StudentAttendanceStatusCounts;
  details: StudentAttendanceDetailRow[];
};

function emptyAttendanceCounts(): StudentAttendanceStatusCounts {
  return { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
}

function bumpAttendanceStatus(
  counts: StudentAttendanceStatusCounts,
  status: string,
) {
  counts.total += 1;
  switch (status) {
    case "PRESENT":
      counts.present += 1;
      break;
    case "ABSENT":
      counts.absent += 1;
      break;
    case "LATE":
      counts.late += 1;
      break;
    case "EXCUSED":
      counts.excused += 1;
      break;
    default:
      break;
  }
}

function formatAttendanceStudentName(user: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null): string {
  if (!user) return "-";
  return (
    [user.name, user.postnom, user.prenom].filter(Boolean).join(" ").trim() ||
    "-"
  );
}

export const getStudentAttendanceReportContextAction = action.handler(
  async () => {
    const { branchId, organizationId } = await requireBranchContext();

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: schoolReportBranchSelect,
    });

    if (!branch) {
      throw new Error("Contexte introuvable.");
    }

    return buildSchoolReportContext(branch);
  },
);

export const getStudentAttendanceReportAction = action
  .input(
    z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      classeId: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }): Promise<StudentAttendanceReport> => {
    const { branchId, organizationId, session, userId } =
      await requireBranchContext();

    const start = new Date(input.startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);

    if (end < start) {
      throw new Error("La date de fin doit être postérieure à la date de début.");
    }

    const classeId = input.classeId?.trim() || null;
    let classeName: string | null = null;
    const teacherScope = await getTeacherAttendanceReadScope({
      session,
      userId,
      branchId,
    });

    if (classeId) {
      await assertClassRosterAccess({
        session,
        userId,
        branchId,
        classId: classeId,
      });

      const classe = await prisma.classe.findFirst({
        where: {
          id: classeId,
          branchId,
          branch: { organizationId },
        },
        select: { id: true, nameClasse: true, codeClasse: true },
      });
      if (!classe) {
        throw new Error("Classe introuvable pour cette branche.");
      }
      classeName =
        classe.nameClasse?.trim() || classe.codeClasse?.trim() || "Classe";
    }

    const records = await prisma.studentAttendance.findMany({
      where: {
        branchId,
        session: {
          date: { gte: start, lte: end },
          ...(classeId
            ? { teaching: { classeId } }
            : teacherScope
              ? { teachingId: { in: teacherScope.teachingIds } }
              : {}),
        },
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
                classe: {
                  select: {
                    id: true,
                    nameClasse: true,
                    codeClasse: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ recordedAt: "asc" }],
    });

    const summary = emptyAttendanceCounts();
    const byStudent = new Map<string, StudentAttendanceDetailRow>();

    for (const record of records) {
      bumpAttendanceStatus(summary, record.status);

      const user = record.student?.branchMember?.member?.user ?? null;
      const classe = record.session?.teaching?.classe;
      const rowClasseName =
        classe?.nameClasse?.trim() ||
        classe?.codeClasse?.trim() ||
        classeName ||
        "-";

      let entry = byStudent.get(record.studentId);
      if (!entry) {
        entry = {
          studentId: record.studentId,
          studentName: formatAttendanceStudentName(user),
          classeName: rowClasseName,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
        };
        byStudent.set(record.studentId, entry);
      }

      bumpAttendanceStatus(entry, record.status);
    }

    const details = Array.from(byStudent.values()).sort((a, b) => {
      const byClass = a.classeName.localeCompare(b.classeName, "fr");
      if (byClass !== 0) return byClass;
      return a.studentName.localeCompare(b.studentName, "fr");
    });

    return {
      dateStart: start.toISOString(),
      dateEnd: end.toISOString(),
      classeId,
      classeName,
      summary,
      details,
    };
  });

/* =========================
   RAPPORT PRÉSENCES ENSEIGNANTS
========================= */

export type TeacherAttendanceDetailRow = {
  teacherId: string;
  teacherName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

export type TeacherAttendanceReport = {
  dateStart: string;
  dateEnd: string;
  summary: StudentAttendanceStatusCounts;
  details: TeacherAttendanceDetailRow[];
};

export const getTeacherAttendanceReportContextAction = action.handler(
  async () => {
    const { branchId, organizationId } = await requireBranchContext();

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: schoolReportBranchSelect,
    });

    if (!branch) {
      throw new Error("Contexte introuvable.");
    }

    return buildSchoolReportContext(branch);
  },
);

export const getTeacherAttendanceReportAction = action
  .input(
    z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    }),
  )
  .handler(async ({ input }): Promise<TeacherAttendanceReport> => {
    const { branchId, session, userId } = await requireBranchContext();
    const teacherScope = await getTeacherAttendanceReadScope({
      session,
      userId,
      branchId,
    });

    const start = new Date(input.startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);

    if (end < start) {
      throw new Error("La date de fin doit être postérieure à la date de début.");
    }

    const records = await prisma.teacherAttendance.findMany({
      where: {
        branchId,
        date: { gte: start, lte: end },
        ...(teacherScope ? { teacherId: teacherScope.teacherId } : {}),
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
      },
      orderBy: [{ date: "asc" }],
    });

    const summary = emptyAttendanceCounts();
    const byTeacher = new Map<string, TeacherAttendanceDetailRow>();

    for (const record of records) {
      bumpAttendanceStatus(summary, record.status);

      const user = record.teacher?.branchMember?.member?.user ?? null;

      let entry = byTeacher.get(record.teacherId);
      if (!entry) {
        entry = {
          teacherId: record.teacherId,
          teacherName: formatAttendanceStudentName(user),
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
        };
        byTeacher.set(record.teacherId, entry);
      }

      bumpAttendanceStatus(entry, record.status);
    }

    const details = Array.from(byTeacher.values()).sort((a, b) =>
      a.teacherName.localeCompare(b.teacherName, "fr"),
    );

    return {
      dateStart: start.toISOString(),
      dateEnd: end.toISOString(),
      summary,
      details,
    };
  });

/* =========================
   RAPPORT PRÉSENCES PERSONNEL
========================= */

export type PersonnelAttendanceDetailRow = {
  personnelId: string;
  personnelName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

export type PersonnelAttendanceReport = {
  dateStart: string;
  dateEnd: string;
  summary: StudentAttendanceStatusCounts;
  details: PersonnelAttendanceDetailRow[];
};

export const getPersonnelAttendanceReportContextAction = action.handler(
  async () => {
    const { branchId, organizationId } = await requireBranchContext();

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: schoolReportBranchSelect,
    });

    if (!branch) {
      throw new Error("Contexte introuvable.");
    }

    return buildSchoolReportContext(branch);
  },
);

export const getPersonnelAttendanceReportAction = action
  .input(
    z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    }),
  )
  .handler(async ({ input }): Promise<PersonnelAttendanceReport> => {
    const { branchId } = await requireBranchContext();

    const start = new Date(input.startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);

    if (end < start) {
      throw new Error("La date de fin doit être postérieure à la date de début.");
    }

    const records = await prisma.personnelAttendance.findMany({
      where: {
        branchId,
        date: { gte: start, lte: end },
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
      orderBy: [{ date: "asc" }],
    });

    const summary = emptyAttendanceCounts();
    const byPersonnel = new Map<string, PersonnelAttendanceDetailRow>();

    for (const record of records) {
      bumpAttendanceStatus(summary, record.status);

      const user = record.personnel?.branchMember?.member?.user ?? null;

      let entry = byPersonnel.get(record.personnelId);
      if (!entry) {
        entry = {
          personnelId: record.personnelId,
          personnelName: formatAttendanceStudentName(user),
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
        };
        byPersonnel.set(record.personnelId, entry);
      }

      bumpAttendanceStatus(entry, record.status);
    }

    const details = Array.from(byPersonnel.values()).sort((a, b) =>
      a.personnelName.localeCompare(b.personnelName, "fr"),
    );

    return {
      dateStart: start.toISOString(),
      dateEnd: end.toISOString(),
      summary,
      details,
    };
  });

import { AttendanceStatus } from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

function atDayOffset(daysAgo: number, hour = 8) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const STATUS_CYCLE: AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.PRESENT,
  AttendanceStatus.PRESENT,
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.PRESENT,
  AttendanceStatus.ABSENT,
  AttendanceStatus.EXCUSED,
  AttendanceStatus.PRESENT,
  AttendanceStatus.PRESENT,
];

/** Sessions supplémentaires pour rapports présences élèves (sur ~2 semaines). */
const extraSessionSpecs = [
  {
    teachingKey: "prof.mukendi-MATH-7E-GEN-A",
    daysAgo: 1,
    startHour: 8,
  },
  {
    teachingKey: "prof.mukendi-MATH-7E-GEN-A",
    daysAgo: 3,
    startHour: 8,
  },
  {
    teachingKey: "prof.mbuyi-FRAN-7E-GEN-A",
    daysAgo: 2,
    startHour: 9,
  },
  {
    teachingKey: "prof.mbuyi-FRAN-7E-GEN-A",
    daysAgo: 5,
    startHour: 9,
  },
  {
    teachingKey: "prof.ndaya-BIO-5E-BIO-A",
    daysAgo: 1,
    startHour: 10,
  },
  {
    teachingKey: "prof.ndaya-BIO-5E-BIO-A",
    daysAgo: 4,
    startHour: 10,
  },
  {
    teachingKey: "prof.tshimanga-PHYS-5E-MATH-A",
    daysAgo: 2,
    startHour: 8,
  },
  {
    teachingKey: "prof.mpiana-ANG-5E-MATH-A",
    daysAgo: 6,
    startHour: 11,
  },
];

export async function initReportAttendance() {
  console.log("Initialisation des présences (rapports)...");
  const branchId = await getSeedBranchId();

  const currentYear = await Prisma.schoolYear.findFirst({
    where: { branchId, isCurrentYear: true },
  });
  if (!currentYear) {
    throw new Error("Année scolaire courante introuvable pour les présences.");
  }

  const teachings = await Prisma.teaching.findMany({
    where: { branchId },
    include: {
      teacher: {
        include: {
          branchMember: {
            include: { member: { include: { user: true } } },
          },
        },
      },
      cours: true,
      classe: true,
    },
  });

  const teachingMap = new Map<string, (typeof teachings)[number]>();
  for (const teaching of teachings) {
    const username = teaching.teacher?.branchMember?.member?.user?.username;
    const key = `${username}-${teaching.cours?.codeCours}-${teaching.classe?.codeClasse}`;
    if (username && teaching.cours?.codeCours && teaching.classe?.codeClasse) {
      teachingMap.set(key, teaching);
    }
  }

  const students = await Prisma.student.findMany({
    where: { branchMember: { branchId } },
    include: {
      classEnrollment: {
        where: { schoolYearId: currentYear.id },
        select: { classeId: true },
      },
    },
  });

  const teachers = await Prisma.teacher.findMany({
    where: { branchMember: { branchId } },
  });

  const personnels = await Prisma.personnel.findMany({
    where: { branchMember: { branchId } },
  });

  let sessionCount = 0;
  let studentAttCount = 0;

  for (const spec of extraSessionSpecs) {
    const teaching = teachingMap.get(spec.teachingKey);
    if (!teaching) {
      console.warn(`Enseignement introuvable: ${spec.teachingKey}`);
      continue;
    }

    const startTime = atDayOffset(spec.daysAgo, spec.startHour);
    const endTime = atDayOffset(spec.daysAgo, spec.startHour);
    endTime.setMinutes(45);
    const date = startOfDay(startTime);

    let session = await Prisma.attendanceSession.findFirst({
      where: {
        teachingId: teaching.id,
        date,
        startTime,
      },
    });

    if (!session) {
      session = await Prisma.attendanceSession.create({
        data: {
          teachingId: teaching.id,
          date,
          startTime,
          endTime,
          schoolYearId: currentYear.id,
          branchId,
          isClosed: true,
          closedAt: endTime,
        },
      });
      sessionCount++;
    }

    const classStudents = students.filter((s) =>
      s.classEnrollment.some((e) => e.classeId === teaching.classeId),
    );

    for (let i = 0; i < classStudents.length; i++) {
      const student = classStudents[i];
      const status = STATUS_CYCLE[(i + spec.daysAgo) % STATUS_CYCLE.length];

      const existing = await Prisma.studentAttendance.findFirst({
        where: {
          branchId,
          sessionId: session.id,
          studentId: student.id,
        },
      });

      if (!existing) {
        await Prisma.studentAttendance.create({
          data: {
            branchId,
            sessionId: session.id,
            studentId: student.id,
            status,
            recordedAt: startTime,
            remark:
              status === AttendanceStatus.ABSENT
                ? "Absence seed rapport"
                : status === AttendanceStatus.LATE
                  ? "Retard seed rapport"
                  : status === AttendanceStatus.EXCUSED
                    ? "Justifié seed rapport"
                    : "Présent",
          },
        });
        studentAttCount++;
      }
    }

    // Présences enseignants liées aux mêmes sessions
    if (teaching.teacherId) {
      const teacherStatus =
        STATUS_CYCLE[spec.daysAgo % STATUS_CYCLE.length] ===
        AttendanceStatus.ABSENT
          ? AttendanceStatus.LATE
          : AttendanceStatus.PRESENT;

      const existingTeacher = await Prisma.teacherAttendance.findFirst({
        where: {
          branchId,
          teacherId: teaching.teacherId,
          sessionId: session.id,
        },
      });

      if (!existingTeacher) {
        await Prisma.teacherAttendance.create({
          data: {
            branchId,
            teacherId: teaching.teacherId,
            sessionId: session.id,
            date,
            status: teacherStatus,
            remark: "Seed rapport enseignant",
          },
        });
      }
    }
  }

  // Sessions dédiées pour tous les enseignants (jours récents sans cours)
  let teacherAttCount = 0;
  const teacherDays = [0, 1, 2, 4, 7, 9];
  for (let tIdx = 0; tIdx < teachers.length; tIdx++) {
    const teacher = teachers[tIdx];
    const anyTeaching =
      teachings.find((th) => th.teacherId === teacher.id) ?? teachings[0];
    if (!anyTeaching) continue;

    for (const daysAgo of teacherDays) {
      const startTime = atDayOffset(daysAgo, 7 + (tIdx % 3));
      const endTime = new Date(startTime);
      endTime.setMinutes(45);
      const date = startOfDay(startTime);

      let session = await Prisma.attendanceSession.findFirst({
        where: {
          teachingId: anyTeaching.id,
          date,
          startTime,
        },
      });

      if (!session) {
        session = await Prisma.attendanceSession.create({
          data: {
            teachingId: anyTeaching.id,
            date,
            startTime,
            endTime,
            schoolYearId: currentYear.id,
            branchId,
            isClosed: true,
            closedAt: endTime,
          },
        });
      }

      const status =
        STATUS_CYCLE[(tIdx + daysAgo) % STATUS_CYCLE.length] ===
        AttendanceStatus.ABSENT
          ? AttendanceStatus.ABSENT
          : STATUS_CYCLE[(tIdx + daysAgo) % STATUS_CYCLE.length];

      const existing = await Prisma.teacherAttendance.findFirst({
        where: {
          branchId,
          teacherId: teacher.id,
          sessionId: session.id,
        },
      });

      if (!existing) {
        await Prisma.teacherAttendance.create({
          data: {
            branchId,
            teacherId: teacher.id,
            sessionId: session.id,
            date,
            status,
            remark: "Seed rapport enseignant",
          },
        });
        teacherAttCount++;
      }
    }
  }

  // Présences personnel (pas de session requise)
  let personnelAttCount = 0;
  const personnelDays = [0, 1, 2, 3, 5, 7, 8, 10];
  for (let pIdx = 0; pIdx < personnels.length; pIdx++) {
    const personnel = personnels[pIdx];
    for (const daysAgo of personnelDays) {
      const date = startOfDay(atDayOffset(daysAgo, 7));
      const checkIn = atDayOffset(daysAgo, 7);
      const checkOut = atDayOffset(daysAgo, 16);
      const status = STATUS_CYCLE[(pIdx + daysAgo) % STATUS_CYCLE.length];

      const existing = await Prisma.personnelAttendance.findFirst({
        where: {
          branchId,
          personnelId: personnel.id,
          date,
        },
      });

      if (!existing) {
        await Prisma.personnelAttendance.create({
          data: {
            branchId,
            personnelId: personnel.id,
            date,
            checkIn:
              status === AttendanceStatus.ABSENT ? null : checkIn,
            checkOut:
              status === AttendanceStatus.ABSENT ||
              status === AttendanceStatus.LATE
                ? null
                : checkOut,
            status,
            remark: "Seed rapport personnel",
          },
        });
        personnelAttCount++;
      }
    }
  }

  console.log(
    `OK présences rapports: ${sessionCount} sessions, ${studentAttCount} élèves, ${teacherAttCount} enseignants, ${personnelAttCount} personnel`,
  );
}

export async function clearReportAttendance() {
  console.log("Suppression des présences de rapports...");
  await Prisma.teacherAttendance.deleteMany({});
  await Prisma.personnelAttendance.deleteMany({});
  // Les StudentAttendance / sessions sont gérés par clearMetricsEvents
  // et réécrits au re-seed ; on ne vide pas tout ici pour éviter de casser metrics.
  console.log("OK présences enseignants/personnel supprimées");
}

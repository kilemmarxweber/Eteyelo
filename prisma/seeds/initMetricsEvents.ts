import { AttendanceStatus } from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

const eventTypesData = [
  { name: "Réunion parents" },
  { name: "Examen" },
  { name: "Journée pédagogique" },
  { name: "Cérémonie" },
];

const calendarEventData = [
  {
    title: "Réunion parents 7E-GEN-A",
    dateStart: new Date("2026-05-20T09:00:00Z"),
    dateEnd: new Date("2026-05-20T10:30:00Z"),
    allDay: false,
    location: "Salle 201",
    description: "Réunion parents-professeurs pour la classe 7E-GEN-A.",
    typeName: "Réunion parents",
    classeCode: "7E-GEN-A",
    teachingKey: "prof.mukendi-MATH-7E-GEN-A",
  },
  {
    title: "Examen de Math 7E-GEN-A",
    dateStart: new Date("2026-06-10T08:00:00Z"),
    dateEnd: new Date("2026-06-10T10:30:00Z"),
    allDay: false,
    location: "Salle 109",
    description: "Examen semestriel de Mathématiques pour 7E-GEN-A.",
    typeName: "Examen",
    classeCode: "7E-GEN-A",
    teachingKey: "prof.mukendi-MATH-7E-GEN-A",
  },
  {
    title: "Journée pédagogique",
    dateStart: new Date("2026-05-01T00:00:00Z"),
    dateEnd: new Date("2026-05-01T23:59:59Z"),
    allDay: true,
    location: "Kinshasa Centre",
    description: "Journée pédagogique nationale. L’école est fermée.",
    typeName: "Journée pédagogique",
  },
  {
    title: "Cérémonie sportive 5E-MATH-A",
    dateStart: new Date("2026-06-05T13:00:00Z"),
    dateEnd: new Date("2026-06-05T16:30:00Z"),
    allDay: false,
    location: "Stade de l’école",
    description: "Cérémonie sportive avec les élèves de 5E-MATH-A.",
    typeName: "Cérémonie",
    classeCode: "5E-MATH-A",
    teachingKey: "prof.mpiana-ANG-5E-MATH-A",
  },
  {
    title: "Rentrée scolaire 2026-2027",
    dateStart: new Date("2026-09-01T08:00:00Z"),
    dateEnd: new Date("2026-09-01T12:00:00Z"),
    allDay: false,
    location: "Kinshasa Centre",
    description: "Accueil des élèves pour la rentrée scolaire 2026-2027.",
    typeName: "Cérémonie",
    classeCode: "7E-GEN-A",
    teachingKey: "prof.mukendi-MATH-7E-GEN-A",
  },
  {
    title: "Réunion de coordination pédagogique",
    dateStart: new Date("2026-10-15T10:00:00Z"),
    dateEnd: new Date("2026-10-15T11:30:00Z"),
    allDay: false,
    location: "Salle de réunion principale",
    description: "Réunion de coordination pédagogique des professeurs.",
    typeName: "Réunion parents",
  },
];

const attendanceSessionData = [
  {
    teachingKey: "prof.mukendi-MATH-7E-GEN-A",
    date: new Date("2026-05-14T00:00:00Z"),
    startTime: new Date("2026-05-14T08:00:00Z"),
    endTime: new Date("2026-05-14T08:45:00Z"),
  },
  {
    teachingKey: "prof.mbuyi-FRAN-7E-GEN-A",
    date: new Date("2026-05-15T00:00:00Z"),
    startTime: new Date("2026-05-15T09:00:00Z"),
    endTime: new Date("2026-05-15T09:45:00Z"),
  },
];

const gradeData = [
  { username: "eleve.kasongo.junior", periodLabel: "1st Period", score: 68 },
  { username: "eleve.kalombo.grâce", periodLabel: "1st Period", score: 72 },
  { username: "eleve.mulumba.prince", periodLabel: "1st Period", score: 45 },
  { username: "eleve.mwamba.esther", periodLabel: "1st Period", score: 55 },
  { username: "eleve.katanga.david", periodLabel: "1st Period", score: 81 },
  { username: "eleve.mukendi.sarah", periodLabel: "1st Period", score: 49 },
  { username: "eleve.tshiamala.michel", periodLabel: "1st Period", score: 63 },
  { username: "eleve.kabongo.ruth", periodLabel: "1st Period", score: 58 },
  { username: "eleve.mputu.samuel", periodLabel: "1st Period", score: 77 },
  { username: "eleve.tshilombo.joie", periodLabel: "1st Period", score: 53 },
  { username: "eleve.kasongo.junior", periodLabel: "2nd Period", score: 60 },
  { username: "eleve.kalombo.grâce", periodLabel: "2nd Period", score: 44 },
  { username: "eleve.mulumba.prince", periodLabel: "2nd Period", score: 52 },
  { username: "eleve.mwamba.esther", periodLabel: "2nd Period", score: 69 },
  { username: "eleve.katanga.david", periodLabel: "2nd Period", score: 88 },
  { username: "eleve.mukendi.sarah", periodLabel: "2nd Period", score: 47 },
  { username: "eleve.tshiamala.michel", periodLabel: "2nd Period", score: 74 },
  { username: "eleve.kabongo.ruth", periodLabel: "2nd Period", score: 67 },
  { username: "eleve.mputu.samuel", periodLabel: "2nd Period", score: 56 },
  { username: "eleve.tshilombo.joie", periodLabel: "2nd Period", score: 50 },
];

const parentFeedbackRatings = [
  { username: "parent.kasongo", ratings: [5, 5, 4, 4, 5, 4, 5, 5, 4] },
  { username: "parent.kalombo", ratings: [4, 4, 3, 4, 4, 4, 5, 4, 4] },
  { username: "parent.mulumba", ratings: [5, 5, 5, 5, 5, 5, 5, 5, 5] },
  { username: "parent.mwamba", ratings: [3, 4, 4, 3, 4, 4, 3, 4, 4] },
  { username: "parent.katanga", ratings: [5, 4, 4, 5, 4, 5, 4, 4, 5] },
];

export async function initMetricsEvents() {
  console.log("Initialisation des métriques et des événements...");

  const branchId = await getSeedBranchId();
  const currentYear = await Prisma.schoolYear.findFirst({
    where: { branchId, isCurrentYear: true },
  });

  if (!currentYear) {
    throw new Error(
      "Aucune année scolaire courante trouvée pour les seeds métriques.",
    );
  }

  const adminUser = await Prisma.user.findFirst({
    where: { username: "admin" },
  });
  const createdBy = adminUser?.id ?? "system";

  const classes = await Prisma.classe.findMany({ where: { branchId } });
  const teachings = await Prisma.teaching.findMany({
    where: { branchId },
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
      cours: true,
      classe: true,
      schoolYear: true,
    },
  });
  const students = await Prisma.student.findMany({
    where: { branchMember: { branchId } },
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
  const parents = await Prisma.parent.findMany({
    where: { branchMember: { branchId } },
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
  const periods = await Prisma.period.findMany({
    where: { branchId, semester: { branchId } },
  });

  const eventTypeMap = new Map<string, string>();
  for (const type of eventTypesData) {
    const existing = await Prisma.eventType.upsert({
      where: { name: type.name },
      update: { branchId },
      create: { name: type.name, branchId },
    });
    eventTypeMap.set(type.name, existing.id);
  }

  const classeMap = new Map(classes.map((c) => [c.codeClasse, c.id]));
  const teachingMap = new Map<string, string>();
  teachings.forEach((teaching) => {
    const username = teaching.teacher?.branchMember?.member?.user?.username;
    const key = `${username}-${teaching.cours?.codeCours}-${teaching.classe?.codeClasse}`;
    if (username && teaching.cours?.codeCours && teaching.classe?.codeClasse) {
      teachingMap.set(key, teaching.id);
    }
  });

  for (const event of calendarEventData) {
    const typeId = eventTypeMap.get(event.typeName);
    const classeId = event.classeCode
      ? classeMap.get(event.classeCode)
      : undefined;
    const teachingId = event.teachingKey
      ? teachingMap.get(event.teachingKey)
      : undefined;

    const data = {
      title: event.title,
      dateStart: event.dateStart,
      dateEnd: event.dateEnd,
      allDay: event.allDay,
      location: event.location,
      description: event.description,
      schoolYearId: currentYear.id,
      typeId: typeId ?? undefined,
      classeId: classeId ?? undefined,
      teachingId: teachingId ?? undefined,
      branchId,
      createdBy,
    };

    const existing = await Prisma.calendarEvent.findFirst({
      where: {
        title: event.title,
        branchId,
      },
    });

    if (existing) {
      await Prisma.calendarEvent.update({ where: { id: existing.id }, data });
    } else {
      await Prisma.calendarEvent.create({ data });
    }
  }

  const sessionMap = new Map<string, string>();
  for (const session of attendanceSessionData) {
    const teachingId = teachingMap.get(session.teachingKey);
    if (!teachingId) {
      console.warn(
        `Enseignement introuvable pour session ${session.teachingKey}`,
      );
      continue;
    }

    const existing = await Prisma.attendanceSession.findFirst({
      where: {
        teachingId,
        date: session.date,
        startTime: session.startTime,
      },
    });

    const record = existing
      ? await Prisma.attendanceSession.update({
          where: { id: existing.id },
          data: {
            endTime: session.endTime,
            schoolYearId: currentYear.id,
            branchId,
          },
        })
      : await Prisma.attendanceSession.create({
          data: {
            teachingId,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            schoolYearId: currentYear.id,
            branchId,
          },
        });

    sessionMap.set(session.teachingKey, record.id);
  }

  const sessionIds = Array.from(sessionMap.values());
  if (sessionIds.length === 0) {
    console.warn("Aucune session de présence créée pour les seeds métriques.");
  }

  const attendanceStatuses: AttendanceStatus[] = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.ABSENT,
  ];

  for (let idx = 0; idx < students.length; idx++) {
    const student = students[idx];
    const sessionId = sessionIds[idx % sessionIds.length];

    const existing = await Prisma.studentAttendance.findFirst({
      where: {
        branchId,
        sessionId,
        studentId: student.id,
      },
    });

    if (!existing) {
      await Prisma.studentAttendance.create({
        data: {
          branchId,
          sessionId,
          studentId: student.id,
          status: attendanceStatuses[idx] ?? AttendanceStatus.PRESENT,
          remark:
            attendanceStatuses[idx] === AttendanceStatus.ABSENT
              ? "Absence enregistrée"
              : "Présent",
        },
      });
    }
  }

  const periodMap = new Map(periods.map((period) => [period.label, period.id]));

  for (const grade of gradeData) {
    const student = students.find(
      (stu) => stu.branchMember?.member?.user?.username === grade.username,
    );
    const periodId = periodMap.get(grade.periodLabel);
    if (!student || !periodId) {
      console.warn(
        `Note ignorée pour ${grade.username} / ${grade.periodLabel}`,
      );
      continue;
    }

    const existing = await Prisma.studentGrade.findFirst({
      where: {
        studentId: student.id,
        periodId,
      },
    });

    if (existing) {
      await Prisma.studentGrade.update({
        where: { id: existing.id },
        data: {
          score: grade.score,
          schoolYearId: currentYear.id,
          branchId,
        },
      });
    } else {
      await Prisma.studentGrade.create({
        data: {
          studentId: student.id,
          periodId,
          score: grade.score,
          schoolYearId: currentYear.id,
          branchId,
        },
      });
    }
  }

  const parentMap = new Map(
    parents.map((parent) => [
      parent.branchMember?.member?.user?.username,
      parent.id,
    ]),
  );

  for (const feedback of parentFeedbackRatings) {
    const parentId = parentMap.get(feedback.username);
    if (!parentId) {
      console.warn(`Parent introuvable pour feedback ${feedback.username}`);
      continue;
    }

    for (let month = 1; month <= feedback.ratings.length; month++) {
      const rating = feedback.ratings[month - 1];
      const existing = await Prisma.parentFeedback.findFirst({
        where: {
          parentId,
          month,
          schoolYearId: currentYear.id,
          branchId,
        },
      });

      if (existing) {
        await Prisma.parentFeedback.update({
          where: { id: existing.id },
          data: { rating, branchId },
        });
      } else {
        await Prisma.parentFeedback.create({
          data: {
            parentId,
            rating,
            month,
            schoolYearId: currentYear.id,
            branchId,
          },
        });
      }
    }
  }

  console.log("OK métriques et événements de seed créés");
}

export async function clearMetricsEvents() {
  console.log("Suppression des métriques et des événements...");
  await Prisma.studentAttendance.deleteMany({});
  await Prisma.attendanceSession.deleteMany({});
  await Prisma.studentGrade.deleteMany({});
  await Prisma.parentFeedback.deleteMany({});
  await Prisma.calendarEvent.deleteMany({});
  await Prisma.eventType.deleteMany({});
  console.log("OK métriques et événements supprimés");
}

import { Day } from "@/prisma/generated/prisma/client";
import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

const scheduleData = [
  {
    day: Day.Lundi,
    hour: "07:30:00",
    teacherUsername: "prof.mukendi",
    cours: "MATH",
    classe: "7E-GEN-A",
    schoolYear: "2025-2026",
  },
  {
    day: Day.Lundi,
    hour: "08:25:00",
    teacherUsername: "prof.mbuyi",
    cours: "FRAN",
    classe: "7E-GEN-A",
    schoolYear: "2025-2026",
  },
  {
    day: Day.Lundi,
    hour: "09:20:00",
    teacherUsername: "prof.mpiana",
    cours: "ANG",
    classe: "7E-GEN-A",
    schoolYear: "2025-2026",
  },
];

export async function initSchedules() {
  console.log("Initialisation des horaires...");
  const branchId = await getSeedBranchId();

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

  const teachingMap = new Map<string, string>();
  teachings.forEach((t) => {
    const username = t.teacher?.branchMember?.member?.user?.username;
    const key = `${username}-${t.cours?.codeCours}-${t.classe?.codeClasse}-${t.schoolYear?.nameYear}`;
    teachingMap.set(key, t.id);
  });

  const adminBranchMember = await Prisma.branchMember.findFirst({
    where: {
      branchId,
      member: {
        user: {
          username: "admin",
        },
      },
    },
  });

  let createdCount = 0;

  for (const schedule of scheduleData) {
    const teachingKey = `${schedule.teacherUsername}-${schedule.cours}-${schedule.classe}-${schedule.schoolYear}`;
    const teachingId = teachingMap.get(teachingKey);

    if (!teachingId) {
      console.warn(`Enseignement non trouve pour: ${teachingKey}`);
      continue;
    }

    const hourDate = new Date(`1970-01-01T${schedule.hour}Z`);
    const existingSchedule = await Prisma.schedule.findFirst({
      where: {
        day: schedule.day,
        hour: hourDate,
        teachingId,
      },
    });

    if (!existingSchedule) {
      await Prisma.schedule.create({
        data: {
          day: schedule.day,
          hour: hourDate,
          teachingId,
          createdBy: adminBranchMember?.id,
        },
      });
      createdCount++;
    }
  }

  console.log(`OK ${createdCount} horaires crees`);
}

export async function clearSchedules() {
  console.log("Suppression des horaires...");
  await Prisma.schedule.deleteMany({});
  console.log("OK horaires supprimes");
}

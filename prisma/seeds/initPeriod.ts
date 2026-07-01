import { prisma as Prisma } from "@/lib/prisma";
import { getSeedBranchId } from "./seedContext";

export async function initPeriods() {
  console.log("Initialisation des periodes...");
  const branchId = await getSeedBranchId();

  const semester1 = await Prisma.semester.upsert({
    where: { label: "Semester 1" },
    update: { branchId },
    create: {
      label: "Semester 1",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-01-15"),
      branchId,
    },
  });

  const semester2 = await Prisma.semester.upsert({
    where: { label: "Semester 2" },
    update: { branchId },
    create: {
      label: "Semester 2",
      startDate: new Date("2026-01-16"),
      endDate: new Date("2026-06-26"),
      branchId,
    },
  });

  const periodData = [
    {
      label: "1st Period",
      startDate: semester1.startDate,
      endDate: new Date("2025-11-30"),
      semesterId: semester1.id,
    },
    {
      label: "2nd Period",
      startDate: new Date("2025-12-01"),
      endDate: new Date("2026-01-15"),
      semesterId: semester1.id,
    },
    {
      label: "Exam 1st semester",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-15"),
      semesterId: semester1.id,
    },
    {
      label: "3tr Period",
      startDate: semester2.startDate,
      endDate: new Date("2026-04-15"),
      semesterId: semester2.id,
    },
    {
      label: "4th Period",
      startDate: new Date("2026-04-16"),
      endDate: new Date("2026-05-15"),
      semesterId: semester2.id,
    },
    {
      label: "Exam 2nd semester",
      startDate: new Date("2026-05-16"),
      endDate: semester2.endDate,
      semesterId: semester2.id,
    },
  ];

  for (const pd of periodData) {
    const existing = await Prisma.period.findFirst({
      where: { label: pd.label, semesterId: pd.semesterId, branchId },
    });

    if (!existing) {
      await Prisma.period.create({
        data: {
          ...pd,
          branchId,
        },
      });
    } else {
      await Prisma.period.update({
        where: { id: existing.id },
        data: {
          startDate: pd.startDate,
          endDate: pd.endDate,
          branchId,
        },
      });
    }
  }

  console.log(`OK ${periodData.length} periodes traitees`);
}

export async function clearPeriods() {
  console.log("Suppression des periodes et semesters...");
  await Prisma.period.deleteMany({});
  await Prisma.semester.deleteMany({});
  console.log("OK periodes et semesters supprimes");
}

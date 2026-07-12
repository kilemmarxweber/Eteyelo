import type { Prisma } from "@/prisma/generated/prisma/client";

type CreneauDb = Pick<Prisma.TransactionClient, "creneau">;

function timeAt(hours: number, minutes: number) {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

export async function ensureDefaultCreneaux(db: CreneauDb, branchId: string) {
  const defaults = [
    {
      nameCreneau: "Horaire standard matin",
      startTime: timeAt(7, 30),
      endTime: timeAt(12, 15),
      recreationHour: timeAt(10, 30),
    },
    {
      nameCreneau: "Horaire standard après-midi",
      startTime: timeAt(12, 30),
      endTime: timeAt(17, 30),
      recreationHour: timeAt(15, 30),
    },
  ];

  for (const item of defaults) {
    const existing = await db.creneau.findFirst({
      where: { branchId, nameCreneau: item.nameCreneau },
      select: { id: true },
    });
    if (!existing) {
      await db.creneau.create({
        data: {
          ...item,
          branchId,
          durationCourse: 45,
          recreationDuration: 15,
          isArchived: false,
        },
      });
    }
  }
}

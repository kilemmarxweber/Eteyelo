import type { Prisma } from "@/prisma/generated/prisma/client";

type CreneauDb = Pick<Prisma.TransactionClient, "creneau">;

function timeAt(hours: number, minutes: number) {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

/**
 * Defaults aligned on secondaire / humanités :
 * 3 cours avant la récréation (15 min) + 3 cours après.
 * Le primaire peut définir d'autres vacations via Paramètres > Horaires.
 */
export async function ensureDefaultCreneaux(db: CreneauDb, branchId: string) {
  const defaults = [
    {
      nameCreneau: "Horaire standard matin",
      startTime: timeAt(7, 30),
      endTime: timeAt(12, 15),
      // 07:30, 08:15, 09:00 → récréation 09:45 → 10:00, 10:45, 11:30
      recreationHour: timeAt(9, 45),
    },
    {
      nameCreneau: "Horaire standard après-midi",
      startTime: timeAt(12, 30),
      endTime: timeAt(17, 15),
      // 12:30, 13:15, 14:00 → récréation 14:45 → 15:00, 15:45, 16:30
      recreationHour: timeAt(14, 45),
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

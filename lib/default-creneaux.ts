import type { Prisma } from "@/prisma/generated/prisma/client";
import { DEFAULT_CRENEAU_WORKING_DAYS } from "@/lib/creneau-working-days";
import { normalizeEducationSystem } from "@/lib/education-system";

type CreneauDb = Pick<Prisma.TransactionClient, "creneau">;

function timeAt(hours: number, minutes: number) {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

/**
 * Defaults aligned on secondaire / humanités :
 * 3 cours avant la récréation (15 min) + 3 cours après.
 * Le primaire peut définir d'autres vacations via Paramètres > Horaires.
 * Branche angolaise : libellés PT (Manhã / Tarde).
 */
export async function ensureDefaultCreneaux(
  db: CreneauDb,
  branchId: string,
  educationSystem?: unknown,
) {
  const isAngola = normalizeEducationSystem(educationSystem) === "ANGOLAIS";
  const defaults = isAngola
    ? [
        {
          nameCreneau: "Manhã",
          startTime: timeAt(7, 30),
          endTime: timeAt(12, 15),
          recreationHour: timeAt(9, 45),
        },
        {
          nameCreneau: "Tarde",
          startTime: timeAt(12, 30),
          endTime: timeAt(17, 15),
          recreationHour: timeAt(14, 45),
        },
      ]
    : [
        {
          nameCreneau: "Horaire standard matin",
          startTime: timeAt(7, 30),
          endTime: timeAt(12, 15),
          recreationHour: timeAt(9, 45),
        },
        {
          nameCreneau: "Horaire standard après-midi",
          startTime: timeAt(12, 30),
          endTime: timeAt(17, 15),
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
          workingDays: [...DEFAULT_CRENEAU_WORKING_DAYS],
          isArchived: false,
        },
      });
    }
  }
}

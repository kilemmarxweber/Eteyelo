import { prisma } from "@/lib/prisma";
import { normalizeImageSrc } from "@/lib/utils";
import type {
  StudentAnnouncementItem,
  StudentAnnouncementsData,
} from "@/lib/student-announcements-types";

function formatAnnouncementDate(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

export async function buildStudentAnnouncementsData(
  branchId: string,
  organizationId: string,
  classIds: string[],
  schoolYearId?: string | null,
): Promise<StudentAnnouncementsData> {
  const uniqueClassIds = Array.from(new Set(classIds.filter(Boolean)));

  const events = await prisma.calendarEvent.findMany({
    where: {
      branchId,
      isArchived: false,
      ...(schoolYearId ? { schoolYearId } : {}),
      OR: [
        { classeId: null },
        ...(uniqueClassIds.length > 0
          ? [{ classeId: { in: uniqueClassIds } }]
          : []),
      ],
    },
    include: {
      classe: {
        select: {
          nameClasse: true,
          codeClasse: true,
        },
      },
      eventType: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { dateStart: "desc" },
    take: 50,
  });

  const items: StudentAnnouncementItem[] = events.map((event) => {
    const isForAll = !event.classeId;
    const classLabel =
      event.classe?.nameClasse ||
      event.classe?.codeClasse ||
      "Classe cible";

    return {
      id: event.id,
      title: event.title?.trim() || "Annonce",
      description: event.description?.trim() || null,
      dateStartLabel: formatAnnouncementDate(event.dateStart) ?? "-",
      dateEndLabel: formatAnnouncementDate(event.dateEnd),
      location: event.location?.trim() || null,
      audienceLabel: isForAll ? "Toute l'ecole" : classLabel,
      audienceScope: isForAll ? "all" : "class",
      eventTypeName: event.eventType?.name?.trim() || null,
      image: event.image ? normalizeImageSrc(event.image) : null,
    };
  });

  return { items };
}

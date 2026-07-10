"use server";
import { prisma } from "@/lib/prisma"; // Assumes Prisma client is in lib/prisma
import { calendarEventSchema } from "@/src/interfaces/CalendarEvent";
import { action } from "@/lib/zsa";
import { ICalendarEvent } from "@/src/interfaces/CalendarEvent";
import { Recurrence } from "@/prisma/generated/prisma/client";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

async function assertCalendarEventRelationsInBranch(
  input: {
    schoolYearId?: string;
    teachingId?: string;
    classeId?: string;
    typeId?: string;
  },
  branchId: string,
) {
  const [schoolYear, teaching, classe, eventType] = await Promise.all([
    input.schoolYearId
      ? prisma.schoolYear.findFirst({
          where: { id: input.schoolYearId, branchId },
          select: { id: true },
        })
      : null,
    input.teachingId
      ? prisma.teaching.findFirst({
          where: {
            id: input.teachingId,
            OR: [
              { branchId },
              {
                branchId: null,
                classe: {
                  branchId,
                },
              },
            ],
            cours: {
              branchId,
            },
          },
          select: { id: true },
        })
      : null,
    input.classeId
      ? prisma.classe.findFirst({
          where: { id: input.classeId, branchId },
          select: { id: true },
        })
      : null,
    input.typeId
      ? prisma.eventType.findFirst({
          where: { id: input.typeId, branchId },
          select: { id: true },
        })
      : null,
  ]);

  if (input.schoolYearId && !schoolYear) {
    throw new Error("Annee scolaire introuvable dans cette branche");
  }

  if (input.teachingId && !teaching) {
    throw new Error("Enseignement introuvable dans cette branche");
  }

  if (input.classeId && !classe) {
    throw new Error("Classe introuvable dans cette branche");
  }

  if (input.typeId && !eventType) {
    throw new Error("Type d'evenement introuvable dans cette branche");
  }
}

// Action pour créer un événement
export const createCalendarEvent = action
  .input(calendarEventSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, userId } = await requireBranchContext();
      // 1. school year courant
      const currentSchoolYear = await prisma.schoolYear.findFirst({
        where: {
          branchId,
          isCurrentYear: true,
        },
      });

      if (!currentSchoolYear) {
        return {
          success: false,
          message: "Aucune année scolaire active trouvée",
        };
      }

      // 2. création event
      await assertCalendarEventRelationsInBranch(input, branchId);

      const event = await prisma.calendarEvent.create({
        data: {
          ...input,
          branchId,
          createdBy: input.createdBy || userId,
          schoolYearId: currentSchoolYear.id,
        },
      });

      return {
        success: true,
        message: "Événement créé avec succès",
        event,
      };
    } catch (error: any) {
      console.error("CREATE EVENT ERROR:", error);

      return {
        success: false,
        message: error.message || "Erreur lors de la création",
      };
    }
  });

// Action pour récupérer tous les événements
export const getCalendarEvents = action.handler(
  async (): Promise<ICalendarEvent[]> => {
    const { branchId } = await requireBranchContext();
    const Events = await prisma.calendarEvent.findMany({
      where: {
        branchId,
      },
      include: {
        eventType: true,
        schoolYear: true,
        teaching: {
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
          },
        },
        classe: true,
      },
    });
    const transormedEvents: ICalendarEvent[] = Events.map((event) => ({
      ...event,
      title: event.title || "",
      dateEnd: event.dateEnd || new Date(),
      location: event.location || "",
      description: event.description || "",
      teachingId: event.teachingId || "",
      schoolYearId: event.schoolYearId || "",
      typeId: event.typeId || "",
      classeId: event.classeId || "",
      recurrence: event.recurrence || Recurrence.HEBDOMADAIRE,
      schoolYear: event.schoolYear
        ? {
            ...event.schoolYear,
          }
        : undefined,
      teaching: event.teaching
        ? {
            ...event.teaching,
            id: event.teaching.id,
            classeId: event.teaching.classeId || null,
            teacherId: event.teaching.teacherId || null,
            cours: event.teaching.cours
              ? {
                  coursId: event.teaching.coursId || "",
                  codeCours: event.teaching.cours?.codeCours,
                  nameCours: event.teaching.cours?.nameCours || "",
                  ponderation: 0,
                  description: event.teaching.cours?.description || "",
                }
              : undefined,
            teacher: event.teaching.teacher
              ? {
                  ...event.teaching.teacher,
                }
              : undefined,
          }
        : undefined,
    }));
    return transormedEvents;
  },
);

// Action pour mettre à jour un événement
export const updateCalendarEvent = action
  .input(calendarEventSchema)
  .handler(async ({ input }) => {
    // Validation des données d'entrée
    const { branchId } = await requireBranchContext();
    const event = await prisma.calendarEvent.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });
    if (!event) throw new Error("Evenement introuvable dans cette branche");

    await assertCalendarEventRelationsInBranch(input, branchId);

    const updatedEvent = await prisma.calendarEvent.update({
      where: { id: input.id },
      data: {
        ...input,
        branchId,
      },
    });

    return updatedEvent;
  });

// Action pour supprimer un événement
export const deleteCalendarEvent = action
  .input(calendarEventSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const event = await prisma.calendarEvent.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });
    if (!event) throw new Error("Evenement introuvable dans cette branche");

    const deletedEvent = await prisma.calendarEvent.delete({
      where: { id: input.id },
    });

    return deletedEvent;
  });

"use server";

import { prisma } from "@/lib/prisma";
import { calendarEventSchema } from "@/src/interfaces/CalendarEvent";
import { action } from "@/lib/zsa";
import { ICalendarEvent } from "@/src/interfaces/CalendarEvent";
import { Recurrence, Prisma } from "@/prisma/generated/prisma/client";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { buildIsArchivedUpdate } from "@/lib/archive";
import { requireCurrentSchoolYear } from "@/lib/school-year";
import {
  compactLocaleMap,
  normalizeLocaleMap,
  type EventLocaleMap,
} from "@/lib/calendar-event-i18n";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function assertCalendarEventRelationsInBranch(
  input: {
    schoolYearId?: string;
    teachingId?: string | null;
    classeId?: string | null;
    typeId?: string | null;
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
              { branchId: null, classe: { branchId } },
            ],
            cours: { branchId },
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

function toJsonValue(
  map: EventLocaleMap | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const compacted = map ? compactLocaleMap(map) : null;
  return compacted ? (compacted as Prisma.InputJsonValue) : Prisma.DbNull;
}

function buildEventData(
  input: z.infer<typeof calendarEventSchema>,
  branchId: string,
  userId: string,
  schoolYearId: string,
) {
  const titleI18n = input.translationsEnabled
    ? {
        ...normalizeLocaleMap(input.titleI18n),
        fr: input.title,
      }
    : null;
  const descriptionI18n = input.translationsEnabled
    ? {
        ...normalizeLocaleMap(input.descriptionI18n),
        fr: input.description ?? "",
      }
    : null;

  return {
    title: input.title,
    description: input.description || null,
    location: input.location || null,
    image: input.image || null,
    allDay: input.allDay,
    dateStart: input.dateStart,
    dateEnd: input.dateEnd || null,
    recurrence: input.recurrence,
    typeId: input.typeId || null,
    classeId: input.classeId || null,
    teachingId: input.teachingId || null,
    titleI18n: toJsonValue(titleI18n),
    descriptionI18n: toJsonValue(descriptionI18n),
    branchId,
    createdBy: input.createdBy || userId,
    schoolYearId,
  };
}

function mapEvent(event: {
  id: string;
  title: string | null;
  dateStart: Date;
  dateEnd: Date | null;
  image: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  titleI18n: unknown;
  descriptionI18n: unknown;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  teachingId: string | null;
  schoolYearId: string | null;
  typeId: string | null;
  classeId: string | null;
  recurrence: Recurrence | null;
  eventType?: { id: string; name: string } | null;
  schoolYear?: ICalendarEvent["schoolYear"] | null;
  teaching?: unknown;
  classe?: unknown;
}): ICalendarEvent {
  return {
    id: event.id,
    title: event.title || "",
    dateStart: event.dateStart,
    dateEnd: event.dateEnd || undefined,
    image: event.image,
    allDay: event.allDay,
    location: event.location || "",
    description: event.description || "",
    titleI18n: normalizeLocaleMap(event.titleI18n),
    descriptionI18n: normalizeLocaleMap(event.descriptionI18n),
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    teachingId: event.teachingId || "",
    schoolYearId: event.schoolYearId || "",
    typeId: event.typeId || "",
    classeId: event.classeId || "",
    recurrence: event.recurrence || Recurrence.HEBDOMADAIRE,
    eventType: event.eventType ?? null,
    schoolYear: event.schoolYear ?? undefined,
    teaching: event.teaching as ICalendarEvent["teaching"],
  };
}

export const createCalendarEvent = action
  .input(calendarEventSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, userId, organizationId } = await requireBranchContext();
      const currentSchoolYear = await requireCurrentSchoolYear(branchId);
      await assertCalendarEventRelationsInBranch(input, branchId);

      const event = await prisma.calendarEvent.create({
        data: buildEventData(input, branchId, userId, currentSchoolYear.id),
      });

      revalidatePath(
        `/admin/organizations/${organizationId}/branches/${branchId}/settings/calendar`,
      );

      return {
        success: true,
        message: "Evenement cree avec succes",
        event,
      };
    } catch (error: unknown) {
      console.error("CREATE EVENT ERROR:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors de la creation",
      };
    }
  });

export const getCalendarEvents = action.handler(
  async (): Promise<ICalendarEvent[]> => {
    const { branchId } = await requireBranchContext();
    const events = await prisma.calendarEvent.findMany({
      where: { branchId, isArchived: false },
      include: {
        eventType: true,
        schoolYear: true,
        teaching: {
          include: {
            teacher: {
              include: {
                branchMember: {
                  include: { member: { include: { user: true } } },
                },
              },
            },
            cours: true,
          },
        },
        classe: true,
      },
      orderBy: { dateStart: "desc" },
    });

    return events.map(mapEvent);
  },
);

export const updateCalendarEvent = action
  .input(calendarEventSchema)
  .handler(async ({ input }) => {
    const { branchId, userId, organizationId } = await requireBranchContext();
    if (!input.id) throw new Error("Identifiant evenement manquant");

    const event = await prisma.calendarEvent.findFirst({
      where: { id: input.id, branchId },
      select: { id: true, schoolYearId: true },
    });
    if (!event) throw new Error("Evenement introuvable dans cette branche");

    await assertCalendarEventRelationsInBranch(input, branchId);

    const updated = await prisma.calendarEvent.update({
      where: { id: input.id },
      data: buildEventData(
        input,
        branchId,
        userId,
        input.schoolYearId || event.schoolYearId,
      ),
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/settings/calendar`,
    );

    return updated;
  });

export const archiveCalendarEvent = action
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, userId, organizationId } = await requireBranchContext();
    const event = await prisma.calendarEvent.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });
    if (!event) throw new Error("Evenement introuvable dans cette branche");

    const archived = await prisma.calendarEvent.update({
      where: { id: input.id },
      data: buildIsArchivedUpdate(userId),
    });

    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/settings/calendar`,
    );

    return archived;
  });

/** @deprecated Utiliser archiveCalendarEvent */
export const deleteCalendarEvent = archiveCalendarEvent;

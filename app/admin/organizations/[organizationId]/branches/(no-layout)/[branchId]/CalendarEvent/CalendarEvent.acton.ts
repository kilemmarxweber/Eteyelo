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
    classeIds?: string[] | null;
    typeId?: string | null;
  },
  branchId: string,
) {
  const classeIds = uniqueIds([
    ...(input.classeIds ?? []),
    input.classeId ?? "",
  ]);
  const [schoolYear, teaching, classes, eventType] = await Promise.all([
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
    classeIds.length
      ? prisma.classe.findMany({
          where: { id: { in: classeIds }, branchId },
          select: { id: true },
        })
      : [],
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
  if (classeIds.length && classes.length !== classeIds.length) {
    throw new Error("Classe introuvable dans cette branche");
  }
  if (input.typeId && !eventType) {
    throw new Error("Type d'evenement introuvable dans cette branche");
  }
}

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))];
}

function toJsonValue(
  map: EventLocaleMap | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const compacted = map ? compactLocaleMap(map) : null;
  return compacted ? (compacted as Prisma.InputJsonValue) : Prisma.DbNull;
}

/** Stocke uniquement le fileName (comme Branch.image), pas /api/uploads/... */
function toStoredImageFileName(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("/")) return trimmed;

  try {
    const pathname = trimmed.startsWith("http")
      ? new URL(trimmed).pathname
      : trimmed;
    const base = pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(base) || null;
  } catch {
    return trimmed;
  }
}

function buildEventData(
  input: z.infer<typeof calendarEventSchema>,
  branchId: string,
  userId: string,
  schoolYearId: string,
  typeId: string | null,
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

  const classeIds = uniqueIds([
    ...(input.classeIds ?? []),
    input.classeId ?? "",
  ]);

  return {
    title: input.title,
    description: input.description || null,
    location: input.location || null,
    image: toStoredImageFileName(input.image),
    allDay: input.allDay,
    closesAttendance: input.closesAttendance,
    closesForStudents: input.closesAttendance ? input.closesForStudents : true,
    closesForTeachers: input.closesAttendance ? input.closesForTeachers : true,
    closesForPersonnel: input.closesAttendance
      ? input.closesForPersonnel
      : true,
    dateStart: input.dateStart,
    dateEnd: input.dateEnd || null,
    recurrence: input.recurrence,
    typeId,
    classeIds,
    classeId: classeIds[0] ?? null,
    teachingId: input.teachingId || null,
    titleI18n: toJsonValue(titleI18n),
    descriptionI18n: toJsonValue(descriptionI18n),
    branchId,
    createdBy: input.createdBy || userId,
    schoolYearId,
  };
}

function revalidateCalendarPages(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/settings/calendar`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/attendance/rapports`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/attendance`,
  );
}

function mapEvent(event: {
  id: string;
  title: string | null;
  dateStart: Date;
  dateEnd: Date | null;
  image: string | null;
  allDay: boolean;
  closesAttendance?: boolean;
  closesForStudents?: boolean;
  closesForTeachers?: boolean;
  closesForPersonnel?: boolean;
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
  classeIds?: string[];
  recurrence: Recurrence | null;
  eventType?: { id: string; name: string } | null;
  schoolYear?: ICalendarEvent["schoolYear"] | null;
  teaching?: unknown;
  classe?: { id: string; nameClasse: string; codeClasse: string } | null;
}): ICalendarEvent {
  return {
    id: event.id,
    title: event.title || "",
    dateStart: event.dateStart,
    dateEnd: event.dateEnd || undefined,
    image: toStoredImageFileName(event.image),
    allDay: event.allDay,
    closesAttendance: Boolean(event.closesAttendance),
    closesForStudents: event.closesForStudents !== false,
    closesForTeachers: event.closesForTeachers !== false,
    closesForPersonnel: event.closesForPersonnel !== false,
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
    classeIds:
      event.classeIds && event.classeIds.length > 0
        ? event.classeIds
        : event.classeId
          ? [event.classeId]
          : [],
    recurrence: event.recurrence || Recurrence.HEBDOMADAIRE,
    eventType: event.eventType ?? null,
    schoolYear: event.schoolYear ?? undefined,
    teaching: event.teaching as ICalendarEvent["teaching"],
    classe: event.classe ?? null,
  };
}

async function resolveEventTypeIdForBranch(params: {
  sourceTypeId: string | null | undefined;
  targetBranchId: string;
  sourceBranchId: string;
}): Promise<string | null> {
  const sourceTypeId = params.sourceTypeId?.trim();
  if (!sourceTypeId) return null;

  if (params.targetBranchId === params.sourceBranchId) {
    const same = await prisma.eventType.findFirst({
      where: { id: sourceTypeId, branchId: params.sourceBranchId },
      select: { id: true },
    });
    return same?.id ?? null;
  }

  const sourceType = await prisma.eventType.findFirst({
    where: { id: sourceTypeId, branchId: params.sourceBranchId },
    select: { name: true },
  });
  if (!sourceType?.name) return null;

  const existing = await prisma.eventType.findFirst({
    where: {
      branchId: params.targetBranchId,
      name: { equals: sourceType.name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.eventType.create({
    data: {
      branchId: params.targetBranchId,
      name: sourceType.name,
    },
    select: { id: true },
  });
  return created.id;
}

export const getOrganizationBranchesForCalendarAction = action.handler(
  async () => {
    const { organizationId, branchId } = await requireBranchContext();
    const branches = await prisma.branch.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
    return { currentBranchId: branchId, branches };
  },
);

export const createCalendarEvent = action
  .input(calendarEventSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, userId, organizationId } = await requireBranchContext();

      let targetBranchIds: string[];
      if (input.applyToAllBranches) {
        const orgBranches = await prisma.branch.findMany({
          where: { organizationId, isActive: true },
          select: { id: true },
        });
        targetBranchIds = orgBranches.map((row) => row.id);
      } else if (input.branchIds?.length) {
        const allowed = await prisma.branch.findMany({
          where: {
            organizationId,
            isActive: true,
            id: { in: uniqueIds(input.branchIds) },
          },
          select: { id: true },
        });
        targetBranchIds = allowed.map((row) => row.id);
        if (targetBranchIds.length === 0) {
          throw new Error("Aucune branche valide sélectionnée.");
        }
      } else {
        targetBranchIds = [branchId];
      }

      // Classes / enseignement : uniquement sur la branche courante.
      const singleBranch = targetBranchIds.length === 1 && targetBranchIds[0] === branchId;
      await assertCalendarEventRelationsInBranch(
        {
          ...input,
          classeIds: singleBranch ? input.classeIds : [],
          classeId: singleBranch ? input.classeId : null,
          teachingId: singleBranch ? input.teachingId : null,
          typeId: input.typeId,
        },
        branchId,
      );

      let createdCount = 0;
      for (const targetBranchId of targetBranchIds) {
        const currentSchoolYear = await requireCurrentSchoolYear(targetBranchId);
        const typeId = await resolveEventTypeIdForBranch({
          sourceTypeId: input.typeId,
          targetBranchId,
          sourceBranchId: branchId,
        });

        const branchInput =
          targetBranchId === branchId
            ? input
            : {
                ...input,
                classeIds: [],
                classeId: null,
                teachingId: null,
              };

        await prisma.calendarEvent.create({
          data: buildEventData(
            branchInput,
            targetBranchId,
            userId,
            currentSchoolYear.id,
            typeId,
          ),
        });
        createdCount += 1;
        revalidateCalendarPages(organizationId, targetBranchId);
      }

      return {
        success: true,
        message:
          createdCount > 1
            ? `Événement créé sur ${createdCount} établissements.`
            : "Événement créé avec succès",
        createdCount,
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
        classe: {
          select: {
            id: true,
            nameClasse: true,
            codeClasse: true,
          },
        },
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
        input.typeId || null,
      ),
    });

    revalidateCalendarPages(organizationId, branchId);

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

    revalidateCalendarPages(organizationId, branchId);

    return archived;
  });

/** @deprecated Utiliser archiveCalendarEvent */
export const deleteCalendarEvent = archiveCalendarEvent;

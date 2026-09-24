"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import {
  requireBranchAreaActionContext,
  requireBranchContext,
} from "@/lib/auth/require-branch-context";
import { isAtelierBranchType } from "@/lib/atelier-student-access";
import {
  formatRotationCellLabel,
  mondayOfWeekContaining,
  resolveRotationCours,
} from "@/lib/atelier-rotation";
import { listBranchClosedDayKeys } from "@/lib/branch-closed-days";
import {
  calendarDateKeyInTimezone,
  nowLocal,
} from "@/lib/timezone";
import type { Day } from "@/prisma/generated/prisma/client";

const dayEnum = z.enum([
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
]);

function parseScheduleHour(hour: string) {
  const [h, m] = hour.split(":").map(Number);
  if (
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    throw new Error("Heure invalide");
  }
  return new Date(Date.UTC(2000, 1, 1, h, m));
}

function formatHourHm(hour: Date) {
  return hour.toISOString().slice(11, 16);
}

function teacherNameFrom(teacher: {
  branchMember?: {
    member?: { user?: { name?: string | null } | null } | null;
  } | null;
} | null): string | null {
  return teacher?.branchMember?.member?.user?.name ?? null;
}

function revalidateRotation(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/schedule`,
  );
}

async function requireAtelierWrite(
  areaAction: "create" | "update" | "delete",
) {
  const ctx = await requireBranchAreaActionContext("schedule", areaAction);
  if (!isAtelierBranchType(ctx.typebranch)) {
    throw new Error("Réservé aux branches atelier");
  }
  return ctx;
}

const teacherInclude = {
  branchMember: {
    include: {
      member: { include: { user: { select: { name: true } } } },
    },
  },
} as const;

export const getResolvedRotationSlotsAction = action
  .input(
    z.object({
      classeId: z.string().min(1),
      /** Date ISO de la semaine à afficher (défaut : aujourd’hui). */
      weekDate: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, typebranch } = await requireBranchContext();
    if (!isAtelierBranchType(typebranch)) return [];

    const classe = await prisma.classe.findFirst({
      where: { id: input.classeId, branchId },
      select: { id: true },
    });
    if (!classe) throw new Error("Groupe introuvable");

    const weekDate = input.weekDate
      ? new Date(input.weekDate)
      : nowLocal();
    const weekMonday = mondayOfWeekContaining(weekDate);
    const weekSunday = new Date(weekMonday.getTime() + 6 * 86_400_000);

    const closedKeys = await listBranchClosedDayKeys(
      branchId,
      weekMonday,
      new Date(weekSunday.getTime() + 86_400_000),
      "students",
    );

    const slots = await prisma.rotationSlot.findMany({
      where: { branchId, classeId: input.classeId },
      include: {
        practicalDomain: { select: { id: true, name: true, code: true } },
        room: { select: { id: true, name: true } },
        teacher: { include: teacherInclude },
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            cours: { select: { id: true, nameCours: true } },
            teacher: { include: teacherInclude },
          },
        },
      },
      orderBy: [{ day: "asc" }, { hour: "asc" }],
    });

    const dayIndex: Record<string, number> = {
      Lundi: 0,
      Mardi: 1,
      Mercredi: 2,
      Jeudi: 3,
      Vendredi: 4,
      Samedi: 5,
      Dimanche: 6,
    };

    return slots.map((slot) => {
      const offset = dayIndex[slot.day] ?? 0;
      const slotDate = new Date(weekMonday.getTime() + offset * 86_400_000);
      const dateKey = calendarDateKeyInTimezone(slotDate);

      const defaultTeacherName = teacherNameFrom(slot.teacher);
      const resolved = resolveRotationCours({
        anchorDate: slot.anchorDate,
        date: slotDate,
        isClosed: closedKeys.has(dateKey),
        defaultTeacherId: slot.teacherId,
        defaultTeacherName,
        items: slot.items.map((item) => ({
          coursId: item.coursId,
          nameCours: item.cours.nameCours,
          sortOrder: item.sortOrder,
          teacherId: item.teacherId,
          teacherName: teacherNameFrom(item.teacher),
        })),
      });

      return {
        id: slot.id,
        day: slot.day,
        hour: formatHourHm(slot.hour),
        practicalDomainId: slot.practicalDomainId,
        domainName: slot.practicalDomain.name,
        roomId: slot.roomId,
        roomName: slot.room?.name ?? null,
        teacherId: resolved.teacherId,
        teacherName: resolved.teacherName,
        anchorDate: slot.anchorDate.toISOString().slice(0, 10),
        cycleLength: resolved.cycleLength,
        weekInCycle: resolved.weekInCycle,
        isClosed: resolved.isClosed,
        coursId: resolved.coursId,
        nameCours: resolved.nameCours,
        label: formatRotationCellLabel({
          domainName: slot.practicalDomain.name,
          resolved,
          roomName: slot.room?.name,
        }),
        items: slot.items.map((item) => ({
          coursId: item.coursId,
          nameCours: item.cours.nameCours,
          sortOrder: item.sortOrder,
          teacherId: item.teacherId,
        })),
      };
    });
  });

export const upsertRotationSlotAction = action
  .input(
    z.object({
      id: z.string().optional(),
      classeId: z.string().min(1),
      day: dayEnum,
      hour: z.string().regex(/^\d{2}:\d{2}$/),
      practicalDomainId: z.string().min(1),
      roomId: z.string().nullable().optional(),
      teacherId: z.string().nullable().optional(),
      anchorDate: z.string().min(8),
      items: z
        .array(
          z.object({
            coursId: z.string().min(1),
            sortOrder: z.coerce.number().int().min(0),
            teacherId: z.string().nullable().optional(),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireAtelierWrite(
      input.id ? "update" : "create",
    );

    const classe = await prisma.classe.findFirst({
      where: { id: input.classeId, branchId },
      select: { id: true },
    });
    if (!classe) throw new Error("Groupe introuvable");

    const domain = await prisma.practicalDomain.findFirst({
      where: { id: input.practicalDomainId, branchId },
      select: { id: true },
    });
    if (!domain) throw new Error("Domaine pratique introuvable");

    if (input.roomId) {
      const room = await prisma.room.findFirst({
        where: { id: input.roomId, branchId },
        select: { id: true, practicalDomainId: true },
      });
      if (!room) throw new Error("Salle introuvable");
      if (
        room.practicalDomainId &&
        room.practicalDomainId !== input.practicalDomainId
      ) {
        throw new Error("La salle n'appartient pas à ce domaine");
      }
    }

    const domainCoursIds = new Set(
      (
        await prisma.practicalDomainCours.findMany({
          where: { practicalDomainId: input.practicalDomainId },
          select: { coursId: true },
        })
      ).map((r) => r.coursId),
    );

    for (const item of input.items) {
      if (!domainCoursIds.has(item.coursId)) {
        throw new Error(
          "Chaque cours du cycle doit appartenir au domaine pratique",
        );
      }
    }

    const hour = parseScheduleHour(input.hour);
    const anchorDate = mondayOfWeekContaining(new Date(input.anchorDate));

    if (input.roomId) {
      const roomConflict = await prisma.rotationSlot.findFirst({
        where: {
          branchId,
          roomId: input.roomId,
          day: input.day as Day,
          hour,
          ...(input.id ? { id: { not: input.id } } : {}),
        },
        select: { id: true, classe: { select: { nameClasse: true } } },
      });
      if (roomConflict) {
        throw new Error(
          `Salle déjà occupée à ce créneau (${roomConflict.classe.nameClasse})`,
        );
      }
    }

    const slot = await prisma.$transaction(async (tx) => {
      let slotId = input.id;
      if (slotId) {
        const existing = await tx.rotationSlot.findFirst({
          where: { id: slotId, branchId },
          select: { id: true },
        });
        if (!existing) throw new Error("Créneau introuvable");
        await tx.rotationSlot.update({
          where: { id: slotId },
          data: {
            day: input.day as Day,
            hour,
            practicalDomainId: input.practicalDomainId,
            roomId: input.roomId ?? null,
            teacherId: input.teacherId ?? null,
            anchorDate,
          },
        });
        await tx.rotationSlotItem.deleteMany({
          where: { rotationSlotId: slotId },
        });
      } else {
        const created = await tx.rotationSlot.create({
          data: {
            branchId,
            classeId: input.classeId,
            day: input.day as Day,
            hour,
            practicalDomainId: input.practicalDomainId,
            roomId: input.roomId ?? null,
            teacherId: input.teacherId ?? null,
            anchorDate,
          },
        });
        slotId = created.id;
      }

      await tx.rotationSlotItem.createMany({
        data: input.items.map((item) => ({
          rotationSlotId: slotId!,
          coursId: item.coursId,
          sortOrder: item.sortOrder,
          teacherId: item.teacherId ?? null,
        })),
      });

      return slotId;
    });

    revalidateRotation(organizationId, branchId);
    return { id: slot };
  });

export const deleteRotationSlotAction = action
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireAtelierWrite("delete");
    const existing = await prisma.rotationSlot.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Créneau introuvable");
    await prisma.rotationSlot.delete({ where: { id: input.id } });
    revalidateRotation(organizationId, branchId);
    return { ok: true };
  });

export const getDomainCoursForRotationAction = action
  .input(z.object({ practicalDomainId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, typebranch } = await requireBranchContext();
    if (!isAtelierBranchType(typebranch)) return [];
    const domain = await prisma.practicalDomain.findFirst({
      where: { id: input.practicalDomainId, branchId },
      select: { id: true },
    });
    if (!domain) throw new Error("Domaine introuvable");
    const rows = await prisma.practicalDomainCours.findMany({
      where: { practicalDomainId: input.practicalDomainId },
      orderBy: { sortOrderDefault: "asc" },
      select: {
        coursId: true,
        sortOrderDefault: true,
        cours: { select: { id: true, nameCours: true } },
      },
    });
    return rows.map((r) => ({
      coursId: r.coursId,
      nameCours: r.cours.nameCours,
      sortOrder: r.sortOrderDefault,
    }));
  });

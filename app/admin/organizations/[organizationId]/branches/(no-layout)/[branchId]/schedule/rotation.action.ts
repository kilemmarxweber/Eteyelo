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
  advanceRotationAfterSlotEnded,
  compareSlotsByLivePriority,
  formatRotationCellLabel,
  getLiveSlotPhase,
  mondayOfWeekContaining,
  resolveRotationCours,
  rotationSlotEndHm,
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
    member?: {
      user?: {
        name?: string | null;
        postnom?: string | null;
        prenom?: string | null;
      } | null;
    } | null;
  } | null;
} | null): string | null {
  const user = teacher?.branchMember?.member?.user;
  if (!user) return null;
  const full = [user.name, user.postnom, user.prenom]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || null;
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
      member: {
        include: {
          user: { select: { name: true, postnom: true, prenom: true } },
        },
      },
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
      select: {
        id: true,
        creneau: { select: { durationCourse: true } },
      },
    });
    if (!classe) throw new Error("Groupe introuvable");

    const durationMinutes = classe.creneau?.durationCourse ?? 60;

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

    const now = nowLocal();

    const resolvedRows = slots.map((slot) => {
      const offset = dayIndex[slot.day] ?? 0;
      const slotDate = new Date(weekMonday.getTime() + offset * 86_400_000);
      const dateKey = calendarDateKeyInTimezone(slotDate);
      const hour = formatHourHm(slot.hour);
      const hourEnd = rotationSlotEndHm(hour, durationMinutes);

      const defaultTeacherName = teacherNameFrom(slot.teacher);
      const items = slot.items.map((item) => ({
        coursId: item.coursId,
        nameCours: item.cours.nameCours,
        sortOrder: item.sortOrder,
        teacherId: item.teacherId,
        teacherName: teacherNameFrom(item.teacher),
      }));
      let resolved = resolveRotationCours({
        anchorDate: slot.anchorDate,
        date: slotDate,
        isClosed: closedKeys.has(dateKey),
        defaultTeacherId: slot.teacherId,
        defaultTeacherName,
        items,
      });

      const phase = resolved.isClosed
        ? ("past" as const)
        : getLiveSlotPhase({
            slotDate,
            startHm: hour,
            durationMinutes,
            now,
          });

      // Fin de créneau (ex. après 10h) → activer S2 directement dans l'horaire.
      resolved = advanceRotationAfterSlotEnded({
        resolved,
        items,
        phase,
        defaultTeacherId: slot.teacherId,
        defaultTeacherName,
      });

      return {
        id: slot.id,
        day: slot.day,
        hour,
        hourEnd,
        durationMinutes,
        phase,
        practicalDomainId: slot.practicalDomainId,
        domainName: slot.practicalDomain.name,
        roomId: slot.roomId,
        roomName: slot.room?.name ?? null,
        teacherId: resolved.teacherId,
        teacherName: resolved.teacherName,
        anchorDate: slot.anchorDate.toISOString().slice(0, 10),
        isRotating: resolved.isRotating,
        cycleLength: resolved.cycleLength,
        weekInCycle: resolved.weekInCycle,
        advancedAfterEnd: Boolean(resolved.advancedAfterEnd),
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

    // Cours en cours / suivant devant ; après la fin (ex. 10h) le suivant remonte.
    return resolvedRows.sort((a, b) =>
      compareSlotsByLivePriority(
        { phase: a.phase, startHm: a.hour, day: a.day },
        { phase: b.phase, startHm: b.hour, day: b.day },
        dayIndex,
      ),
    );
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
        .min(1, "Sélectionnez au moins un cours"),
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

    const itemCoursIds = [...new Set(input.items.map((i) => i.coursId))];
    for (const coursId of itemCoursIds) {
      if (!domainCoursIds.has(coursId)) {
        throw new Error(
          "Chaque cours du cycle doit appartenir au domaine pratique",
        );
      }
    }

    const taughtRows = await prisma.teaching.findMany({
      where: {
        classeId: input.classeId,
        coursId: { in: itemCoursIds },
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
        schoolYear: {
          branchId,
          isCurrentYear: true,
          isArchived: false,
        },
      },
      select: { coursId: true },
    });
    const taughtIds = new Set(taughtRows.map((r) => r.coursId));
    for (const coursId of itemCoursIds) {
      if (!taughtIds.has(coursId)) {
        throw new Error(
          "Chaque cours doit être affecté à ce groupe (enseignement année en cours)",
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

/** Options du formulaire rotation (domaines, salles, enseignants, cours du groupe). */
export const getRotationFormOptionsAction = action
  .input(
    z.object({
      /** Si fourni : ne propose que les cours affectés à ce groupe (enseignement année en cours). */
      classeId: z.string().min(1).optional(),
    }).optional(),
  )
  .handler(async ({ input }) => {
    const { branchId, typebranch } = await requireBranchContext();
    if (!isAtelierBranchType(typebranch)) {
      return {
        domains: [],
        rooms: [],
        teachers: [],
        coursesByDomain: {} as Record<
          string,
          Array<{ id: string; nameCours: string; code: string | null }>
        >,
      };
    }

    const classeId = input?.classeId?.trim() || null;
    if (classeId) {
      const classe = await prisma.classe.findFirst({
        where: { id: classeId, branchId },
        select: { id: true },
      });
      if (!classe) throw new Error("Groupe introuvable");
    }

    const assignedCoursIds = new Set<string>();
    if (classeId) {
      const teachings = await prisma.teaching.findMany({
        where: {
          classeId,
          OR: [{ statusTeaching: true }, { statusTeaching: null }],
          schoolYear: {
            branchId,
            isCurrentYear: true,
            isArchived: false,
          },
        },
        select: { coursId: true },
      });
      for (const row of teachings) assignedCoursIds.add(row.coursId);
    }

    const [domains, rooms, teachers, domainCours] = await Promise.all([
      prisma.practicalDomain.findMany({
        where: { branchId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, code: true },
      }),
      prisma.room.findMany({
        where: { branchId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, practicalDomainId: true },
      }),
      prisma.teacher.findMany({
        where: {
          isActive: true,
          branchMember: { branchId, isActive: true },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          branchMember: {
            select: {
              member: {
                select: {
                  user: {
                    select: { name: true, postnom: true, prenom: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.practicalDomainCours.findMany({
        where: {
          practicalDomain: { branchId },
          ...(classeId && assignedCoursIds.size > 0
            ? { coursId: { in: [...assignedCoursIds] } }
            : classeId
              ? { coursId: { in: [] } }
              : {}),
        },
        orderBy: { sortOrderDefault: "asc" },
        select: {
          practicalDomainId: true,
          cours: {
            select: { id: true, nameCours: true, codeCours: true },
          },
        },
      }),
    ]);

    const coursesByDomain: Record<
      string,
      Array<{ id: string; nameCours: string; code: string | null }>
    > = {};
    for (const row of domainCours) {
      if (classeId && !assignedCoursIds.has(row.cours.id)) continue;
      const list = coursesByDomain[row.practicalDomainId] ?? [];
      list.push({
        id: row.cours.id,
        nameCours: row.cours.nameCours,
        code: row.cours.codeCours,
      });
      coursesByDomain[row.practicalDomainId] = list;
    }

    const domainIdsWithCourses = new Set(Object.keys(coursesByDomain));
    const filteredDomains = classeId
      ? domains.filter((d) => domainIdsWithCourses.has(d.id))
      : domains;

    return {
      domains: filteredDomains,
      rooms,
      teachers: teachers.map((t) => {
        const u = t.branchMember?.member?.user;
        const name = [u?.name, u?.postnom, u?.prenom]
          .filter(Boolean)
          .join(" ")
          .trim();
        return { id: t.id, name: name || "Enseignant" };
      }),
      coursesByDomain,
    };
  });

/**
 * Placement depuis la grille horaire atelier :
 * - 1 cours → créneau fixe (Schedule classique)
 * - 2 cours → rotation hebdomadaire sur le même jour/heure
 */
export const placeAtelierScheduleCellAction = action
  .input(
    z.object({
      classeId: z.string().min(1),
      day: dayEnum,
      hour: z.string().regex(/^\d{2}:\d{2}$/),
      coursIds: z
        .array(z.string().min(1))
        .min(1)
        .max(2),
    }),
  )
  .handler(async ({ input }) => {
    const ctx = await requireAtelierWrite("create");
    const { branchId, organizationId } = ctx;

    const uniqueCoursIds = [...new Set(input.coursIds)];
    if (uniqueCoursIds.length !== input.coursIds.length) {
      throw new Error("Choisissez deux cours différents pour la rotation");
    }

    const classe = await prisma.classe.findFirst({
      where: { id: input.classeId, branchId },
      select: { id: true },
    });
    if (!classe) throw new Error("Groupe introuvable");

    const hour = parseScheduleHour(input.hour);

    // ─── 1 cours : horaire classique ─────────────────────────────
    if (uniqueCoursIds.length === 1) {
      const coursId = uniqueCoursIds[0]!;
      const teaching = await prisma.teaching.findFirst({
        where: {
          classeId: input.classeId,
          coursId,
          OR: [{ statusTeaching: true }, { statusTeaching: null }],
          schoolYear: {
            branchId,
            isCurrentYear: true,
            isArchived: false,
          },
        },
        select: { id: true, teacherId: true },
      });
      if (!teaching?.teacherId) {
        throw new Error(
          "Affectez d'abord un enseignant à ce cours dans ce groupe, puis replacez-le.",
        );
      }

      const busyClass = await prisma.schedule.findFirst({
        where: {
          day: input.day as Day,
          hour,
          isArchived: false,
          teaching: { classeId: input.classeId },
        },
        select: { id: true },
      });
      if (busyClass) {
        throw new Error("Cette case est déjà occupée dans l'horaire classique");
      }

      const busyTeacher = await prisma.schedule.findFirst({
        where: {
          day: input.day as Day,
          hour,
          isArchived: false,
          teaching: { teacherId: teaching.teacherId },
        },
        select: { id: true },
      });
      if (busyTeacher) {
        throw new Error(
          "L'enseignant a déjà un cours à cette heure (autre classe)",
        );
      }

      await prisma.schedule.deleteMany({
        where: {
          day: input.day as Day,
          hour,
          teachingId: teaching.id,
          isArchived: true,
        },
      });

      const schedule = await prisma.schedule.create({
        data: {
          day: input.day as Day,
          hour,
          teachingId: teaching.id,
        },
      });
      revalidateRotation(organizationId, branchId);
      return { mode: "fixed" as const, id: schedule.id };
    }

    // ─── 2 cours : rotation ──────────────────────────────────────
    const links = await prisma.practicalDomainCours.findMany({
      where: {
        coursId: { in: uniqueCoursIds },
        practicalDomain: { branchId },
      },
      select: { coursId: true, practicalDomainId: true },
    });

    const domainCounts = new Map<string, number>();
    for (const link of links) {
      domainCounts.set(
        link.practicalDomainId,
        (domainCounts.get(link.practicalDomainId) ?? 0) + 1,
      );
    }
    const sharedDomainId = [...domainCounts.entries()].find(
      ([, count]) => count >= uniqueCoursIds.length,
    )?.[0];
    if (!sharedDomainId) {
      throw new Error(
        "Les deux cours doivent appartenir au même domaine pratique (fiche cours → Domaine pratique).",
      );
    }

    const teachings = await prisma.teaching.findMany({
      where: {
        classeId: input.classeId,
        coursId: { in: uniqueCoursIds },
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
        schoolYear: {
          branchId,
          isCurrentYear: true,
          isArchived: false,
        },
      },
      select: { coursId: true, teacherId: true },
    });
    const taughtIds = new Set(teachings.map((t) => t.coursId));
    for (const coursId of uniqueCoursIds) {
      if (!taughtIds.has(coursId)) {
        throw new Error(
          "Chaque cours doit être affecté à ce groupe (enseignement année en cours)",
        );
      }
    }
    const teacherByCours = new Map(
      teachings
        .filter((t) => t.teacherId)
        .map((t) => [t.coursId, t.teacherId!]),
    );
    const defaultTeacherId =
      teacherByCours.get(uniqueCoursIds[0]!) ??
      teacherByCours.get(uniqueCoursIds[1]!) ??
      null;

    const existing = await prisma.rotationSlot.findFirst({
      where: {
        branchId,
        classeId: input.classeId,
        day: input.day as Day,
        hour,
      },
      select: { id: true },
    });

    const anchorDate = mondayOfWeekContaining(nowLocal());

    const slotId = await prisma.$transaction(async (tx) => {
      let id = existing?.id;
      if (id) {
        await tx.rotationSlot.update({
          where: { id },
          data: {
            practicalDomainId: sharedDomainId,
            teacherId: defaultTeacherId,
            anchorDate,
          },
        });
        await tx.rotationSlotItem.deleteMany({ where: { rotationSlotId: id } });
      } else {
        const created = await tx.rotationSlot.create({
          data: {
            branchId,
            classeId: input.classeId,
            day: input.day as Day,
            hour,
            practicalDomainId: sharedDomainId,
            teacherId: defaultTeacherId,
            anchorDate,
          },
        });
        id = created.id;
      }

      await tx.rotationSlotItem.createMany({
        data: uniqueCoursIds.map((coursId, sortOrder) => ({
          rotationSlotId: id!,
          coursId,
          sortOrder,
          teacherId: teacherByCours.get(coursId) ?? null,
        })),
      });

      return id!;
    });

    revalidateRotation(organizationId, branchId);
    return { mode: "rotation" as const, id: slotId };
  });

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { ISchedule, scheduleSchema } from "@/src/interfaces/Schedule";
import { IOption } from "@/src/interfaces/Option";
import { ICours } from "@/src/interfaces/Cours";
import { ICreneau } from "@/src/interfaces/creneau";
import { IClasse } from "@/src/interfaces/Classe";
import { z } from "zod";

type ScheduleContext = {
  branchId: string;
  organizationId: string;
  userId: string;
  branchMemberId: string | null;
  canCreateSchedules: boolean;
  canUpdateSchedules: boolean;
  canDeleteSchedules: boolean;
};

function revalidateSchedulePages(ctx: ScheduleContext) {
  revalidatePath(
    `/admin/organizations/${ctx.organizationId}/branches/${ctx.branchId}/schedule`,
  );
}

function assertScheduleWriteAccess(
  ctx: ScheduleContext,
  actionName: "CREATE" | "UPDATE" | "DELETE",
) {
  const allowed = {
    CREATE: ctx.canCreateSchedules,
    UPDATE: ctx.canUpdateSchedules,
    DELETE: ctx.canDeleteSchedules,
  }[actionName];

  if (!allowed) {
    throw new Error("Action non autorisee");
  }
}

async function getScheduleContext(): Promise<ScheduleContext> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const branchId = session?.branch?.id ?? session?.session?.activeBranchId;
  const organizationId =
    session?.organization?.id ?? session?.session?.activeOrganizationId;
  const userId = session?.user?.id;

  if (!userId || !branchId || !organizationId) {
    throw new Error("Aucune branche active");
  }

  const branch = await prisma.branch.findFirst({
    where: {
      id: branchId,
      organizationId,
    },
    select: { id: true },
  });

  if (!branch) {
    throw new Error("Branche invalide pour cette organisation");
  }

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId,
      member: {
        userId,
        organizationId,
      },
    },
    select: { id: true, role: true },
  });
  const canManageSchedules = canManageOrganization(session, branchMember?.role);

  return {
    branchId,
    organizationId,
    userId,
    branchMemberId: branchMember?.id ?? null,
    canCreateSchedules: canManageSchedules,
    canUpdateSchedules: canManageSchedules,
    canDeleteSchedules: canManageSchedules,
  };
}

function parseScheduleHour(hour: string) {
  const [heures, minutes] = hour.split(":").map(Number);

  if (
    !Number.isInteger(heures) ||
    !Number.isInteger(minutes) ||
    heures < 0 ||
    heures > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error("Format d'heure invalide");
  }

  return new Date(Date.UTC(2000, 1, 1, heures, minutes));
}

function scopedTeachingWhere(
  ctx: ScheduleContext,
  extra: Record<string, unknown> = {},
) {
  return {
    ...extra,
    OR: [{ branchId: ctx.branchId }, { branchId: null }],
    classe: {
      branchId: ctx.branchId,
      branch: { organizationId: ctx.organizationId },
    },
    cours: {
      branchId: ctx.branchId,
      branch: { organizationId: ctx.organizationId },
    },
    schoolYear: {
      branchId: ctx.branchId,
      isCurrentYear: true,
      branch: { organizationId: ctx.organizationId },
    },
    teacher: {
      branchMember: {
        branchId: ctx.branchId,
        member: { organizationId: ctx.organizationId },
      },
    },
  };
}

async function assertClasseInBranch(ctx: ScheduleContext, classeId: string) {
  const classe = await prisma.classe.findFirst({
    where: {
      id: classeId,
      branchId: ctx.branchId,
      branch: { organizationId: ctx.organizationId },
    },
    select: { id: true },
  });

  if (!classe) {
    throw new Error("Classe introuvable dans cette branche");
  }
}

// CREATE SCHEDULE
export const createScheduleAction = action
  .input(scheduleSchema)
  .handler(async ({ input }) => {
    const { coursId, day, classeId, hour } = input;
    const ctx = await getScheduleContext();
    assertScheduleWriteAccess(ctx, "CREATE");

    if (!coursId) {
      throw new Error("Cours requis pour creer un horaire.");
    }

    await assertClasseInBranch(ctx, classeId);

    const teaching = await prisma.teaching.findFirst({
      where: scopedTeachingWhere(ctx, {
        coursId,
        classeId,
      }),
      select: {
        id: true,
        teacherId: true,
      },
    });

    if (!teaching) {
      throw new Error("Impossible de trouver l'enseignement pour ce cours.");
    }

    const scheduleHour = parseScheduleHour(hour);
    const conflictExists = await prisma.schedule.findFirst({
      where: {
        day,
        hour: scheduleHour,
        teaching: scopedTeachingWhere(ctx, { teacherId: teaching.teacherId }),
      },
      select: { id: true },
    });

    if (conflictExists) {
      throw new Error(
        "Conflit d'horaire detecte : l'enseignant a deja un cours a cette heure.",
      );
    }

    const schedule = await prisma.schedule.create({
      data: {
        hour: scheduleHour,
        teachingId: teaching.id,
        day,
        createdBy: ctx.branchMemberId ?? undefined,
      },
    });
    revalidateSchedulePages(ctx);
    return schedule;
  });

// UPDATE SCHEDULE
export const updateScheduleAction = action
  .input(scheduleSchema)
  .handler(async ({ input }) => {
    const { id, coursId, day, classeId, hour } = input;
    const ctx = await getScheduleContext();
    assertScheduleWriteAccess(ctx, "UPDATE");

    if (!id) {
      throw new Error("Horaire introuvable");
    }

    if (!coursId) {
      throw new Error("Cours requis pour modifier un horaire.");
    }

    await assertClasseInBranch(ctx, classeId);

    const existing = await prisma.schedule.findFirst({
      where: {
        id,
        teaching: scopedTeachingWhere(ctx),
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Horaire introuvable dans cette branche");
    }

    const teaching = await prisma.teaching.findFirst({
      where: scopedTeachingWhere(ctx, {
        coursId,
        classeId,
      }),
      select: {
        id: true,
        teacherId: true,
      },
    });

    if (!teaching) {
      throw new Error("Impossible de trouver l'enseignement pour ce cours.");
    }

    const scheduleHour = parseScheduleHour(hour);
    const conflictExists = await prisma.schedule.findFirst({
      where: {
        id: { not: id },
        day,
        hour: scheduleHour,
        teaching: scopedTeachingWhere(ctx, { teacherId: teaching.teacherId }),
      },
      select: { id: true },
    });

    if (conflictExists) {
      throw new Error(
        "Conflit d'horaire detecte : l'enseignant a deja un cours a cette heure.",
      );
    }

    const schedule = await prisma.schedule.update({
      data: {
        hour: scheduleHour,
        teachingId: teaching.id,
        day,
        ...(ctx.branchMemberId ? { createdBy: ctx.branchMemberId } : {}),
      },
      where: {
        id,
      },
    });
    revalidateSchedulePages(ctx);
    return schedule;
  });

// GET SCHEDULES BY CLASS
export const getSchedulesByClasseAction = action
  .input(
    z.object({
      classeId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ISchedule[]> => {
    const { classeId } = input;
    const ctx = await getScheduleContext();

    await assertClasseInBranch(ctx, classeId);

    const schedules = await prisma.schedule.findMany({
      where: {
        teaching: scopedTeachingWhere(ctx, { classeId }),
      },
      include: {
        teaching: {
          include: {
            classe: true,
            cours: true,
            schoolYear: true,
          },
        },
      },
      orderBy: [{ hour: "asc" }, { day: "asc" }],
    });

    return schedules.map((schedule) => ({
      ...schedule,
      createdBy: schedule.createdBy || "",
      hour: schedule.hour
        ? schedule.hour.toISOString().split("T")[1].slice(0, 5)
        : new Date().toISOString().split("T")[1].slice(0, 5),
      classe: {
        id: schedule.teaching?.classe?.id || "",
        codeClasse: schedule.teaching?.classe?.codeClasse || "",
        nameClasse: schedule.teaching?.classe?.nameClasse || "",
      },
      teacher: undefined,
      cours: {
        id: schedule.teaching?.cours?.id || "",
        codeCours: schedule.teaching?.cours?.codeCours || "",
        nameCours: schedule.teaching?.cours?.nameCours || "",
      },
    }));
  });

export const getSchedulesByTeacherAction = action
  .input(z.object({ teacherId: z.string() }))
  .handler(async ({ input }) => {
    const ctx = await getScheduleContext();
    const schedules = await prisma.schedule.findMany({
      where: {
        teaching: scopedTeachingWhere(ctx, { teacherId: input.teacherId }),
      },
      include: {
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
            classe: true,
            cours: true,
          },
        },
      },
      orderBy: [{ day: "asc" }, { hour: "asc" }],
    });

    return schedules.map((schedule) => {
      const user = schedule.teaching?.teacher?.branchMember?.member?.user;

      return {
        id: schedule.id,
        day: schedule.day,
        hour: schedule.hour ? schedule.hour.toISOString().slice(11, 16) : "",

        classe: {
          id: schedule.teaching?.classe?.id || "",
          codeClasse: schedule.teaching?.classe?.codeClasse || "",
          nameClasse: schedule.teaching?.classe?.nameClasse || "",
        },

        teacher: {
          id: schedule.teaching?.teacher?.id || "",
          nom: user?.name || "",
          postnom: user?.postnom || "",
          prenom: user?.prenom || "",
          email: user?.email || "",
          telephone: user?.telephone || "",
        },

        cours: {
          id: schedule.teaching?.cours?.id || "",
          codeCours: schedule.teaching?.cours?.codeCours || "",
          nameCours: schedule.teaching?.cours?.nameCours || "",
        },
      };
    });
  });

// DELETE SCHEDULE
export const deleteScheduleAction = action
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const ctx = await getScheduleContext();
    assertScheduleWriteAccess(ctx, "DELETE");

    const existing = await prisma.schedule.findFirst({
      where: {
        id: input.id,
        teaching: scopedTeachingWhere(ctx),
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Horaire introuvable dans cette branche");
    }

    const deletedSchedule = await prisma.schedule.delete({
      where: {
        id: input.id,
      },
    });
    revalidateSchedulePages(ctx);
    return deletedSchedule;
  });

export const getScheduleCoursByClasseAction = action
  .input(
    z.object({
      classeId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ICours[]> => {
    const ctx = await getScheduleContext();

    await assertClasseInBranch(ctx, input.classeId);

    const teachings = await prisma.teaching.findMany({
      where: scopedTeachingWhere(ctx, {
        classeId: input.classeId,
      }),
      select: {
        cours: true,
      },
      orderBy: {
        cours: {
          nameCours: "asc",
        },
      },
    });

    return teachings.map((teaching) => ({
      ...teaching.cours,
      id: teaching.cours?.id || "",
      codeCours: teaching.cours?.codeCours || "",
      nameCours: teaching.cours?.nameCours || "",
      description: teaching.cours?.description || "",
      ponderation: 0,
    }));
  });

export const getScheduleCreneauByClasseAction = action
  .input(
    z.object({
      classeId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ICreneau[]> => {
    const ctx = await getScheduleContext();

    const classe = await prisma.classe.findFirst({
      where: {
        id: input.classeId,
        branchId: ctx.branchId,
        branch: { organizationId: ctx.organizationId },
      },
      include: {
        creneau: true,
      },
    });

    if (!classe?.creneau) {
      return [];
    }

    const creneau = classe.creneau;

    return [
      {
        ...creneau,
        id: creneau.id || "",
        nameCreneau: creneau.nameCreneau || "",
        startTime: creneau.startTime
          ? creneau.startTime.toISOString().split("T")[1].slice(0, 5)
          : new Date().toISOString().split("T")[1].slice(0, 5),
        endTime: creneau.endTime
          ? creneau.endTime.toISOString().split("T")[1].slice(0, 5)
          : "",
        recreationDuration: creneau.recreationDuration || 0,
        recreationHour: creneau.recreationHour
          ? creneau.recreationHour.toISOString().split("T")[1].slice(0, 5)
          : "",
        durationCourse: creneau.durationCourse || 0,
        createdAt: creneau.createdAt || new Date(),
        updatedAt: creneau.updatedAt || new Date(),
      },
    ];
  });

export const getScheduleOptionsAction = action.handler(
  async (): Promise<IOption[]> => {
    const ctx = await getScheduleContext();
    const options = await prisma.option.findMany({
      where: {
        branchId: ctx.branchId,
        branch: { organizationId: ctx.organizationId },
      },
      include: {
        section: true,
        classe: {
          where: {
            branchId: ctx.branchId,
            branch: { organizationId: ctx.organizationId },
          },
          orderBy: { nameClasse: "asc" },
        },
      },
      orderBy: { nameOption: "asc" },
    });

    return options.map((option) => ({
      id: option.id,
      nameOption: option.nameOption,
      codeOption: option.codeOption ?? "",
      sectionId: option.sectionId ?? "",
      statusOption: option.statusOption ?? true,
      module: option.section?.codeSection ?? "",
      createdAt: option.createdAt,
      updatedAt: option.updatedAt,
      codeSection: option.section?.codeSection ?? "",
      nameSection: option.section?.nameSection ?? "",
      statuSection: option.section?.statusSection ?? true,
      classes: option.classe.map((classe) => ({
        ...classe,
        optionId: classe.optionId ?? "",
        creneauId: classe.creneauId ?? "",
        statusClasse: classe.statusClasse ?? true,
        nameOption: option.nameOption,
        codeOption: option.codeOption ?? "",
        codeSection: option.section?.codeSection ?? "",
        nameSection: option.section?.nameSection ?? "",
      })),
    }));
  },
);

export const getScheduleClasseByIdAction = action
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<IClasse[]> => {
    const ctx = await getScheduleContext();
    const classes = await prisma.classe.findMany({
      where: {
        id: input.id,
        branchId: ctx.branchId,
        branch: { organizationId: ctx.organizationId },
      },
      include: {
        option: true,
      },
    });

    const tranformedClasses: IClasse[] = classes.map((classe: any) => ({
      ...classe,
      optionId: classe.optionId || "",
      nameOption: classe.option?.nameOption || "",
      codeOption: classe.option?.codeOption || "",
      codeClasse: classe.codeClasse || "",
      nameClasse: classe.nameClasse || "",
      statusClasse: classe.statusClasse ?? true,
      creneauId: classe.creneauId || "",
      option: classe.option
        ? {
            ...classe.option,
            sectionId: classe.option.sectionId || "",
            codeSection: "",
            nameSection: "",
            statusSection: true,
            statusOption: classe.option.statusOption ?? true,
        }
        : undefined,
    }));
    return tranformedClasses;
  });

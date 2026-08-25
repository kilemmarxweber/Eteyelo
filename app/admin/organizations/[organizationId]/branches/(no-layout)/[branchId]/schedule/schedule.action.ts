"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  canManageOrganization,
  canPermanentlyDeleteInformation,
  PERMANENT_DELETE_DENIED_MESSAGE,
} from "@/lib/auth/session-roles";
import { prisma } from "@/lib/prisma";
import { Prisma, type Day } from "@/prisma/generated/prisma/client";
import { action } from "@/lib/zsa";
import { ISchedule, scheduleSchema } from "@/src/interfaces/Schedule";
import { IOption } from "@/src/interfaces/Option";
import { ICours } from "@/src/interfaces/Cours";
import { ICreneau } from "@/src/interfaces/creneau";
import { IClasse } from "@/src/interfaces/Classe";
import { z } from "zod";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import { scheduleHourToMinutes } from "@/lib/timezone";
import {
  CYCLE_SORT_ORDER,
  cycleLabel,
  normalizeCycle,
  type Cycle,
} from "@/lib/cycle";

type ScheduleContext = {
  branchId: string;
  organizationId: string;
  userId: string;
  branchMemberId: string | null;
  teacherId: string | null;
  /** Admin : toutes les classes. Enseignant : uniquement ses affectations. */
  canManageSchedules: boolean;
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
    throw new Error(
      actionName === "DELETE"
        ? PERMANENT_DELETE_DENIED_MESSAGE
        : "Action non autorisee",
    );
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

  const teacher = !canManageSchedules
    ? await prisma.teacher.findFirst({
        where: {
          branchMember: {
            branchId,
            member: { userId, organizationId },
          },
        },
        select: { id: true },
      })
    : null;

  return {
    branchId,
    organizationId,
    userId,
    branchMemberId: branchMember?.id ?? null,
    teacherId: teacher?.id ?? null,
    canManageSchedules,
    canCreateSchedules: canManageSchedules,
    canUpdateSchedules: canManageSchedules,
    canDeleteSchedules: canPermanentlyDeleteInformation(
      session,
      branchMember?.role,
    ),
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

const activeTeachingStatus: Prisma.TeachingWhereInput = {
  OR: [{ statusTeaching: true }, { statusTeaching: null }],
};

function scopedTeachingWhere(
  ctx: ScheduleContext,
  extra: Prisma.TeachingWhereInput = {},
): Prisma.TeachingWhereInput {
  return {
    AND: [
      extra,
      activeTeachingStatus,
      { OR: [{ branchId: ctx.branchId }, { branchId: null }] },
      {
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
          isArchived: false,
          branch: { organizationId: ctx.organizationId },
        },
        teacher: {
          branchMember: {
            branchId: ctx.branchId,
            member: { organizationId: ctx.organizationId },
          },
        },
      },
    ],
  };
}

function formatHourLabel(hour: Date) {
  const minutes = scheduleHourToMinutes(hour);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function findActiveTeachingForSlot(
  ctx: ScheduleContext,
  classeId: string,
  coursId: string,
) {
  return prisma.teaching.findFirst({
    where: scopedTeachingWhere(ctx, { classeId, coursId }),
    select: {
      id: true,
      teacherId: true,
      classeId: true,
      coursId: true,
    },
  });
}

/**
 * Un créneau est libre si :
 * - la classe n'a pas déjà un cours à cette heure ;
 * - l'enseignant n'a pas déjà un cours à cette heure (n'importe quelle classe).
 * Le même cours peut être donné à la même heure dans d'autres classes
 * tant que l'enseignant est différent.
 */
async function assertScheduleSlotAvailable(params: {
  ctx: ScheduleContext;
  classeId: string;
  teacherId: string;
  day: Day;
  hour: Date;
  excludeScheduleId?: string;
}) {
  const { ctx, classeId, teacherId, day, hour, excludeScheduleId } = params;
  const slotMinutes = scheduleHourToMinutes(hour);

  const candidates = await prisma.schedule.findMany({
    where: {
      day,
      isArchived: false,
      ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      teaching: {
        AND: [
          activeTeachingStatus,
          {
            schoolYear: {
              branchId: ctx.branchId,
              isCurrentYear: true,
              isArchived: false,
            },
            classe: { branchId: ctx.branchId },
          },
          {
            OR: [{ teacherId }, { classeId }],
          },
        ],
      },
    },
    select: {
      id: true,
      hour: true,
      teaching: {
        select: {
          teacherId: true,
          classeId: true,
          classe: { select: { nameClasse: true } },
          cours: { select: { nameCours: true } },
        },
      },
    },
  });

  const atThisHour = candidates.filter(
    (row) => scheduleHourToMinutes(row.hour) === slotMinutes,
  );
  const hourLabel = formatHourLabel(hour);

  const classBusy = atThisHour.find(
    (row) => row.teaching?.classeId === classeId,
  );
  if (classBusy) {
    const courseName = classBusy.teaching?.cours?.nameCours;
    throw new Error(
      courseName
        ? `Conflit d'horaire : cette classe a déjà ${courseName} le ${day} à ${hourLabel}.`
        : `Conflit d'horaire : cette classe a déjà un cours le ${day} à ${hourLabel}.`,
    );
  }

  const teacherBusy = atThisHour.find(
    (row) => row.teaching?.teacherId === teacherId,
  );
  if (teacherBusy) {
    const otherClass = teacherBusy.teaching?.classe?.nameClasse ?? "une autre classe";
    const courseName = teacherBusy.teaching?.cours?.nameCours;
    throw new Error(
      courseName
        ? `Conflit d'horaire : l'enseignant a déjà ${courseName} en ${otherClass} le ${day} à ${hourLabel}. Un enseignant ne peut pas donner deux cours à la même heure.`
        : `Conflit d'horaire : l'enseignant a déjà un cours en ${otherClass} le ${day} à ${hourLabel}.`,
    );
  }
}

function teacherAssignmentFilter(ctx: ScheduleContext) {
  if (ctx.canManageSchedules || !ctx.teacherId) return {};
  return {
    teaching: {
      some: {
        teacherId: ctx.teacherId,
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
        AND: [{ OR: [{ branchId: ctx.branchId }, { branchId: null }] }],
      },
    },
  };
}

async function assertClasseInBranch(ctx: ScheduleContext, classeId: string) {
  if (!ctx.canManageSchedules && !ctx.teacherId) {
    throw new Error("Classe introuvable dans cette branche");
  }

  const classe = await prisma.classe.findFirst({
    where: {
      id: classeId,
      branchId: ctx.branchId,
      branch: { organizationId: ctx.organizationId },
      ...teacherAssignmentFilter(ctx),
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

    const teaching = await findActiveTeachingForSlot(ctx, classeId, coursId);

    if (!teaching?.teacherId) {
      throw new Error(
        "Impossible de trouver l'enseignement pour ce cours. Affectez d'abord un enseignant à ce cours dans cette classe.",
      );
    }

    const scheduleHour = parseScheduleHour(hour);

    // Nettoyer d'éventuelles lignes archivées (ancien soft-delete) qui bloquent l'unique.
    await prisma.schedule.deleteMany({
      where: {
        day,
        hour: scheduleHour,
        teachingId: teaching.id,
        isArchived: true,
      },
    });

    await assertScheduleSlotAvailable({
      ctx,
      classeId,
      teacherId: teaching.teacherId,
      day,
      hour: scheduleHour,
    });

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

    const teaching = await findActiveTeachingForSlot(ctx, classeId, coursId);

    if (!teaching?.teacherId) {
      throw new Error(
        "Impossible de trouver l'enseignement pour ce cours. Affectez d'abord un enseignant à ce cours dans cette classe.",
      );
    }

    const scheduleHour = parseScheduleHour(hour);
    await assertScheduleSlotAvailable({
      ctx,
      classeId,
      teacherId: teaching.teacherId,
      day,
      hour: scheduleHour,
      excludeScheduleId: id,
    });

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
        isArchived: false,
        teaching: scopedTeachingWhere(ctx, {
          classeId,
          // Enseignant : uniquement ses créneaux dans la classe.
          ...(ctx.canManageSchedules || !ctx.teacherId
            ? {}
            : { teacherId: ctx.teacherId }),
        }),
      },
      include: {
        teaching: {
          include: {
            classe: true,
            cours: true,
            schoolYear: true,
            teacher: {
              include: {
                branchMember: {
                  include: {
                    member: {
                      include: { user: true },
                    },
                  },
                },
              },
            },
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
      teacher: {
        id: schedule.teaching?.teacher?.id || "",
        nom:
          schedule.teaching?.teacher?.branchMember?.member?.user?.name || "",
        postnom:
          schedule.teaching?.teacher?.branchMember?.member?.user?.postnom || "",
        prenom:
          schedule.teaching?.teacher?.branchMember?.member?.user?.prenom || "",
        telephone:
          schedule.teaching?.teacher?.branchMember?.member?.user?.telephone ||
          "",
        email:
          schedule.teaching?.teacher?.branchMember?.member?.user?.email || "",
      },
      cours: {
        id: schedule.teaching?.cours?.id || "",
        codeCours: schedule.teaching?.cours?.codeCours || "",
        nameCours: schedule.teaching?.cours?.nameCours || "",
      },
    }));
  });

export const getScheduleReportContextAction = action
  .input(z.object({ classeId: z.string() }))
  .handler(async ({ input }) => {
    const ctx = await getScheduleContext();
    await assertClasseInBranch(ctx, input.classeId);

    const classe = await prisma.classe.findFirst({
      where: {
        id: input.classeId,
        branchId: ctx.branchId,
        branch: { organizationId: ctx.organizationId },
      },
      select: {
        id: true,
        nameClasse: true,
        codeClasse: true,
        creneau: { select: { nameCreneau: true } },
        branch: { select: schoolReportBranchSelect },
      },
    });

    if (!classe) throw new Error("Classe introuvable dans cette branche");

    return {
      ...buildSchoolReportContext(classe.branch),
      classeName: classe.nameClasse,
      classeCode: classe.codeClasse,
      creneauName: classe.creneau?.nameCreneau ?? "",
    };
  });

export const getSchedulesByTeacherAction = action
  .input(z.object({ teacherId: z.string() }))
  .handler(async ({ input }) => {
    const ctx = await getScheduleContext();
    const schedules = await prisma.schedule.findMany({
      where: {
        isArchived: false,
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

/** Suppression définitive d'un créneau (pas d'archivage). */
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

    const deleted = await prisma.schedule.delete({
      where: { id: input.id },
    });
    revalidateSchedulePages(ctx);
    return deleted;
  });

/** @deprecated Utiliser deleteScheduleAction (hard delete). */
export const archiveScheduleAction = deleteScheduleAction;

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

    if (!ctx.canManageSchedules && !ctx.teacherId) {
      return [];
    }

    const classes = await prisma.classe.findMany({
      where: {
        branchId: ctx.branchId,
        branch: { organizationId: ctx.organizationId },
        OR: [{ statusClasse: true }, { statusClasse: null }],
        ...teacherAssignmentFilter(ctx),
      },
      include: {
        option: {
          include: { section: true },
        },
      },
      orderBy: { nameClasse: "asc" },
    });

    type Group = {
      id: string;
      nameOption: string;
      nameSection: string;
      codeSection: string;
      cycle: Cycle;
      sort: number;
      classes: IClasse[];
    };
    const groups = new Map<string, Group>();

    for (const classe of classes) {
      const cycle = normalizeCycle(classe.cycle);
      const optionCode = classe.option?.codeOption ?? "";
      const isLevelOption =
        optionCode.startsWith("PRI-") || optionCode.startsWith("MAT-");
      const groupCycle: Cycle =
        cycle === "MATERNELLE" || optionCode.startsWith("MAT-")
          ? "MATERNELLE"
          : cycle === "PRIMAIRE" || optionCode.startsWith("PRI-")
            ? "PRIMAIRE"
            : cycle;

      const groupedByCycle = isLevelOption || groupCycle !== "SECONDAIRE";
      const groupId =
        groupedByCycle && groupCycle !== "SECONDAIRE"
          ? `cycle:${groupCycle}`
          : classe.optionId
            ? `option:${classe.optionId}`
            : `cycle:${groupCycle}`;

      const existing = groups.get(groupId);
      const mappedClasse: IClasse = {
        ...classe,
        optionId: classe.optionId ?? "",
        creneauId: classe.creneauId ?? "",
        statusClasse: classe.statusClasse ?? true,
        cycle: classe.cycle,
        codeClasse: classe.codeClasse ?? "",
        nameClasse: classe.nameClasse ?? "",
        option: classe.option
          ? {
              id: classe.option.id,
              codeOption: classe.option.codeOption,
              nameOption: classe.option.nameOption,
              sectionId: classe.option.sectionId ?? undefined,
              nameSection: classe.option.section?.nameSection,
              codeSection: classe.option.section?.codeSection,
              statuSection: classe.option.section?.statusSection,
              statusOption: classe.option.statusOption ?? true,
              module: "",
              createdAt: classe.option.createdAt,
              updatedAt: classe.option.updatedAt,
            }
          : undefined,
      };

      if (existing) {
        existing.classes.push(mappedClasse);
        continue;
      }

      const nameOption =
        groupedByCycle && groupCycle !== "SECONDAIRE"
          ? cycleLabel(groupCycle)
          : (classe.option?.nameOption ?? cycleLabel(groupCycle));
      groups.set(groupId, {
        id: groupId,
        nameOption,
        nameSection:
          groupedByCycle && groupCycle !== "SECONDAIRE"
            ? cycleLabel(groupCycle)
            : (classe.option?.section?.nameSection ?? ""),
        codeSection:
          groupedByCycle && groupCycle !== "SECONDAIRE"
            ? groupCycle
            : (classe.option?.section?.codeSection ?? ""),
        cycle: groupCycle,
        sort:
          groupCycle === "SECONDAIRE" && classe.optionId
            ? 100 + CYCLE_SORT_ORDER.SECONDAIRE
            : CYCLE_SORT_ORDER[groupCycle],
        classes: [mappedClasse],
      });
    }

    const now = new Date();
    return [...groups.values()]
      .sort((a, b) => a.sort - b.sort || a.nameOption.localeCompare(b.nameOption))
      .map((group) => ({
        id: group.id,
        nameOption: group.nameOption,
        codeOption: group.id,
        sectionId: "",
        statusOption: true,
        module: group.codeSection,
        createdAt: now,
        updatedAt: now,
        codeSection: group.codeSection,
        nameSection: group.nameSection,
        statuSection: true,
        classes: group.classes.map((classe) => ({
          ...classe,
          nameOption: group.nameOption,
          codeOption: group.id,
          codeSection: group.codeSection,
          nameSection: group.nameSection,
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

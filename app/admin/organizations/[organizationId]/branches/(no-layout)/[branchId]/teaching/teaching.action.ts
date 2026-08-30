"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { action } from "@/lib/zsa";
import { Prisma } from "@/prisma/generated/prisma/client";
import { ITeaching, teachingSchema, consecutiveSlotsSchema, teachingWeekdaySchema, type TeachingWeekday } from "@/src/interfaces/Teaching";
import { z } from "zod";
import { canManageOrganization } from "@/lib/auth/session-roles";
import { activeCoursStatusFilter } from "@/lib/active-cours";
import { scheduleHourToMinutes } from "@/lib/timezone";
import {
  configuredCoursIdsForClass,
  getConfiguredCoursIdsForClasse,
} from "@/lib/course-ponderation";
import {
  COURS_KIND,
  expandConfiguredCoursIdsForSchedule,
  syncTeacherForParentComponentGroup,
} from "@/lib/cours-components";
import { syncTeacherDossierExperienceYears } from "@/lib/teacher-assignment-years";
import { cycleLabel, resolveCycle, type Cycle } from "@/lib/cycle";
import {
  buildBranchMemberDirectoryWhere,
  classeCycleWhere,
  isCycleGlobalRole,
  primaryOrgRoleFromSession,
  resolveAccessibleCycles,
  sessionCanViewAllDirectoryUsers,
} from "@/lib/auth/cycle-scope";

const teachingInclude = {
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
  schoolYear: true,
} satisfies Prisma.TeachingInclude;

type TeachingWithRelations = Prisma.TeachingGetPayload<{
  include: typeof teachingInclude;
}>;

function revalidateTeachingPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/teaching`);
}

function requireManageTeaching(session: unknown) {
  if (!canManageOrganization(session as Parameters<typeof canManageOrganization>[0])) {
    throw new Error("Action non autorisée");
  }
}

async function resolveViewerAccessibleCycles(params: {
  branchId: string;
  organizationId: string;
  userId: string;
  session: unknown;
}): Promise<Cycle[]> {
  const [orgMember, branchMember] = await Promise.all([
    prisma.member.findFirst({
      where: {
        userId: params.userId,
        organizationId: params.organizationId,
      },
      select: { role: true },
    }),
    prisma.branchMember.findFirst({
      where: {
        branchId: params.branchId,
        member: {
          userId: params.userId,
          organizationId: params.organizationId,
        },
      },
      select: { id: true },
    }),
  ]);

  return resolveAccessibleCycles({
    branchId: params.branchId,
    branchMemberId: branchMember?.id ?? null,
    orgRole: primaryOrgRoleFromSession(params.session, orgMember?.role),
  });
}

function classeWhereForViewerCycles(
  branchId: string,
  organizationId: string,
  cycles: Cycle[],
) {
  return {
    branchId,
    branch: { organizationId },
    AND: [
      { OR: [{ statusClasse: true }, { statusClasse: null }] },
      cycles.length === 0
        ? { id: "__none__" }
        : classeCycleWhere(cycles),
    ],
  };
}

async function requireConfiguredCoursesForClasse(params: {
  branchId: string;
  organizationId: string;
  classeId: string;
  coursIds: string[];
  accessibleCycles: Cycle[];
}) {
  const classe = await prisma.classe.findFirst({
    where: {
      id: params.classeId,
      ...classeWhereForViewerCycles(
        params.branchId,
        params.organizationId,
        params.accessibleCycles,
      ),
    },
    select: { id: true, optionId: true, level: true },
  });
  if (!classe) throw new Error("Classe introuvable dans cette branche");

  const configuredParents = await getConfiguredCoursIdsForClasse({
    branchId: params.branchId,
    optionId: classe.optionId,
    level: classe.level,
  });
  const configured = new Set(
    await expandConfiguredCoursIdsForSchedule({
      branchId: params.branchId,
      configuredParentIds: configuredParents,
    }),
  );
  // Autoriser aussi le parent bulletin (Teaching notes N1) s'il est pondéré.
  for (const parentId of configuredParents) configured.add(parentId);

  if (!configured.size) {
    throw new Error(
      "Aucun cours pondéré pour cette classe. Configurez d'abord les pondérations.",
    );
  }
  if (params.coursIds.some((coursId) => !configured.has(coursId))) {
    throw new Error(
      "Un ou plusieurs cours n'ont pas de pondération pour cette classe.",
    );
  }

  const activeCourses = await prisma.cours.findMany({
    where: {
      id: { in: params.coursIds },
      branchId: params.branchId,
      ...activeCoursStatusFilter,
    },
    select: { id: true },
  });
  if (activeCourses.length !== new Set(params.coursIds).size) {
    throw new Error("Ce cours est désactivé et ne peut plus être affecté.");
  }

  return classe;
}

export const getTeachingWorkspaceAction = action.handler(async () => {
  const { branchId, organizationId, userId, session } =
    await requireBranchContext();

  const [orgMember, viewerBm] = await Promise.all([
    prisma.member.findFirst({
      where: { userId, organizationId },
      select: { role: true },
    }),
    prisma.branchMember.findFirst({
      where: { branchId, member: { userId, organizationId } },
      select: { id: true },
    }),
  ]);
  const seeAll = sessionCanViewAllDirectoryUsers(session, orgMember?.role);
  const seeWholeBranch = !seeAll && isCycleGlobalRole(orgMember?.role);
  const directoryWhere = await buildBranchMemberDirectoryWhere({
    viewerBranchMemberId: viewerBm?.id ?? null,
    seeAll,
    seeWholeBranch,
  });
  const accessibleCycles = await resolveAccessibleCycles({
    branchId,
    branchMemberId: viewerBm?.id ?? null,
    orgRole: primaryOrgRoleFromSession(session, orgMember?.role),
  });

  const [classes, teachers, schoolYear, ponderations, teachings, branch] =
    await Promise.all([
      prisma.classe.findMany({
        where: classeWhereForViewerCycles(
          branchId,
          organizationId,
          accessibleCycles,
        ),
        orderBy: { nameClasse: "asc" },
        select: {
          id: true,
          nameClasse: true,
          codeClasse: true,
          optionId: true,
          level: true,
          cycle: true,
          option: {
            select: {
              nameOption: true,
              section: { select: { nameSection: true } },
            },
          },
        },
      }),
      prisma.teacher.findMany({
        where: {
          branchMember: {
            AND: [
              {
                branchId,
                branch: { organizationId },
              },
              ...(directoryWhere ? [directoryWhere] : []),
            ],
          },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          branchMember: {
            select: {
              memberCycles: { select: { cycle: true } },
              member: {
                select: {
                  user: {
                    select: {
                      name: true,
                      postnom: true,
                      prenom: true,
                      username: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.schoolYear.findFirst({
        where: {
          branchId,
          branch: { organizationId },
          isCurrentYear: true,
          isArchived: false,
        },
        select: { id: true, nameYear: true },
      }),
      prisma.coursOptionPonderation.findMany({
        where: { branchId },
        select: { coursId: true, optionId: true, level: true },
      }),
      prisma.teaching.findMany({
        where: {
          branchId,
          branch: { organizationId },
          classe: { branchId, branch: { organizationId } },
          cours: {
            branchId,
            branch: { organizationId },
            ...activeCoursStatusFilter,
          },
        },
        select: {
          classeId: true,
          coursId: true,
          schoolYearId: true,
          statusTeaching: true,
        },
      }),
      prisma.branch.findFirst({
        where: { id: branchId, organizationId },
        select: { typebranch: true },
      }),
    ]);

  const assignedByClass = new Map<string, Set<string>>();
  for (const item of teachings) {
    if (item.schoolYearId !== schoolYear?.id || item.statusTeaching === false) {
      continue;
    }
    const current = assignedByClass.get(item.classeId) ?? new Set<string>();
    current.add(item.coursId);
    assignedByClass.set(item.classeId, current);
  }

  // Compter comme la grille d'affectation : postes d'horaire (composants),
  // pas les Teachings parents créés pour les notes (N1).
  const allConfiguredParentIds = [
    ...new Set(
      classes.flatMap((classe) => [
        ...configuredCoursIdsForClass(ponderations, classe),
      ]),
    ),
  ];
  const scheduleComponents =
    allConfiguredParentIds.length > 0
      ? await prisma.cours.findMany({
          where: {
            branchId,
            parentCoursId: { in: allConfiguredParentIds },
            kind: COURS_KIND.SCHEDULE_COMPONENT,
            ...activeCoursStatusFilter,
          },
          select: { id: true, parentCoursId: true },
        })
      : [];
  const scheduleKidsByParent = new Map<string, string[]>();
  for (const row of scheduleComponents) {
    if (!row.parentCoursId) continue;
    const list = scheduleKidsByParent.get(row.parentCoursId) ?? [];
    list.push(row.id);
    scheduleKidsByParent.set(row.parentCoursId, list);
  }
  function scheduleIdsForParents(parentIds: Iterable<string>): Set<string> {
    const ids = new Set<string>();
    for (const parentId of parentIds) {
      const kids = scheduleKidsByParent.get(parentId);
      if (kids?.length) {
        for (const id of kids) ids.add(id);
      } else {
        ids.add(parentId);
      }
    }
    return ids;
  }

  return {
    classes: classes.map((classe) => {
      const configuredIds = scheduleIdsForParents(
        configuredCoursIdsForClass(ponderations, classe),
      );
      const assignedIds = assignedByClass.get(classe.id);
      const assignedCount = assignedIds
        ? [...configuredIds].filter((coursId) => assignedIds.has(coursId))
            .length
        : 0;
      const cycle = resolveCycle(classe, branch);
      return {
        ...classe,
        cycle,
        cycleLabel: cycleLabel(cycle),
        configuredCount: configuredIds.size,
        assignedCount,
      };
    }),
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      cycles: (teacher.branchMember?.memberCycles ?? []).map(
        (row) => row.cycle as Cycle,
      ),
      name:
        [
          teacher.branchMember?.member.user.name,
          teacher.branchMember?.member.user.postnom,
          teacher.branchMember?.member.user.prenom,
        ]
          .filter(Boolean)
          .join(" ") ||
        teacher.branchMember?.member.user.username ||
        "Enseignant",
    })),
    schoolYear,
  };
});

export const getTeachingClassCoursesAction = action
  .input(z.object({ classeId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId, session } =
      await requireBranchContext();
    const accessibleCycles = await resolveViewerAccessibleCycles({
      branchId,
      organizationId,
      userId,
      session,
    });
    const [classe, schoolYear] = await Promise.all([
      prisma.classe.findFirst({
        where: {
          id: input.classeId,
          ...classeWhereForViewerCycles(
            branchId,
            organizationId,
            accessibleCycles,
          ),
        },
        select: { id: true, optionId: true, level: true },
      }),
      prisma.schoolYear.findFirst({
        where: {
          branchId,
          branch: { organizationId },
          isCurrentYear: true,
          isArchived: false,
        },
        select: { id: true },
      }),
    ]);
    if (!classe) throw new Error("Classe introuvable dans cette branche");

    const configuredParentIds = await getConfiguredCoursIdsForClasse({
      branchId,
      optionId: classe.optionId,
      level: classe.level,
    });

    if (!configuredParentIds.length) {
      return { classeId: classe.id, courses: [], teachings: [] };
    }

    const scheduleCoursIds = await expandConfiguredCoursIdsForSchedule({
      branchId,
      configuredParentIds,
    });

    const [courses, teachings] = await Promise.all([
      prisma.cours.findMany({
        where: {
          id: { in: scheduleCoursIds },
          branchId,
          branch: { organizationId },
          ...activeCoursStatusFilter,
        },
        orderBy: [{ sortOrder: "asc" }, { nameCours: "asc" }],
        select: {
          id: true,
          nameCours: true,
          codeCours: true,
          kind: true,
          parentCoursId: true,
          sortOrder: true,
          parentCours: { select: { id: true, nameCours: true } },
        },
      }),
      schoolYear
        ? prisma.teaching.findMany({
            where: {
              branchId,
              branch: { organizationId },
              classeId: classe.id,
              schoolYearId: schoolYear.id,
              coursId: { in: scheduleCoursIds },
            },
            select: {
              id: true,
              classeId: true,
              coursId: true,
              teacherId: true,
              schoolYearId: true,
              statusTeaching: true,
              titulaire: true,
              weeklyHours: true,
              consecutiveSlots: true,
              preferredDays: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      classeId: classe.id,
      courses: courses.map((course) => ({
        id: course.id,
        nameCours: course.nameCours,
        codeCours: course.codeCours,
        kind: course.kind,
        parentCoursId: course.parentCoursId,
        parentNameCours: course.parentCours?.nameCours ?? null,
        sortOrder: course.sortOrder,
      })),
      teachings,
    };
  });

const quickAssignmentSchema = z.object({
  classeId: z.string().min(1),
  coursIds: z.array(z.string().min(1)).min(1).max(200),
  teacherId: z.string().min(1),
  weeklyHours: z.coerce.number().positive().max(600).optional(),
  consecutiveSlots: consecutiveSlotsSchema,
  preferredDays: z.array(teachingWeekdaySchema).optional(),
});

async function assertTeacherMatchesClasseCycle(params: {
  branchId: string;
  organizationId: string;
  classeId: string;
  teacherId: string;
}) {
  const [classe, teacher, branch] = await Promise.all([
    prisma.classe.findFirst({
      where: {
        id: params.classeId,
        branchId: params.branchId,
        branch: { organizationId: params.organizationId },
      },
      select: { cycle: true },
    }),
    prisma.teacher.findFirst({
      where: {
        id: params.teacherId,
        branchMember: {
          branchId: params.branchId,
          branch: { organizationId: params.organizationId },
        },
      },
      select: {
        branchMember: {
          select: { memberCycles: { select: { cycle: true } } },
        },
      },
    }),
    prisma.branch.findFirst({
      where: { id: params.branchId, organizationId: params.organizationId },
      select: { typebranch: true },
    }),
  ]);
  if (!classe || !teacher || !branch) {
    throw new Error("Contexte d'affectation invalide ou incomplet");
  }
  const classCycle = resolveCycle(classe, branch);
  const teacherCycles = (teacher.branchMember?.memberCycles ?? []).map(
    (row) => row.cycle as Cycle,
  );
  // Sans cycles renseignés = legacy (accès complet) jusqu'à restriction explicite.
  if (teacherCycles.length > 0 && !teacherCycles.includes(classCycle)) {
    throw new Error(
      `Cet enseignant n'est pas affecté au cycle ${cycleLabel(classCycle)}. Choisissez un enseignant de ce cycle.`,
    );
  }
}

export const saveQuickAssignmentsAction = action.input(quickAssignmentSchema).handler(async ({ input }) => {
  const { branchId, organizationId, session, userId } = await requireBranchContext();
  requireManageTeaching(session);
  const accessibleCycles = await resolveViewerAccessibleCycles({
    branchId,
    organizationId,
    userId,
    session,
  });
  await requireConfiguredCoursesForClasse({
    branchId,
    organizationId,
    classeId: input.classeId,
    coursIds: input.coursIds,
    accessibleCycles,
  });
  await assertTeacherMatchesClasseCycle({
    branchId,
    organizationId,
    classeId: input.classeId,
    teacherId: input.teacherId,
  });
  const [classe, teacher, courses, schoolYear] = await Promise.all([
    prisma.classe.findFirst({
      where: {
        id: input.classeId,
        ...classeWhereForViewerCycles(branchId, organizationId, accessibleCycles),
      },
      select: { id: true },
    }),
    prisma.teacher.findFirst({ where: { id: input.teacherId, branchMember: { branchId, branch: { organizationId } } }, select: { id: true } }),
    prisma.cours.findMany({ where: { id: { in: input.coursIds }, branchId, branch: { organizationId }, ...activeCoursStatusFilter }, select: { id: true } }),
    prisma.schoolYear.findFirst({ where: { branchId, branch: { organizationId }, isCurrentYear: true, isArchived: false }, select: { id: true } }),
  ]);
  if (!classe || !teacher || !schoolYear || courses.length !== new Set(input.coursIds).size) throw new Error("Contexte d'affectation invalide ou incomplet");

  const existing = await prisma.teaching.findMany({
    where: { classeId: input.classeId, schoolYearId: schoolYear.id, coursId: { in: input.coursIds } },
    select: {
      id: true,
      coursId: true,
      teacherId: true,
      weeklyHours: true,
      consecutiveSlots: true,
      preferredDays: true,
      Schedule: { where: { isArchived: false }, select: { day: true, hour: true } },
    },
  });
  const targetSchedules = await prisma.schedule.findMany({
    where: { isArchived: false, teaching: { teacherId: input.teacherId, schoolYearId: schoolYear.id } },
    select: { day: true, hour: true, teaching: { select: { classe: { select: { nameClasse: true } }, cours: { select: { nameCours: true } } } } },
  });
  for (const item of existing) {
    if (item.teacherId === input.teacherId) continue;
    const conflict = item.Schedule.find((slot) =>
      targetSchedules.some(
        (target) =>
          target.day === slot.day &&
          scheduleHourToMinutes(target.hour) ===
            scheduleHourToMinutes(slot.hour),
      ),
    );
    if (conflict) throw new Error(`Conflit d'horaire détecté le ${conflict.day}. L'enseignant est déjà occupé à cette heure.`);
  }

  const existingMap = new Map(existing.map(item => [item.coursId, item]));
  const weeklyHours =
    input.weeklyHours != null && input.weeklyHours > 0
      ? input.weeklyHours
      : undefined;
  const placementData = {
    ...(weeklyHours != null ? { weeklyHours } : {}),
    ...(input.consecutiveSlots !== undefined
      ? {
          consecutiveSlots:
            input.consecutiveSlots == null || input.consecutiveSlots <= 1
              ? null
              : input.consecutiveSlots,
        }
      : {}),
    ...(input.preferredDays !== undefined
      ? { preferredDays: { set: input.preferredDays } }
      : {}),
  };
  const teachingSelect = {
    id: true,
    classeId: true,
    coursId: true,
    teacherId: true,
    schoolYearId: true,
    statusTeaching: true,
    titulaire: true,
    weeklyHours: true,
    consecutiveSlots: true,
    preferredDays: true,
    updatedAt: true,
  } as const;
  const saved = await prisma.$transaction(input.coursIds.map(coursId => {
    const current = existingMap.get(coursId);
    return current
      ? prisma.teaching.update({
          where: { id: current.id },
          data: {
            teacherId: input.teacherId,
            statusTeaching: true,
            branchId,
            ...placementData,
          },
          select: teachingSelect,
        })
      : prisma.teaching.create({
          data: {
            branchId,
            classeId: input.classeId,
            coursId,
            teacherId: input.teacherId,
            schoolYearId: schoolYear.id,
            statusTeaching: true,
            ...placementData,
          },
          select: teachingSelect,
        });
  }));
  for (const coursId of input.coursIds) {
    await syncTeacherForParentComponentGroup({
      branchId,
      coursId,
      classeId: input.classeId,
      schoolYearId: schoolYear.id,
      teacherId: input.teacherId,
    });
  }
  // Teaching parent pour notes (N1) si le groupe a des postes.
  const componentParents = await prisma.cours.findMany({
    where: {
      id: { in: input.coursIds },
      branchId,
      kind: "SCHEDULE_COMPONENT",
      parentCoursId: { not: null },
    },
    select: { parentCoursId: true },
  });
  const parentIds = [
    ...new Set(
      componentParents
        .map((row) => row.parentCoursId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  for (const parentCoursId of parentIds) {
    await prisma.teaching.upsert({
      where: {
        classeId_schoolYearId_coursId: {
          classeId: input.classeId,
          schoolYearId: schoolYear.id,
          coursId: parentCoursId,
        },
      },
      create: {
        branchId,
        classeId: input.classeId,
        schoolYearId: schoolYear.id,
        coursId: parentCoursId,
        teacherId: input.teacherId,
        statusTeaching: true,
      },
      update: {
        teacherId: input.teacherId,
        statusTeaching: true,
        branchId,
      },
    });
  }
  await syncTeacherDossierExperienceYears({
    teacherId: input.teacherId,
    branchId,
  });
  revalidateTeachingPages(organizationId, branchId);
  return saved;
});

const updatePlacementPrefsSchema = z.object({
  teachingId: z.string().min(1),
  weeklyHours: z.coerce.number().positive().max(600).optional(),
  consecutiveSlots: consecutiveSlotsSchema,
  preferredDays: z.array(teachingWeekdaySchema).optional(),
});

export const updateTeachingWeeklyHoursAction = action
  .input(updatePlacementPrefsSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireManageTeaching(session);

    const teaching = await prisma.teaching.findFirst({
      where: {
        id: input.teachingId,
        branchId,
        branch: { organizationId },
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
      },
      select: { id: true },
    });
    if (!teaching) throw new Error("Affectation introuvable");

    if (
      input.weeklyHours == null &&
      input.consecutiveSlots === undefined &&
      input.preferredDays === undefined
    ) {
      throw new Error("Aucune préférence à enregistrer");
    }

    const updated = await prisma.teaching.update({
      where: { id: teaching.id },
      data: {
        ...(input.weeklyHours != null ? { weeklyHours: input.weeklyHours } : {}),
        ...(input.consecutiveSlots !== undefined
          ? {
              consecutiveSlots:
                input.consecutiveSlots == null || input.consecutiveSlots <= 1
                  ? null
                  : input.consecutiveSlots,
            }
          : {}),
        ...(input.preferredDays !== undefined
          ? { preferredDays: { set: input.preferredDays } }
          : {}),
      },
      select: {
        id: true,
        classeId: true,
        coursId: true,
        teacherId: true,
        schoolYearId: true,
        statusTeaching: true,
        titulaire: true,
        weeklyHours: true,
        consecutiveSlots: true,
        preferredDays: true,
        updatedAt: true,
      },
    });
    revalidateTeachingPages(organizationId, branchId);
    return updated;
  });

const removeAssignmentSchema = z.object({
  classeId: z.string().min(1),
  coursIds: z.array(z.string().min(1)).min(1).max(200),
});

/** Retire l'enseignant des cours sélectionnés (désactive l'affectation pour l'année en cours). */
export const removeQuickAssignmentsAction = action
  .input(removeAssignmentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId } =
      await requireBranchContext();
    requireManageTeaching(session);
    const accessibleCycles = await resolveViewerAccessibleCycles({
      branchId,
      organizationId,
      userId,
      session,
    });

    const schoolYear = await prisma.schoolYear.findFirst({
      where: {
        branchId,
        branch: { organizationId },
        isCurrentYear: true,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!schoolYear) throw new Error("Aucune année scolaire en cours");

    await requireClasseInBranch({
      classeId: input.classeId,
      branchId,
      organizationId,
      accessibleCycles,
    });

    const teachings = await prisma.teaching.findMany({
      where: {
        branchId,
        classeId: input.classeId,
        schoolYearId: schoolYear.id,
        coursId: { in: input.coursIds },
        statusTeaching: { not: false },
      },
      select: { id: true, teacherId: true },
    });

    if (teachings.length === 0) {
      return { removed: 0, ids: [] as string[] };
    }

    await prisma.teaching.updateMany({
      where: { id: { in: teachings.map((t) => t.id) } },
      data: { statusTeaching: false },
    });

    const teacherIds = [
      ...new Set(
        teachings
          .map((item) => item.teacherId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    await Promise.all(
      teacherIds.map((teacherId) =>
        syncTeacherDossierExperienceYears({ teacherId, branchId }),
      ),
    );

    revalidateTeachingPages(organizationId, branchId);
    return { removed: teachings.length, ids: teachings.map((t) => t.id) };
  });

async function requireClasseInBranch(params: {
  classeId: string;
  branchId: string;
  organizationId: string;
  accessibleCycles: Cycle[];
}) {
  const classe = await prisma.classe.findFirst({
    where: {
      id: params.classeId,
      ...classeWhereForViewerCycles(
        params.branchId,
        params.organizationId,
        params.accessibleCycles,
      ),
    },
    select: { id: true },
  });

  if (!classe) {
    throw new Error("Classe introuvable dans cette branche");
  }

  return classe;
}

async function requireTeachingInBranch(id: string, branchId: string) {
  const teaching = await prisma.teaching.findFirst({
    where: {
      id,
      classe: { branchId },
    },
    select: { id: true },
  });

  if (!teaching) {
    throw new Error("Enseignement introuvable dans cette branche");
  }

  return teaching;
}

function mapTeaching(teaching: TeachingWithRelations): ITeaching {
  const branchMember = teaching.teacher?.branchMember;
  const user = branchMember?.member?.user;

  return {
    ...teaching,
    preferredDays: (teaching.preferredDays ?? []) as TeachingWeekday[],
    titulaire: teaching.titulaire || false,
    statusTeaching: teaching.statusTeaching || true,
    //Teacher
    userId: user?.id || "",
    memberId: branchMember?.memberId || "",
    nom: user?.name || "",
    postnom: user?.postnom || "",
    prenom: user?.prenom || "",
    dateOfBirth: user?.dateOfBirth || new Date(),
    sexe: user?.sexe || "",
    email: user?.email || "",
    username: user?.username || "",
    telephone: user?.telephone || "",
    address: user?.address || "",
    statusUser: user?.statusUser || true,

    //SchoolYear
    schoolYearId: teaching.schoolYearId || "",
    isCurrentYear: teaching.schoolYear?.isCurrentYear || false,
    nameYear: teaching.schoolYear?.nameYear || "",
    startYear: teaching.schoolYear?.startYear || new Date(),
    endYear: teaching.schoolYear?.endYear || new Date(),

    //Classe
    branchId: teaching.branchId || "",
    classeId: teaching.classeId || "",
    teacherId: teaching.teacherId || "",
    codeClasse: teaching.classe?.codeClasse || "",
    nameClasse: teaching.classe?.nameClasse || "",
    optionId: teaching.classe?.optionId || "",
    statusClasse: teaching.classe?.statusClasse || true,

    //Cours
    coursId: teaching.coursId || "",
    codeCours: teaching.cours?.codeCours || "",
    nameCours: teaching.cours?.nameCours || "",
    description: teaching.cours?.description || "",
  };
}

export const createTeachingAction = action
  .input(teachingSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId, session } =
      await requireBranchContext();
    const { teacherId, classeId, coursId, schoolYearId, titulaire, weeklyHours, consecutiveSlots, preferredDays } =
      input;
    const accessibleCycles = await resolveViewerAccessibleCycles({
      branchId,
      organizationId,
      userId,
      session,
    });

    await requireConfiguredCoursesForClasse({
      branchId,
      organizationId,
      classeId,
      coursIds: [coursId],
      accessibleCycles,
    });
    await assertTeacherMatchesClasseCycle({
      branchId,
      organizationId,
      classeId,
      teacherId,
    });

    try {
      const teaching = await prisma.teaching.create({
        data: {
          teacherId,
          classeId,
          coursId,
          schoolYearId,
          titulaire,
          weeklyHours,
          consecutiveSlots:
            consecutiveSlots == null || consecutiveSlots <= 1
              ? null
              : consecutiveSlots,
          preferredDays: preferredDays ?? [],
          branchId,
        },
      });

      await syncTeacherDossierExperienceYears({ teacherId, branchId });
      revalidateTeachingPages(organizationId, branchId);
      return teaching;
    } catch (error: any) {
      if (error.code === "P2002") {
        throw new Error(
          "Cet enseignant est déjà assigné à ce cours dans cette classe pour cette année.",
        );
      }

      throw new Error(error.message);
    }
  });

//delete Teaching -> archive
export const archiveTeachingAction = action
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { id } = input;

    if (!id) throw new Error("ID requis");

    await requireTeachingInBranch(id, branchId);

    const archivedTeaching = await prisma.teaching.update({
      where: { id },
      data: { statusTeaching: false },
    });
    await syncTeacherDossierExperienceYears({
      teacherId: archivedTeaching.teacherId,
      branchId,
    });
    revalidateTeachingPages(organizationId, branchId);
    return archivedTeaching;
  });

/** @deprecated Utiliser archiveTeachingAction */
export const deleteTeachingAction = archiveTeachingAction;

export const updateTeachingAction = action
  .input(teachingSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId, session } =
      await requireBranchContext();
    const { id, teacherId, classeId, coursId, schoolYearId, titulaire, weeklyHours, consecutiveSlots, preferredDays } =
      input;

    if (!id) throw new Error("ID requis");

    const accessibleCycles = await resolveViewerAccessibleCycles({
      branchId,
      organizationId,
      userId,
      session,
    });
    await requireTeachingInBranch(id, branchId);
    await requireConfiguredCoursesForClasse({
      branchId,
      organizationId,
      classeId,
      coursIds: [coursId],
      accessibleCycles,
    });
    await assertTeacherMatchesClasseCycle({
      branchId,
      organizationId,
      classeId,
      teacherId,
    });

    const teaching = await prisma.teaching.update({
      data: {
        teacherId,
        classeId,
        coursId,
        schoolYearId,
        titulaire,
        weeklyHours,
        consecutiveSlots:
          consecutiveSlots == null || consecutiveSlots <= 1
            ? null
            : consecutiveSlots,
        preferredDays: preferredDays ?? [],
        branchId,
      },
      where: {
        id,
      },
    });

    await syncTeacherDossierExperienceYears({ teacherId, branchId });
    revalidateTeachingPages(organizationId, branchId);
    return teaching;
  });

export const getTeachingByClassAction = action
  .input(
    z.object({
      classeId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ITeaching[]> => {
    try {
      const { branchId, organizationId, userId, session } =
        await requireBranchContext();
      const { classeId } = input;
      const accessibleCycles = await resolveViewerAccessibleCycles({
        branchId,
        organizationId,
        userId,
        session,
      });

      await requireClasseInBranch({
        classeId,
        branchId,
        organizationId,
        accessibleCycles,
      });

      const teachings = await prisma.teaching.findMany({
        include: teachingInclude,
        where: {
          classeId,
          classe: {
            ...classeWhereForViewerCycles(
              branchId,
              organizationId,
              accessibleCycles,
            ),
          },
          OR: [{ statusTeaching: true }, { statusTeaching: null }],
          cours: {
            branchId,
            ...activeCoursStatusFilter,
          },
        },
      });
      const transformedTeachings: ITeaching[] = teachings.map(mapTeaching);
      return transformedTeachings;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });
export const getTeachingByCoursAction = action
  .input(
    z.object({
      coursId: z.string().optional(),
    }),
  )
  .handler(async ({ input }): Promise<ITeaching[]> => {
    try {
      const { branchId } = await requireBranchContext();
      const { coursId } = input;

      const teachings = await prisma.teaching.findMany({
        include: teachingInclude,
        where: {
          coursId,
          cours: { branchId },
        },
      });
      const transformedTeachings: ITeaching[] = teachings.map(mapTeaching);
      return transformedTeachings;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

export const getTeachings = action.handler(async (): Promise<ITeaching[]> => {
  try {
    const { branchId } = await requireBranchContext();

    const teachings = await prisma.teaching.findMany({
      include: teachingInclude,
      where: {
        OR: [{ branchId }, { classe: { branchId } }],
      },
    });
    const transformedTeachings: ITeaching[] = teachings.map(mapTeaching);
    return transformedTeachings;
  } catch (error: any) {
    throw new Error(error.message);
  }
});

export const getTeachingByTeacherAction = action
  .input(
    z.object({
      teacherId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ITeaching[]> => {
    try {
      const { branchId } = await requireBranchContext();
      const { teacherId } = input;

      const teachings = await prisma.teaching.findMany({
        include: teachingInclude,
        where: {
          teacherId,
          teacher: { branchMember: { branchId } },
        },
      });
      const transformedTeachings: ITeaching[] = teachings.map(mapTeaching);
      return transformedTeachings;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

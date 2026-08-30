"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import {
  classeCreateSchema,
  classeSchema,
  IClasse,
} from "@/src/interfaces/Classe";
import { Prisma } from "@/prisma/generated/prisma/client";
import { z } from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  classeCycleWhere,
  isCycleGlobalRole,
  resolveAccessibleCycles,
} from "@/lib/auth/cycle-scope";
import { getSessionRoles } from "@/lib/auth/session-roles";
import {
  buildClassCode,
  buildClassName,
  isCtebLevel,
  isPrimaryBranch,
  validateClassInput,
} from "@/lib/class-structure";
import {
  getCatalogAbbrevForOptionName,
} from "@/lib/class-catalog";
import {
  ensurePrimaryAcademicStructure,
  getPrimaryOptionForLevel,
} from "@/lib/primary-academic-structure";
import {
  ensureMaternelleAcademicStructure,
  getMaternelleOptionForLevel,
} from "@/lib/maternelle-academic-structure";
import { ensureSecondaryCtebStructure } from "@/lib/secondary-cteb-structure";
import { ensureAngolaSecondaryStructure } from "@/lib/angola-secondary-bootstrap";
import {
  getAngolaHoraireType,
  isAngolaFirstCycleLevel,
  isAngolaSecondarySystem,
} from "@/lib/angola-secondary-structure";
import { ensureAngolaPrimaryStructure } from "@/lib/angola-primary-bootstrap";
import { isAngolaPrimarySystem } from "@/lib/angola-primary-structure";
import {
  ensureUniqueIdentifier,
  generateClassCode,
} from "@/lib/generated-identifiers";
import { upsertClassCatalogForBranch } from "@/lib/class-catalog-sync";
import { normalizeBranchType } from "@/lib/academic-structure";
import {
  isMaternelleCycle,
  normalizeCycle,
  type Cycle,
} from "@/lib/cycle";

function revalidateClassePages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/classe`);
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/schedule`);
}

function resolveActivatedCycle(
  requested: unknown,
  typebranch: unknown,
  cycles: Cycle[],
): Cycle {
  const activated = cycles.length ? cycles : [normalizeCycle(typebranch)];
  if (requested != null && requested !== "") {
    const cycle = normalizeCycle(requested);
    if (!activated.includes(cycle)) {
      throw new Error("Ce cycle n'est pas activé sur cette branche");
    }
    return cycle;
  }
  if (activated.length === 1) return activated[0];
  throw new Error("Veuillez sélectionner un cycle");
}

async function resolveClassIdentity(params: {
  typebranch: unknown;
  educationSystem?: unknown;
  level?: string | null;
  parallel?: string | null;
  optionId?: string | null;
  nameClasse?: string | null;
  branchId: string;
  isLegacy?: boolean;
}) {
  const primary = isPrimaryBranch(params.typebranch);
  const maternelle = isMaternelleCycle(params.typebranch);
  const angola = isAngolaSecondarySystem(
    params.typebranch,
    params.educationSystem,
  );
  const angolaPrimary = isAngolaPrimarySystem(
    params.typebranch,
    params.educationSystem,
  );

  let optionId = params.optionId?.trim() || undefined;
  if (!optionId && !params.isLegacy) {
    if (angola && isAngolaFirstCycleLevel(params.level ?? "")) {
      const angolaStructure = await ensureAngolaSecondaryStructure(
        prisma,
        params.branchId,
      );
      optionId = angolaStructure.option.id;
    } else if (isCtebLevel(params.level ?? "")) {
      const cteb = await ensureSecondaryCtebStructure(prisma, params.branchId);
      optionId = cteb.option.id;
    }
  }

  const validated = validateClassInput({
    typebranch: params.typebranch,
    educationSystem: params.educationSystem,
    level: params.level,
    parallel: params.parallel,
    optionId,
    nameClasse: params.nameClasse,
    isLegacy: params.isLegacy,
  });

  if (params.isLegacy) {
    return {
      nameClasse: validated.nameClasse!,
      codeBase: generateClassCode(validated.nameClasse!),
      level: undefined,
      parallel: validated.parallel ?? null,
      optionId: validated.optionId ?? null,
    };
  }

  let option: {
    id: string;
    nameOption: string;
    codeOption?: string | null;
  } | null = null;

  if (validated.optionId) {
    option = await prisma.option.findFirst({
      where: { id: validated.optionId, branchId: params.branchId },
      select: { id: true, nameOption: true, codeOption: true },
    });
  }

  if (!option && primary) {
    if (angolaPrimary) {
      option = (await ensureAngolaPrimaryStructure(prisma, params.branchId))
        .option;
    } else {
      const primaryStructure = await ensurePrimaryAcademicStructure(
        prisma,
        params.branchId,
      );
      option = getPrimaryOptionForLevel(primaryStructure, validated.level);
    }
    if (!option) {
      throw new Error("Niveau primaire invalide pour la pondération");
    }
  } else if (!option && maternelle) {
    const maternelleStructure = await ensureMaternelleAcademicStructure(
      prisma,
      params.branchId,
    );
    option = getMaternelleOptionForLevel(maternelleStructure, validated.level);
    if (!option) {
      throw new Error("Niveau maternelle invalide pour la pondération");
    }
  } else if (
    !option &&
    angola &&
    isAngolaFirstCycleLevel(validated.level ?? "")
  ) {
    option = (await ensureAngolaSecondaryStructure(prisma, params.branchId))
      .option;
  } else if (!option && isCtebLevel(validated.level ?? "")) {
    option = (await ensureSecondaryCtebStructure(prisma, params.branchId))
      .option;
  }

  if (validated.optionId && !option) {
    throw new Error("Option introuvable dans cette branche");
  }

  const generatedName = buildClassName({
    typebranch: params.typebranch,
    educationSystem: params.educationSystem,
    level: validated.level!,
    parallel: validated.parallel,
    optionName: option?.nameOption,
  });
  const customName = params.nameClasse?.trim();
  const nameClasse = customName || generatedName;
  if (!nameClasse) {
    throw new Error("Veuillez saisir le nom de la classe");
  }

  const codeBase = buildClassCode({
    typebranch: params.typebranch,
    educationSystem: params.educationSystem,
    level: validated.level!,
    parallel: validated.parallel,
    optionName: option?.nameOption,
    optionAbbrev: getCatalogAbbrevForOptionName(option?.nameOption),
  });

  return {
    nameClasse,
    codeBase,
    level: validated.level,
    parallel: validated.parallel ?? null,
    optionId: option?.id ?? null,
  };
}

export const getBranchTypeAction = action.handler(async () => {
  const { typebranch, educationSystem, cycles } = await requireBranchContext();
  return { typebranch, educationSystem, cycles };
});

export const createClasseAction = action
  .input(classeCreateSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, organizationId, typebranch, educationSystem, cycles } =
        await requireBranchContext();
      const { creneauId, capacity } = input;
      const cycle = resolveActivatedCycle(input.cycle, typebranch, cycles);

      const identity = await resolveClassIdentity({
        typebranch: cycle,
        educationSystem,
        level: input.level,
        parallel: input.parallel,
        optionId: input.optionId,
        nameClasse: input.nameClasse,
        branchId,
      });

      const codeClasse = await ensureUniqueIdentifier({
        base: identity.codeBase,
        separator: "",
        exists: async (value) =>
          Boolean(
            await prisma.classe.findFirst({
              where: { branchId, codeClasse: value },
              select: { id: true },
            }),
          ),
      });

      const duplicate = await prisma.classe.findFirst({
        where: { branchId, nameClasse: identity.nameClasse },
        select: { id: true, cycle: true, nameClasse: true },
      });
      if (duplicate) {
        throw new Error(
          duplicate.cycle && duplicate.cycle !== cycle
            ? `Le nom « ${identity.nameClasse} » est déjà utilisé par une classe ${duplicate.cycle.toLowerCase()}.`
            : "La classe existe deja dans cette branche",
        );
      }

      if (creneauId) {
        const creneau = await prisma.creneau.findFirst({
          where: { id: creneauId, branchId },
          select: { id: true },
        });
        if (!creneau) {
          throw new Error("Creneau introuvable dans cette branche");
        }
      }

      const classe = await prisma.classe.create({
        data: {
          nameClasse: identity.nameClasse,
          codeClasse,
          cycle,
          level: identity.level,
          parallel: identity.parallel,
          capacity: capacity ?? null,
          optionId: identity.optionId,
          statusClasse: true,
          creneauId: creneauId || null,
          horaireType: getAngolaHoraireType(identity.level),
          branchId,
        },
      });
      revalidateClassePages(organizationId, branchId);
      return classe;
    } catch (error) {
      const prismaCode =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      if (
        prismaCode === "P2002" ||
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        throw new Error(
          "Une classe avec ce nom ou ce code existe déjà dans cet établissement.",
        );
      }
      throw error;
    }
  });

function transformClasse(classe: any): IClasse {
  const option = classe.option;
  const section = option?.section;
  return {
    ...classe,
    optionId: classe.optionId || option?.id || "",
    nameOption: option?.nameOption || "",
    codeOption: option?.codeOption || "",
    codeClasse: classe?.codeClasse || "",
    nameClasse: classe.nameClasse || "",
    level: classe.level ?? null,
    parallel: classe.parallel ?? null,
    capacity: classe.capacity ?? null,
    statusClasse: classe.statusClasse ?? true,
    creneauId: classe.creneauId || classe.creneau?.id || "",
    nameCreneau: classe.creneau?.nameCreneau || "",
    creneau: classe.creneau
      ? {
          ...classe.creneau,
          nameCreneau: classe.creneau.nameCreneau || "",
          startTime: classe.creneau.startTime
            ? classe.creneau.startTime.toISOString().split("T")[1].slice(0, 5)
            : new Date().toISOString().split("T")[1].slice(0, 5),
          endTime: classe.creneau.endTime
            ? classe.creneau.endTime.toISOString().split("T")[1].slice(0, 5)
            : "",
          durationCourse: classe.creneau.durationCourse,
          recreationDuration: classe.creneau.recreationDuration,
          recreationHour: classe.creneau.recreationHour
            ? classe.creneau.recreationHour
                .toISOString()
                .split("T")[1]
                .slice(0, 5)
            : "",
        }
      : undefined,
    option: option
      ? {
          ...option,
          sectionId: option.sectionId || section?.id || "",
          codeSection: section?.codeSection || option.codeSection || "",
          nameSection: section?.nameSection || option.nameSection || "",
          statusSection: section?.statusSection ?? true,
          statusOption: option.statusOption ?? true,
        }
      : undefined,
    studentsCount: classe._count?.classEnrollment ?? classe.studentsCount ?? 0,
  };
}

export const getClassesAction = action.handler(async (): Promise<IClasse[]> => {
  try {
    const { branchId, userId, session, organizationId } =
      await requireBranchContext();
    const roles = getSessionRoles(session);
    const orgRole =
      [...roles].find((role) => isCycleGlobalRole(role)) ??
      [...roles][0] ??
      null;

    const branchMember = await prisma.branchMember.findFirst({
      where: {
        branchId,
        member: { userId, organizationId },
      },
      select: { id: true },
    });

    const accessible = await resolveAccessibleCycles({
      branchId,
      branchMemberId: branchMember?.id,
      orgRole,
    });

    const classes = await prisma.classe.findMany({
      where: {
        branchId,
        ...classeCycleWhere(accessible),
      },
      include: {
        option: { include: { section: true } },
        creneau: true,
        _count: { select: { classEnrollment: true } },
      },
    });
    return classes.map(transformClasse);
  } catch (error: any) {
    throw new Error(error.message);
  }
});

export const getClassesByIdAction = action
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<IClasse[]> => {
    try {
      const { branchId } = await requireBranchContext();
      const classes = await prisma.classe.findMany({
        include: {
          option: { include: { section: true } },
          creneau: true,
        },
        where: {
          id: input.id,
          branchId,
        },
      });
      return classes.map(transformClasse);
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

export const updateClasseAction = action
  .input(classeSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch, educationSystem, cycles } =
      await requireBranchContext();
    const { id, statusClasse, creneauId, capacity } = input;
    if (!id) throw new Error("Identifiant de classe manquant");

    const existing = await prisma.classe.findFirst({
      where: { id, branchId },
      select: { id: true, level: true, cycle: true, statusClasse: true },
    });
    if (!existing) throw new Error("Classe introuvable dans cette branche");

    const isLegacy = !existing.level && !input.level;
    const cycle = resolveActivatedCycle(
      input.cycle ?? existing.cycle,
      typebranch,
      cycles,
    );

    const identity = await resolveClassIdentity({
      typebranch: cycle,
      educationSystem,
      level: input.level?.trim() || existing.level,
      parallel: input.parallel,
      optionId: input.optionId,
      nameClasse: input.nameClasse,
      branchId,
      isLegacy,
    });

    if (creneauId) {
      const creneau = await prisma.creneau.findFirst({
        where: { id: creneauId, branchId },
        select: { id: true },
      });
      if (!creneau) {
        throw new Error("Creneau introuvable dans cette branche");
      }
    }

    const codeClasse = await ensureUniqueIdentifier({
      base: identity.codeBase,
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.classe.findFirst({
            where: { branchId, codeClasse: value, id: { not: id } },
            select: { id: true },
          }),
        ),
    });

    const duplicate = await prisma.classe.findFirst({
      where: { branchId, nameClasse: identity.nameClasse, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new Error("La classe existe deja dans cette branche");

    const updatedClasse = await prisma.classe.update({
      where: { id },
      data: {
        nameClasse: identity.nameClasse,
        codeClasse,
        cycle,
        level: identity.level ?? null,
        parallel: identity.parallel ?? null,
        capacity: capacity ?? null,
        optionId: identity.optionId,
        statusClasse: statusClasse ?? existing.statusClasse ?? true,
        creneauId: creneauId || null,
        horaireType: getAngolaHoraireType(identity.level),
      },
    });
    revalidateClassePages(organizationId, branchId);
    return updatedClasse;
  });

export const archiveClasseAction = action
  .input(classeSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { id } = input;

    const existClass = await prisma.classe.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existClass) {
      throw new Error("La classe n'existe pas");
    }

    const activeEnrollments = await prisma.classEnrollment.count({
      where: {
        classeId: id,
        branchId,
        statusEnrollment: true,
      },
    });

    if (activeEnrollments > 0) {
      throw new Error(
        "Impossible d'archiver cette classe : des inscriptions actives existent. Annulez-les ou cloturez-les d'abord.",
      );
    }

    const archivedClasse = await prisma.classe.update({
      where: { id },
      data: { statusClasse: false },
    });
    revalidateClassePages(organizationId, branchId);
    return archivedClasse;
  });

/** @deprecated Utiliser archiveClasseAction */
export const deleteClasseAction = archiveClasseAction;

export const deleteClassePermanentlyAction = action
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { id } = input;

    const existClass = await prisma.classe.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existClass) {
      throw new Error("La classe n'existe pas");
    }

    const studentsCount = await prisma.classEnrollment.count({
      where: { classeId: id, branchId },
    });
    if (studentsCount > 0) {
      throw new Error(
        "Impossible de supprimer cette classe : des élèves y sont inscrits.",
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.onlineAssignment.deleteMany({
          where: { classId: id, branchId },
        });

        const teachings = await tx.teaching.findMany({
          where: { classeId: id },
          select: { id: true },
        });
        const teachingIds = teachings.map((teaching) => teaching.id);

        if (teachingIds.length > 0) {
          const sessions = await tx.attendanceSession.findMany({
            where: { teachingId: { in: teachingIds } },
            select: { id: true },
          });
          const sessionIds = sessions.map((session) => session.id);
          if (sessionIds.length > 0) {
            await tx.absenceCase.deleteMany({
              where: { sessionId: { in: sessionIds } },
            });
            await tx.studentAttendance.deleteMany({
              where: { sessionId: { in: sessionIds } },
            });
            await tx.teacherAttendance.deleteMany({
              where: { sessionId: { in: sessionIds } },
            });
            await tx.attendanceSession.deleteMany({
              where: { id: { in: sessionIds } },
            });
          }
          await tx.schedule.deleteMany({
            where: { teachingId: { in: teachingIds } },
          });
          await tx.calendarEvent.deleteMany({
            where: { teachingId: { in: teachingIds } },
          });
          await tx.fiche.deleteMany({
            where: { lessonId: { in: teachingIds } },
          });
          await tx.teaching.deleteMany({
            where: { id: { in: teachingIds } },
          });
        }

        await tx.fiche.deleteMany({
          where: { classSectionId: id, branchId },
        });
        await tx.calendarEvent.updateMany({
          where: { classeId: id, branchId },
          data: { classeId: null },
        });

        const frais = await tx.frais.findMany({
          where: { classeId: id, branchId },
          select: { id: true },
        });
        const fraisIds = frais.map((item) => item.id);
        if (fraisIds.length > 0) {
          const payments = await tx.familyPayment.count({
            where: { fraisId: { in: fraisIds } },
          });
          if (payments > 0) {
            throw new Error(
              "Impossible de supprimer cette classe : des paiements y sont liés.",
            );
          }
          await tx.frais.deleteMany({ where: { id: { in: fraisIds } } });
        }

        await tx.classe.delete({ where: { id } });
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Impossible")) {
        throw error;
      }
      const prismaCode =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      if (prismaCode === "P2003" || prismaCode === "P2014") {
        throw new Error(
          "Impossible de supprimer cette classe : des données y sont encore liées.",
        );
      }
      throw error;
    }

    revalidateClassePages(organizationId, branchId);
    return { ok: true as const };
  });

export const statusClasseAction = action
  .input(
    z.object({
      id: z.string().min(1),
      statusClasse: z.boolean(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { statusClasse, id } = input;
    const existing = await prisma.classe.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Classe introuvable dans cette branche");

    if (!statusClasse) {
      const activeEnrollments = await prisma.classEnrollment.count({
        where: {
          classeId: id,
          branchId,
          statusEnrollment: true,
        },
      });
      if (activeEnrollments > 0) {
        throw new Error(
          "Impossible de désactiver cette classe : des inscriptions actives existent.",
        );
      }
    }

    const updateStatusClasse = await prisma.classe.update({
      where: { id },
      data: { statusClasse },
    });
    revalidateClassePages(organizationId, branchId);
    return updateStatusClasse;
  });

/**
 * Importe le catalogue de classes pour la branche courante.
 * Congolais : 1è-PR … 6è-PR, CTEB 7è/8è, Humanités.
 * Angolais : 1ª–4ª (Geral), 7ª–8ª núcleo, 9ª–13ª Técnica/Electricidade.
 */
export async function importClassCatalogAction(params?: {
  importSectionsAndOptions?: boolean;
}) {
  const { branchId, organizationId, typebranch } =
    await requireBranchContext();

  const result = await upsertClassCatalogForBranch(branchId, {
    importSectionsAndOptions:
      params?.importSectionsAndOptions ??
      normalizeBranchType(typebranch) === "SECONDAIRE",
  });

  revalidateClassePages(organizationId, branchId);
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/section`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/option`,
  );

  return {
    success: true as const,
    ...result,
    typebranch: normalizeBranchType(typebranch),
  };
}

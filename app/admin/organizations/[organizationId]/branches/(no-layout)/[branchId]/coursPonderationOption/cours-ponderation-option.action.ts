"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  requireBranchAreaActionContext,
  requireBranchAreaWriteContext,
  requireBranchContext,
} from "@/lib/auth/require-branch-context";
import { action } from "@/lib/zsa";
import { z } from "zod";
import { coursOptionPonderationSchema, mergeCoursOptionPonderationSchema } from "./schema";
import {
  maternelleOptionDisplayName,
  resolveMaternelleClassLevel,
} from "@/lib/maternelle-academic-structure";
import {
  isPrimaryClassLevel,
  resolvePrimaryClassLevel,
} from "@/lib/primary-academic-structure";
import { type Cycle } from "@/lib/cycle";
import { compareClassesByLevel } from "@/lib/class-structure";
import { DEFAULT_PONDERATION_LEVEL, normalizePonderationLevel } from "@/lib/course-ponderation";
import {
  primaryOrgRoleFromSession,
  resolveAccessibleCycles,
} from "@/lib/auth/cycle-scope";
import { activeCoursStatusFilter } from "@/lib/active-cours";
import { gradeableCoursFilter } from "@/lib/cours-components";

async function requireCoursAndOptionInBranch(params: {
  branchId: string;
  coursId: string;
  optionIds: string[];
}) {
  const optionIds = Array.from(new Set(params.optionIds.filter(Boolean)));
  const [cours, options] = await Promise.all([
    prisma.cours.findFirst({
      where: {
        id: params.coursId,
        branchId: params.branchId,
        ...activeCoursStatusFilter,
      },
      select: { id: true, kind: true, parentCoursId: true },
    }),
    optionIds.length
      ? prisma.option.findMany({
          where: { id: { in: optionIds }, branchId: params.branchId },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  if (!cours) throw new Error("Cours introuvable dans cette branche");
  if (cours.kind === "SCHEDULE_COMPONENT" || cours.parentCoursId) {
    throw new Error(
      "Les postes d'horaire ne se pondèrent pas. Pondérez le cours bulletin parent.",
    );
  }
  if (!optionIds.length || options.length !== optionIds.length) {
    throw new Error("Option introuvable dans cette branche");
  }
}

async function requireOptionsInBranch(branchId: string, optionIds: string[]) {
  const unique = Array.from(new Set(optionIds.filter(Boolean)));
  if (!unique.length) throw new Error("Option introuvable dans cette branche");
  const options = await prisma.option.findMany({
    where: { id: { in: unique }, branchId },
    select: { id: true, cycle: true },
  });
  if (options.length !== unique.length) {
    throw new Error("Option introuvable dans cette branche");
  }
  return options;
}

function revalidateCoursPonderationOptionPages(
  organizationId: string,
  branchId: string,
) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/coursPonderationOption`,
  );
}

const PONDERATION_CYCLES = [
  "MATERNELLE",
  "PRIMAIRE",
  "SECONDAIRE",
] as const satisfies readonly Cycle[];

async function resolveViewerPonderationCycles(params: {
  branchId: string;
  organizationId: string;
  userId: string;
  session: unknown;
  branchCycles: Cycle[];
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

  const accessible = await resolveAccessibleCycles({
    branchId: params.branchId,
    branchMemberId: branchMember?.id ?? null,
    orgRole: primaryOrgRoleFromSession(params.session, orgMember?.role),
  });

  return params.branchCycles.filter(
    (cycle): cycle is Cycle =>
      (PONDERATION_CYCLES as readonly string[]).includes(cycle) &&
      accessible.includes(cycle),
  );
}

async function assertViewerCanEditOptionCycles(params: {
  branchId: string;
  organizationId: string;
  userId: string;
  session: unknown;
  branchCycles: Cycle[];
  optionIds: string[];
}) {
  const options = await requireOptionsInBranch(
    params.branchId,
    params.optionIds,
  );
  const accessible = await resolveViewerPonderationCycles({
    branchId: params.branchId,
    organizationId: params.organizationId,
    userId: params.userId,
    session: params.session,
    branchCycles: params.branchCycles,
  });

  for (const option of options) {
    if (
      !option.cycle ||
      !(PONDERATION_CYCLES as readonly string[]).includes(option.cycle)
    ) {
      continue;
    }
    if (!accessible.includes(option.cycle as Cycle)) {
      throw new Error(
        "Vous n'avez pas accès à la pondération de ce cycle.",
      );
    }
  }
}

export const getCoursPonderationOptionPageDataAction = action.handler(
  async () => {
    const { branchId, cycles, educationSystem, organizationId, userId, session } =
      await requireBranchContext();
    const activated = await resolveViewerPonderationCycles({
      branchId,
      organizationId,
      userId,
      session,
      branchCycles: cycles,
    });

    const [options, cours, ponderations, schoolYear] = await Promise.all([
      prisma.option.findMany({
        where: {
          branchId,
          statusOption: true,
        },
        orderBy: { nameOption: "asc" },
        select: {
          id: true,
          nameOption: true,
          codeOption: true,
          statusOption: true,
          cycle: true,
          section: { select: { id: true, nameSection: true } },
          classe: {
            where: {
              OR: [{ statusClasse: true }, { statusClasse: null }],
            },
            select: { id: true, nameClasse: true, level: true },
            orderBy: { nameClasse: "asc" },
          },
        },
      }),
      prisma.cours.findMany({
        where: { branchId, ...activeCoursStatusFilter, ...gradeableCoursFilter },
        orderBy: { nameCours: "asc" },
        select: { id: true, nameCours: true, codeCours: true, statusCours: true },
      }),
      prisma.coursOptionPonderation.findMany({
        where: { branchId },
        select: {
          id: true,
          coursId: true,
          optionId: true,
          level: true,
          ponderation: true,
          updatedAt: true,
        },
      }),
      prisma.schoolYear.findFirst({
        where: { branchId, isCurrentYear: true, isArchived: false },
        select: { id: true, nameYear: true },
      }),
    ]);

    type OptionRow = (typeof options)[number];
    type TaggedOption = OptionRow & {
      cycle: Cycle;
      displayName: string;
      isLevelWeighted: boolean;
    };

    const levelWeightedIds = new Set<string>();

    const maternelleOptions: TaggedOption[] = activated.includes("MATERNELLE")
      ? options
          .filter(
            (option) =>
              option.cycle === "MATERNELLE" ||
              option.section?.nameSection?.toUpperCase() === "MATERNELLE",
          )
          .map((row) => {
            const level = resolveMaternelleClassLevel({
              level: row.nameOption,
              nameClasse: `${row.nameOption} ${row.codeOption}`,
            });
            levelWeightedIds.add(row.id);
            return {
              ...row,
              cycle: "MATERNELLE" as const,
              displayName: level
                ? maternelleOptionDisplayName(level)
                : row.nameOption,
              isLevelWeighted: true,
            };
          })
      : [];

    const primaryOptions: TaggedOption[] = activated.includes("PRIMAIRE")
      ? options
          .filter(
            (option) =>
              option.cycle === "PRIMAIRE" ||
              option.section?.nameSection?.toUpperCase() === "PRIMAIRE",
          )
          .map((row) => {
            const level = isPrimaryClassLevel(row.nameOption)
              ? row.nameOption
              : resolvePrimaryClassLevel({
                  level: row.nameOption,
                  nameClasse: row.codeOption,
                });
            levelWeightedIds.add(row.id);
            return {
              ...row,
              cycle: "PRIMAIRE" as const,
              displayName: level ? `${level} année` : row.nameOption,
              isLevelWeighted: true,
            };
          })
      : [];

    const secondaryOptions: TaggedOption[] = activated.includes("SECONDAIRE")
      ? options
          .filter((option) => {
            if (levelWeightedIds.has(option.id)) return false;
            if (option.cycle === "MATERNELLE" || option.cycle === "PRIMAIRE") {
              return false;
            }
            return true;
          })
          .map((option) => ({
            ...option,
            cycle: "SECONDAIRE" as const,
            displayName: option.nameOption,
            isLevelWeighted: false,
          }))
      : [];

    const orderedOptions = [
      ...maternelleOptions.sort((a, b) =>
        compareClassesByLevel(
          { level: a.nameOption, nameClasse: a.displayName, cycle: a.cycle },
          { level: b.nameOption, nameClasse: b.displayName, cycle: b.cycle },
        ),
      ),
      ...primaryOptions.sort((a, b) =>
        compareClassesByLevel(
          { level: a.nameOption, nameClasse: a.displayName, cycle: a.cycle },
          { level: b.nameOption, nameClasse: b.displayName, cycle: b.cycle },
        ),
      ),
      ...secondaryOptions,
    ];

    const ponderationCycles = activated.filter((cycle) => {
      if (cycle === "MATERNELLE") return maternelleOptions.length > 0;
      if (cycle === "PRIMAIRE") return primaryOptions.length > 0;
      return true;
    });

    return {
      options: orderedOptions,
      cours,
      ponderations,
      cycles: ponderationCycles,
      educationSystem,
      isPrimary: activated.length === 1 && activated[0] === "PRIMAIRE",
      primaryOptionId: orderedOptions[0]?.id ?? null,
      schoolYear,
    };
  },
);

function resolvePonderationOptionIds(input: {
  optionId: string;
  optionIds?: string[];
}): string[] {
  const ids = [input.optionId, ...(input.optionIds ?? [])].filter(Boolean);
  return Array.from(new Set(ids));
}

function resolvePonderationLevels(input: {
  level?: string;
  levels?: string[];
}): string[] {
  if (input.levels?.length) {
    const unique = Array.from(
      new Set(input.levels.map((level) => normalizePonderationLevel(level))),
    );
    return unique.length ? unique : [DEFAULT_PONDERATION_LEVEL];
  }
  return [normalizePonderationLevel(input.level)];
}

export const createCoursOptionPonderationAction = action
  .input(coursOptionPonderationSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId, cycles } =
      await requireBranchAreaActionContext("ponderations", "create");
    const optionIds = resolvePonderationOptionIds(input);
    await requireCoursAndOptionInBranch({
      branchId,
      coursId: input.coursId,
      optionIds,
    });
    await assertViewerCanEditOptionCycles({
      branchId,
      organizationId,
      userId,
      session,
      branchCycles: cycles,
      optionIds,
    });

    const levels = resolvePonderationLevels(input);
    const saved = [];
    for (const optionId of optionIds) {
      for (const level of levels) {
        const existing = await prisma.coursOptionPonderation.findUnique({
          where: {
            branchId_coursId_optionId_level: {
              branchId,
              coursId: input.coursId,
              optionId,
              level,
            },
          },
          select: { id: true },
        });

        if (existing) {
          throw new Error(
            "Cette ponderation existe deja pour ce cours et cette option",
          );
        }

        saved.push(
          await prisma.coursOptionPonderation.create({
            data: {
              branchId,
              coursId: input.coursId,
              optionId,
              level,
              ponderation: input.ponderation,
            },
          }),
        );
      }
    }
    revalidateCoursPonderationOptionPages(organizationId, branchId);
    return saved[0];
  });

export const saveCoursOptionPonderationAction = action
  .input(coursOptionPonderationSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId, cycles } =
      await requireBranchAreaWriteContext("ponderations");
    const optionIds = resolvePonderationOptionIds(input);
    await requireCoursAndOptionInBranch({
      branchId,
      coursId: input.coursId,
      optionIds,
    });
    await assertViewerCanEditOptionCycles({
      branchId,
      organizationId,
      userId,
      session,
      branchCycles: cycles,
      optionIds,
    });

    const levels = resolvePonderationLevels(input);
    const saved = [];
    for (const optionId of optionIds) {
      for (const level of levels) {
        saved.push(
          await prisma.coursOptionPonderation.upsert({
            where: {
              branchId_coursId_optionId_level: {
                branchId,
                coursId: input.coursId,
                optionId,
                level,
              },
            },
            create: {
              branchId,
              coursId: input.coursId,
              optionId,
              level,
              ponderation: input.ponderation,
            },
            update: { ponderation: input.ponderation },
          }),
        );
      }
    }
    revalidateCoursPonderationOptionPages(organizationId, branchId);
    return saved;
  });

export const updateCoursOptionPonderationAction = action
  .input(coursOptionPonderationSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId, cycles } =
      await requireBranchAreaActionContext("ponderations", "update");
    await requireCoursAndOptionInBranch({
      branchId,
      coursId: input.coursId,
      optionIds: [input.optionId],
    });
    await assertViewerCanEditOptionCycles({
      branchId,
      organizationId,
      userId,
      session,
      branchCycles: cycles,
      optionIds: [input.optionId],
    });

    if (!input.id) {
      throw new Error("ID requis pour modifier la ponderation");
    }

    const existing = await prisma.coursOptionPonderation.findFirst({
      where: {
        id: input.id,
        branchId,
        coursId: input.coursId,
        optionId: input.optionId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Ponderation introuvable dans cette branche");
    }

    const ponderation = await prisma.coursOptionPonderation.update({
      where: { id: input.id },
      data: { ponderation: input.ponderation },
    });
    revalidateCoursPonderationOptionPages(organizationId, branchId);
    return ponderation;
  });

export const deleteCoursOptionPonderationAction = action
  .input(
    z.object({
      id: z.string().optional(),
      coursId: z.string().optional(),
      optionId: z.string().optional(),
      optionIds: z.array(z.string()).optional(),
      levels: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId, cycles } =
      await requireBranchAreaActionContext("ponderations", "delete");

    if (input.id) {
      const existing = await prisma.coursOptionPonderation.findFirst({
        where: { id: input.id, branchId },
        select: { id: true, optionId: true },
      });
      if (!existing) {
        throw new Error("Ponderation introuvable dans cette branche");
      }
      await assertViewerCanEditOptionCycles({
        branchId,
        organizationId,
        userId,
        session,
        branchCycles: cycles,
        optionIds: [existing.optionId],
      });

      await prisma.coursOptionPonderation.delete({
        where: { id: input.id },
      });
      revalidateCoursPonderationOptionPages(organizationId, branchId);
      return { ok: true as const };
    }

    if (!input.coursId || (!input.optionId && !input.optionIds?.length)) {
      throw new Error("ID requis");
    }

    const optionIds = resolvePonderationOptionIds({
      optionId: input.optionId ?? "",
      optionIds: input.optionIds,
    });
    await assertViewerCanEditOptionCycles({
      branchId,
      organizationId,
      userId,
      session,
      branchCycles: cycles,
      optionIds,
    });
    const levels = resolvePonderationLevels({ levels: input.levels });
    await prisma.coursOptionPonderation.deleteMany({
      where: {
        branchId,
        coursId: input.coursId,
        optionId: { in: optionIds },
        level: { in: levels },
      },
    });
    revalidateCoursPonderationOptionPages(organizationId, branchId);
    return { ok: true as const };
  });

export const mergeCoursOptionPonderationAction = action
  .input(mergeCoursOptionPonderationSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session, userId, cycles } =
      await requireBranchAreaWriteContext("ponderations");

    const sourceLevel = normalizePonderationLevel(input.sourceLevel);
    const targets = Array.from(
      new Map(
        input.targets
          .map((target) => ({
            optionId: target.optionId,
            level: normalizePonderationLevel(target.level),
          }))
          .filter(
            (target) =>
              target.optionId !== input.sourceOptionId ||
              target.level !== sourceLevel,
          )
          .map((target) => [`${target.optionId}:${target.level}`, target] as const),
      ).values(),
    );

    if (!targets.length) {
      throw new Error("Sélectionnez un niveau non pondéré à fusionner.");
    }

    const optionIds = [
      input.sourceOptionId,
      ...targets.map((target) => target.optionId),
    ];
    await requireOptionsInBranch(branchId, optionIds);
    await assertViewerCanEditOptionCycles({
      branchId,
      organizationId,
      userId,
      session,
      branchCycles: cycles,
      optionIds,
    });

    const sourceRows = await prisma.coursOptionPonderation.findMany({
      where: {
        branchId,
        optionId: input.sourceOptionId,
        level: sourceLevel,
      },
      select: { coursId: true, ponderation: true },
    });

    if (!sourceRows.length) {
      throw new Error("Aucune pondération source à fusionner.");
    }

    const saved = [];
    for (const source of sourceRows) {
      for (const target of targets) {
        saved.push(
          await prisma.coursOptionPonderation.upsert({
            where: {
              branchId_coursId_optionId_level: {
                branchId,
                coursId: source.coursId,
                optionId: target.optionId,
                level: target.level,
              },
            },
            create: {
              branchId,
              coursId: source.coursId,
              optionId: target.optionId,
              level: target.level,
              ponderation: source.ponderation,
            },
            update: { ponderation: source.ponderation },
          }),
        );
      }
    }

    revalidateCoursPonderationOptionPages(organizationId, branchId);
    return saved;
  });




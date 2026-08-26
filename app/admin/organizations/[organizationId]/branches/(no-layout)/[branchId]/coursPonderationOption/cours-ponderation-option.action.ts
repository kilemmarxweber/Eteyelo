"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { action } from "@/lib/zsa";
import { z } from "zod";
import { coursOptionPonderationSchema } from "./schema";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import {
  ensureMaternelleAcademicStructure,
  maternelleOptionDisplayName,
} from "@/lib/maternelle-academic-structure";
import { type Cycle } from "@/lib/cycle";
import { DEFAULT_PONDERATION_LEVEL, normalizePonderationLevel } from "@/lib/course-ponderation";
import {
  canManageOrganization,
  canPermanentlyDeleteInformation,
  PERMANENT_DELETE_DENIED_MESSAGE,
} from "@/lib/auth/session-roles";
import { activeCoursStatusFilter } from "@/lib/active-cours";

function requireManagePermission(session: unknown) {
  if (!canManageOrganization(session as Parameters<typeof canManageOrganization>[0])) {
    throw new Error("Action non autorisée");
  }
}

async function requireCoursAndOptionInBranch(params: {
  branchId: string;
  coursId: string;
  optionId: string;
}) {
  const [cours, option] = await Promise.all([
    prisma.cours.findFirst({
      where: {
        id: params.coursId,
        branchId: params.branchId,
        ...activeCoursStatusFilter,
      },
      select: { id: true },
    }),
    prisma.option.findFirst({
      where: { id: params.optionId, branchId: params.branchId },
      select: { id: true },
    }),
  ]);

  if (!cours) throw new Error("Cours introuvable dans cette branche");
  if (!option) throw new Error("Option introuvable dans cette branche");
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

export const getCoursPonderationOptionPageDataAction = action.handler(
  async () => {
    const { branchId, cycles, educationSystem } = await requireBranchContext();
    const activated = cycles.filter((cycle): cycle is Cycle =>
      (PONDERATION_CYCLES as readonly string[]).includes(cycle),
    );

    const [maternelleStructure, primaryStructure] = await Promise.all([
      activated.includes("MATERNELLE")
        ? ensureMaternelleAcademicStructure(prisma, branchId)
        : null,
      activated.includes("PRIMAIRE")
        ? ensurePrimaryAcademicStructure(prisma, branchId)
        : null,
    ]);

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
            where: { statusClasse: true },
            select: { id: true, nameClasse: true, level: true },
          },
        },
      }),
      prisma.cours.findMany({
        where: { branchId, ...activeCoursStatusFilter },
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

    const byId = new Map(options.map((option) => [option.id, option]));
    const levelWeightedIds = new Set<string>();

    const maternelleOptions: TaggedOption[] = [];
    if (maternelleStructure) {
      for (const levelOption of maternelleStructure.options) {
        const row = byId.get(levelOption.id);
        if (!row) continue;
        levelWeightedIds.add(row.id);
        maternelleOptions.push({
          ...row,
          cycle: "MATERNELLE",
          displayName: maternelleOptionDisplayName(levelOption.level),
          isLevelWeighted: true,
        });
      }
    }

    const primaryOptions: TaggedOption[] = [];
    if (primaryStructure) {
      for (const levelOption of primaryStructure.options) {
        const row = byId.get(levelOption.id);
        if (!row) continue;
        levelWeightedIds.add(row.id);
        primaryOptions.push({
          ...row,
          cycle: "PRIMAIRE",
          displayName: `${levelOption.level} année`,
          isLevelWeighted: true,
        });
      }
    }

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
      ...maternelleOptions,
      ...primaryOptions,
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
    const { branchId, organizationId, session } = await requireBranchContext();
    requireManagePermission(session);
    await requireCoursAndOptionInBranch({
      branchId,
      coursId: input.coursId,
      optionId: input.optionId,
    });

    const levels = resolvePonderationLevels(input);
    const saved = [];
    for (const level of levels) {
      const existing = await prisma.coursOptionPonderation.findUnique({
        where: {
          branchId_coursId_optionId_level: {
            branchId,
            coursId: input.coursId,
            optionId: input.optionId,
            level,
          },
        },
        select: { id: true },
      });

      if (existing) {
        throw new Error(
          level
            ? `Cette pondération existe déjà pour le niveau ${level}.`
            : "Cette ponderation existe deja pour ce cours et cette option",
        );
      }

      saved.push(
        await prisma.coursOptionPonderation.create({
          data: {
            branchId,
            coursId: input.coursId,
            optionId: input.optionId,
            level,
            ponderation: input.ponderation,
          },
        }),
      );
    }
    revalidateCoursPonderationOptionPages(organizationId, branchId);
    return saved[0];
  });

export const saveCoursOptionPonderationAction = action
  .input(coursOptionPonderationSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireManagePermission(session);
    await requireCoursAndOptionInBranch({
      branchId,
      coursId: input.coursId,
      optionId: input.optionId,
    });

    const levels = resolvePonderationLevels(input);
    const saved = [];
    for (const level of levels) {
      saved.push(
        await prisma.coursOptionPonderation.upsert({
          where: {
            branchId_coursId_optionId_level: {
              branchId,
              coursId: input.coursId,
              optionId: input.optionId,
              level,
            },
          },
          create: {
            branchId,
            coursId: input.coursId,
            optionId: input.optionId,
            level,
            ponderation: input.ponderation,
          },
          update: { ponderation: input.ponderation },
        }),
      );
    }
    revalidateCoursPonderationOptionPages(organizationId, branchId);
    return saved;
  });

export const updateCoursOptionPonderationAction = action
  .input(coursOptionPonderationSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireManagePermission(session);
    await requireCoursAndOptionInBranch({
      branchId,
      coursId: input.coursId,
      optionId: input.optionId,
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
      levels: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireManagePermission(session);
    if (!canPermanentlyDeleteInformation(session)) {
      throw new Error(PERMANENT_DELETE_DENIED_MESSAGE);
    }

    if (input.id) {
      const existing = await prisma.coursOptionPonderation.findFirst({
        where: { id: input.id, branchId },
        select: { id: true },
      });
      if (!existing) {
        throw new Error("Ponderation introuvable dans cette branche");
      }

      await prisma.coursOptionPonderation.delete({
        where: { id: input.id },
      });
      revalidateCoursPonderationOptionPages(organizationId, branchId);
      return { ok: true as const };
    }

    if (!input.coursId || !input.optionId) {
      throw new Error("ID requis");
    }

    const levels = resolvePonderationLevels({ levels: input.levels });
    await prisma.coursOptionPonderation.deleteMany({
      where: {
        branchId,
        coursId: input.coursId,
        optionId: input.optionId,
        level: { in: levels },
      },
    });
    revalidateCoursPonderationOptionPages(organizationId, branchId);
    return { ok: true as const };
  });



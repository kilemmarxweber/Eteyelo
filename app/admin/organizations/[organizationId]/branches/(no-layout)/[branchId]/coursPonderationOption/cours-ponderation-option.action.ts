"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { action } from "@/lib/zsa";
import { z } from "zod";
import { coursOptionPonderationSchema } from "./schema";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import { canManageOrganization } from "@/lib/auth/session-roles";
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

export const getCoursPonderationOptionPageDataAction = action.handler(
  async () => {
    const { branchId, typebranch } = await requireBranchContext();
    const primaryStructure =
      typebranch === "PRIMAIRE"
        ? await ensurePrimaryAcademicStructure(prisma, branchId)
        : null;

    const [options, cours, ponderations, schoolYear] = await Promise.all([
      prisma.option.findMany({
        where: {
          branchId,
          statusOption: true,
          ...(primaryStructure
            ? { id: { in: primaryStructure.options.map((o) => o.id) } }
            : {}),
        },
        orderBy: { nameOption: "asc" },
        select: {
          id: true,
          nameOption: true,
          codeOption: true,
          statusOption: true,
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
          ponderation: true,
          updatedAt: true,
        },
      }),
      prisma.schoolYear.findFirst({
        where: { branchId, isCurrentYear: true, isArchived: false },
        select: { id: true, nameYear: true },
      }),
    ]);

    const orderedOptions = primaryStructure
      ? primaryStructure.options
          .map((levelOption) =>
            options.find((option) => option.id === levelOption.id),
          )
          .filter((option): option is (typeof options)[number] => Boolean(option))
      : options;

    return {
      options: orderedOptions,
      cours,
      ponderations,
      isPrimary: typebranch === "PRIMAIRE",
      primaryOptionId: orderedOptions[0]?.id ?? null,
      schoolYear,
    };
  },
);

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

    const existing = await prisma.coursOptionPonderation.findUnique({
      where: {
        branchId_coursId_optionId: {
          branchId,
          coursId: input.coursId,
          optionId: input.optionId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Cette ponderation existe deja pour ce cours et cette option");
    }

    const ponderation = await prisma.coursOptionPonderation.create({
      data: {
        branchId,
        coursId: input.coursId,
        optionId: input.optionId,
        ponderation: input.ponderation,
      },
    });
    revalidateCoursPonderationOptionPages(organizationId, branchId);
    return ponderation;
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
      id: z.string().min(1, "ID requis"),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireManagePermission(session);

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
  });


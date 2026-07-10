"use server";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { action } from "@/lib/zsa";
import { coursOptionPonderationSchema } from "./schema";

async function requireCoursAndOptionInBranch(params: {
  branchId: string;
  coursId: string;
  optionId: string;
}) {
  const [cours, option] = await Promise.all([
    prisma.cours.findFirst({
      where: { id: params.coursId, branchId: params.branchId },
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

export const getCoursPonderationOptionPageDataAction = action.handler(
  async () => {
    const { branchId } = await requireBranchContext();

    const [options, cours, ponderations] = await Promise.all([
      prisma.option.findMany({
        where: { branchId },
        orderBy: { nameOption: "asc" },
        select: { id: true, nameOption: true, codeOption: true },
      }),
      prisma.cours.findMany({
        where: { branchId },
        orderBy: { nameCours: "asc" },
        select: { id: true, nameCours: true, codeCours: true },
      }),
      prisma.coursOptionPonderation.findMany({
        where: { branchId },
        select: {
          id: true,
          coursId: true,
          optionId: true,
          ponderation: true,
        },
      }),
    ]);

    return { options, cours, ponderations };
  },
);

export const createCoursOptionPonderationAction = action
  .input(coursOptionPonderationSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
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

    return prisma.coursOptionPonderation.create({
      data: {
        branchId,
        coursId: input.coursId,
        optionId: input.optionId,
        ponderation: input.ponderation,
      },
    });
  });

export const updateCoursOptionPonderationAction = action
  .input(coursOptionPonderationSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
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

    return prisma.coursOptionPonderation.update({
      where: { id: input.id },
      data: { ponderation: input.ponderation },
    });
  });


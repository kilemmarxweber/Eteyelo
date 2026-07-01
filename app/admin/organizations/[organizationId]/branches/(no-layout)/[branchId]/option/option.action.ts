"use server";

import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { IOption, optionSchema } from "@/src/interfaces/Option";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

/* ================= CREATE OPTION ================= */
export const createOptionAction = action
  .input(optionSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { nameOption, sectionId, codeOption } = input;

    const existOption = await prisma.option.findFirst({
      where: { nameOption, branchId },
    });

    if (existOption) {
      throw new Error("L'option existe déjà");
    }

    if (sectionId) {
      const section = await prisma.section.findFirst({
        where: { id: sectionId, branchId },
        select: { id: true },
      });

      if (!section) {
        throw new Error("Section introuvable dans cette branche");
      }
    }

    const option = await prisma.option.create({
      data: {
        nameOption,
        codeOption: codeOption ?? null,
        sectionId: sectionId ?? null,
        statusOption: true,
        branchId,
      },
    });

    return option;
  });

/* ================= UPDATE OPTION ================= */
export const updateOptionAction = action
  .input(optionSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { id, nameOption, codeOption, sectionId, statusOption } = input;

    if (!id) throw new Error("ID requis");
    const option = await prisma.option.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!option) throw new Error("Option introuvable dans cette branche");

    if (sectionId) {
      const section = await prisma.section.findFirst({
        where: { id: sectionId, branchId },
        select: { id: true },
      });

      if (!section) {
        throw new Error("Section introuvable dans cette branche");
      }
    }

    return prisma.option.update({
      where: { id },
      data: {
        nameOption,
        codeOption: codeOption ?? null,
        sectionId: sectionId ?? null,
        statusOption: statusOption ?? true,
      },
    });
  });

/* ================= DELETE OPTION ================= */
export const deleteOptionAction = action
  .input(optionSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { id } = input;

    if (!id) throw new Error("ID requis");

    const exist = await prisma.option.findFirst({
      where: { id, branchId },
    });

    if (!exist) {
      throw new Error("Option introuvable");
    }

    return prisma.option.delete({
      where: { id },
    });
  });

/* ================= GET OPTIONS ================= */
export const getOptionsAction = action.handler(async (): Promise<IOption[]> => {
  try {
    const { branchId } = await requireBranchContext();
    const options = await prisma.option.findMany({
      where: { branchId },
      include: {
        section: true,
        classe: {
          where: { branchId },
        },
      },
    });

    const transformedOptions: IOption[] = options.map((option) => ({
      id: option.id,
      nameOption: option.nameOption,
      codeOption: option.codeOption ?? "",
      sectionId: option.sectionId ?? "",
      statusOption: option.statusOption ?? true,

      // ⚠️ AJOUT DES CHAMPS MANQUANTS OBLIGATOIRES
      module: option.section?.codeSection ?? "",

      createdAt: option.createdAt,
      updatedAt: option.updatedAt,

      codeSection: option.section?.codeSection ?? "",
      nameSection: option.section?.nameSection ?? "",
      statuSection: option.section?.statusSection ?? true,

      classes: option.classe
        ? option.classe.map((classe) => ({
            id: classe.id,
            nameClasse: classe.nameClasse ?? "",
            optionId: classe.optionId ?? undefined, // ✅ FIX ICI
            codeClasse: classe.codeClasse ?? "",
            createdAt: classe.createdAt,
            updatedAt: classe.updatedAt,

            codeOption: option.codeOption ?? "",
            nameOption: option.nameOption,
            codeSection: option.section?.codeSection ?? "",
            nameSection: option.section?.nameSection ?? "",
            creneauId: classe.creneauId ?? "",
            statusClasse: classe.statusClasse ?? true,
          }))
        : [],
    }));

    return transformedOptions;
  } catch (error: any) {
    throw new Error(error.message);
  }
});

/* ================= STATUS OPTION ================= */
export const statusOptionAction = action
  .input(optionSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { id, statusOption } = input;

    if (!id) throw new Error("ID requis");
    const option = await prisma.option.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!option) throw new Error("Option introuvable dans cette branche");

    return prisma.option.update({
      where: { id },
      data: {
        statusOption: statusOption ?? false,
      },
    });
  });

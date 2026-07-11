"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import { IOption, optionSchema } from "@/src/interfaces/Option";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { assertSecondaryBranchFeatures } from "@/lib/class-structure";
import { z } from "zod";
import {
  ensureUniqueIdentifier,
  generateCode,
} from "@/lib/generated-identifiers";

function revalidateOptionPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/option`);
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/coursPonderationOption`,
  );
}

/* ================= CREATE OPTION ================= */
export const createOptionAction = action
  .input(optionSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } = await requireBranchContext();
    assertSecondaryBranchFeatures(typebranch);
    const { nameOption, sectionId } = input;
    const codeOption = await ensureUniqueIdentifier({
      base: generateCode(nameOption, "OPT", 16),
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.option.findFirst({
            where: { branchId, codeOption: value },
            select: { id: true },
          }),
        ),
    });

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
        codeOption,
        sectionId: sectionId ?? null,
        statusOption: true,
        branchId,
      },
    });

    const cours = await prisma.cours.findMany({
      where: { branchId },
      select: { id: true },
    });

    if (cours.length) {
      await prisma.coursOptionPonderation.createMany({
        data: cours.map((item) => ({
          branchId,
          coursId: item.id,
          optionId: option.id,
          ponderation: 1,
        })),
        skipDuplicates: true,
      });
    }

    revalidateOptionPages(organizationId, branchId);
    return option;
  });

/* ================= UPDATE OPTION ================= */
export const updateOptionAction = action
  .input(optionSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } = await requireBranchContext();
    assertSecondaryBranchFeatures(typebranch);
    const { id, nameOption, sectionId, statusOption } = input;

    if (!id) throw new Error("ID requis");
    const option = await prisma.option.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!option) throw new Error("Option introuvable dans cette branche");
    const codeOption = await ensureUniqueIdentifier({
      base: generateCode(nameOption, "OPT", 16),
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.option.findFirst({
            where: { branchId, codeOption: value, id: { not: id } },
            select: { id: true },
          }),
        ),
    });

    const duplicate = await prisma.option.findFirst({
      where: { branchId, nameOption, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new Error("L'option existe deja dans cette branche");

    if (sectionId) {
      const section = await prisma.section.findFirst({
        where: { id: sectionId, branchId },
        select: { id: true },
      });

      if (!section) {
        throw new Error("Section introuvable dans cette branche");
      }
    }

    const updatedOption = await prisma.option.update({
      where: { id },
      data: {
        nameOption,
        codeOption: codeOption ?? null,
        sectionId: sectionId ?? null,
        statusOption: statusOption ?? true,
      },
    });
    revalidateOptionPages(organizationId, branchId);
    return updatedOption;
  });

/* ================= ARCHIVE OPTION ================= */
export const archiveOptionAction = action
  .input(optionSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { id } = input;

    if (!id) throw new Error("ID requis");

    const exist = await prisma.option.findFirst({
      where: { id, branchId },
    });

    if (!exist) {
      throw new Error("Option introuvable");
    }

    const archivedOption = await prisma.option.update({
      where: { id },
      data: { statusOption: false },
    });
    revalidateOptionPages(organizationId, branchId);
    return archivedOption;
  });

/** @deprecated Utiliser archiveOptionAction */
export const deleteOptionAction = archiveOptionAction;

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
    const { branchId, organizationId } = await requireBranchContext();
    const { id, statusOption } = input;

    if (!id) throw new Error("ID requis");
    const option = await prisma.option.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!option) throw new Error("Option introuvable dans cette branche");

    const updatedOption = await prisma.option.update({
      where: { id },
      data: {
        statusOption: statusOption ?? false,
      },
    });
    revalidateOptionPages(organizationId, branchId);
    return updatedOption;
  });

export const getOptionPonderationsAction = action
  .input(
    z.object({
      optionId: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const [options, cours, ponderations] = await Promise.all([
      prisma.option.findMany({
        where: { branchId, statusOption: true },
        orderBy: { nameOption: "asc" },
        select: { id: true, nameOption: true, codeOption: true },
      }),
      prisma.cours.findMany({
        where: { branchId },
        orderBy: { nameCours: "asc" },
        select: { id: true, nameCours: true, codeCours: true },
      }),
      input.optionId
        ? prisma.coursOptionPonderation.findMany({
            where: { branchId, optionId: input.optionId },
            select: { id: true, coursId: true, optionId: true, ponderation: true },
          })
        : Promise.resolve([]),
    ]);

    return { options, cours, ponderations };
  });

export const upsertOptionPonderationAction = action
  .input(
    z.object({
      optionId: z.string(),
      coursId: z.string(),
      ponderation: z.coerce.number().int().min(0).max(100),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();

    const [option, cours] = await Promise.all([
      prisma.option.findFirst({
        where: { id: input.optionId, branchId },
        select: { id: true },
      }),
      prisma.cours.findFirst({
        where: { id: input.coursId, branchId },
        select: { id: true },
      }),
    ]);

    if (!option) throw new Error("Option introuvable dans cette branche");
    if (!cours) throw new Error("Cours introuvable dans cette branche");

    const ponderation = await prisma.coursOptionPonderation.upsert({
      where: {
        branchId_coursId_optionId: {
          branchId,
          coursId: input.coursId,
          optionId: input.optionId,
        },
      },
      update: {
        ponderation: input.ponderation,
      },
      create: {
        branchId,
        coursId: input.coursId,
        optionId: input.optionId,
        ponderation: input.ponderation,
      },
    });
    revalidateOptionPages(organizationId, branchId);
    return ponderation;
  });

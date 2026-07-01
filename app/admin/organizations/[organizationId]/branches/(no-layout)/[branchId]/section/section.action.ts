"use server";

import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { ISection, sectionSchema } from "@/src/interfaces/Section";
import { Prisma } from "@/prisma/generated/prisma/client";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

export const createSectionAction = action
  .input(sectionSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId } = await requireBranchContext();
      const { nameSection } = input;

      const existSection = await prisma.section.findMany({
        where: {
          nameSection: nameSection,
          branchId,
        },
      });
      if (existSection.length > 0) {
        throw new Error("la section existe déjà");
      }

      const section = await prisma.section.create({
        data: { ...input, statusSection: true, branchId },
      });
      return section;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Vérifier si c'est une erreur P2002 (contrainte d'unicité)
        if (error.code === "P2002") {
          // Gérez l'erreur ici, par exemple en retournant un message d'erreur à l'utilisateur
          throw new Error(`la section existe déjà`);
        }
      } else {
        // Gérer d'autres erreurs ici
        throw error;
      }
    }
  });

//deleteSection
export const deleteSectionAction = action
  .input(sectionSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { id } = input;
    const section = await prisma.section.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!section) throw new Error("Section introuvable dans cette branche");

    const deleteSection = await prisma.section.delete({
      where: {
        id,
      },
    });
    return deleteSection;
  });

export const updateSectionAction = action
  .input(sectionSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { nameSection, id, codeSection } = input;
    const existSection = await prisma.section.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existSection) throw new Error("Section introuvable dans cette branche");

    const section = await prisma.section.update({
      data: {
        nameSection,
        codeSection,
      },
      where: {
        id,
      },
    });
  });

export const getSectionsAction = action.handler(
  async (): Promise<ISection[]> => {
    try {
      const { branchId } = await requireBranchContext();
      const Sections = await prisma.section.findMany({
        where: { branchId },
      });
      return Sections;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },
);

export const statuSectionAction = action
  .input(sectionSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { id, statusSection } = input;
    const section = await prisma.section.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!section) throw new Error("Section introuvable dans cette branche");

    const updateStatuSection = await prisma.section.update({
      where: {
        id,
      },
      data: {
        statusSection,
      },
    });
    return updateStatuSection;
  });

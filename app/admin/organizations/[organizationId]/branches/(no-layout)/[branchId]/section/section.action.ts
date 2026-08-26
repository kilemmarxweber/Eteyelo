"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import { ISection, sectionSchema } from "@/src/interfaces/Section";
import { Prisma } from "@/prisma/generated/prisma/client";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { z } from "zod";
import { assertSectionOptionBranchFeatures, usesSectionOptionForBranch } from "@/lib/branch-capabilities";
import { anyCycle } from "@/lib/cycle";
import {
  ensureUniqueIdentifier,
  generateCode,
} from "@/lib/generated-identifiers";

function revalidateSectionPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/section`);
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/option`);
}

export const createSectionAction = action
  .input(sectionSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, organizationId, typebranch, cycles } = await requireBranchContext();
      if (!anyCycle(cycles, usesSectionOptionForBranch)) {
        assertSectionOptionBranchFeatures(typebranch);
      }
      const { nameSection } = input;
      const codeSection = await ensureUniqueIdentifier({
        base: generateCode(nameSection, "SEC", 16),
        separator: "",
        exists: async (value) =>
          Boolean(
            await prisma.section.findFirst({
              where: { branchId, codeSection: value },
              select: { id: true },
            }),
          ),
      });

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
        data: { ...input, codeSection, statusSection: true, branchId, cycle: "SECONDAIRE" },
      });
      revalidateSectionPages(organizationId, branchId);
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

//archiveSection
export const archiveSectionAction = action
  .input(sectionSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId } = await requireBranchContext();
    const { id } = input;
    const section = await prisma.section.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!section) throw new Error("Section introuvable dans cette branche");

    const archivedSection = await prisma.section.update({
      where: { id },
      data: { statusSection: false },
    });
    revalidateSectionPages(organizationId, branchId);
    return archivedSection;
  });

/** @deprecated Utiliser archiveSectionAction */
export const deleteSectionAction = archiveSectionAction;

export const deleteSectionPermanentlyAction = action
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const section = await prisma.section.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });
    if (!section) throw new Error("Section introuvable dans cette branche");

    const optionsCount = await prisma.option.count({
      where: { sectionId: input.id, branchId },
    });
    if (optionsCount > 0) {
      throw new Error(
        `Impossible de supprimer cette section : ${optionsCount} option${optionsCount > 1 ? "s" : ""} y ${optionsCount > 1 ? "sont encore liées" : "est encore liée"}. Supprimez d'abord ${optionsCount > 1 ? "ces options" : "cette option"}.`,
      );
    }

    await prisma.section.delete({ where: { id: input.id } });
    revalidateSectionPages(organizationId, branchId);
    return { ok: true as const };
  });

export const updateSectionAction = action
  .input(sectionSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } = await requireBranchContext();
    assertSectionOptionBranchFeatures(typebranch);
    const { nameSection, id } = input;
    const existSection = await prisma.section.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existSection) throw new Error("Section introuvable dans cette branche");
    const codeSection = await ensureUniqueIdentifier({
      base: generateCode(nameSection, "SEC", 16),
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.section.findFirst({
            where: { branchId, codeSection: value, id: { not: id } },
            select: { id: true },
          }),
        ),
    });

    const duplicate = await prisma.section.findFirst({
      where: { branchId, nameSection, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new Error("la section existe deja dans cette branche");

    const section = await prisma.section.update({
      data: {
        nameSection,
        codeSection,
      },
      where: {
        id,
      },
    });
    revalidateSectionPages(organizationId, branchId);
    return section;
  });

export const getSectionsAction = action.handler(
  async (): Promise<ISection[]> => {
    try {
      const { branchId } = await requireBranchContext();
      const Sections = await prisma.section.findMany({
        where: { branchId },
        include: { _count: { select: { option: true } } },
      });
      return Sections.map(({ _count, ...section }) => ({
        ...section,
        optionsCount: _count.option,
      }));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },
);

export const statuSectionAction = action
  .input(sectionSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
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
    revalidateSectionPages(organizationId, branchId);
    return updateStatuSection;
  });

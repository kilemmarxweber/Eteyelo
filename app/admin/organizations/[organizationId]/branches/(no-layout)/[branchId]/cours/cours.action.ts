"use server";

import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { ICours, coursSchema } from "@/src/interfaces/Cours";
import { Prisma } from "@/prisma/generated/prisma/client";
import z from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  ensureUniqueIdentifier,
  generateCourseCode,
} from "@/lib/generated-identifiers";

// CREATE COURS
export const createCoursAction = action
  .input(coursSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId } = await requireBranchContext();
      const existCours = await prisma.cours.findMany({
        where: {
          nameCours: input.nameCours,
          branchId,
        },
      });
      if (existCours.length > 0) {
        throw new Error("Le cours existe déjà");
      }

      const codeCours = await ensureUniqueIdentifier({
        base: generateCourseCode(input.nameCours),
        separator: "",
        exists: async (value) =>
          Boolean(
            await prisma.cours.findFirst({
              where: { branchId, codeCours: value },
              select: { id: true },
            }),
          ),
      });

      const cours = await prisma.cours.create({
        data: {
          ...input,
          codeCours,
          branchId,
        },
      });
      return cours;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        //  Vérifier si c'est une erreur P2002 (contrainte d'unicité)
        if (error.code === "P2002") {
          //  Gérez l'erreur ici, par exemple en retournant un message d'erreur à l'utilisateur
          throw new Error(`Le cours existe déjà`);
        }
      } else {
        //  Gérer d'autres erreurs ici
        throw error;
      }
    }
  });
// UPDATE COURS
export const updateCoursAction = action
  .input(coursSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { id } = input;
    const existing = await prisma.cours.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Cours introuvable dans cette branche");
    const codeCours = await ensureUniqueIdentifier({
      base: generateCourseCode(input.nameCours),
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.cours.findFirst({
            where: { branchId, codeCours: value, id: { not: id } },
            select: { id: true },
          }),
        ),
    });

    const cours = await prisma.cours.update({
      data: {
        ...input,
        codeCours,
        branchId,
      },
      where: {
        id,
      },
    });
  });

// DELETE COURS
export const deleteCoursAction = action
  .input(coursSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { id } = input;
    const existing = await prisma.cours.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Cours introuvable dans cette branche");

    const deleteCours = await prisma.cours.delete({
      where: {
        id,
      },
    });
    return deleteCours;
  });

// GET ALL COURS
export const getCoursAction = action.handler(async (): Promise<ICours[]> => {
  try {
    const { branchId } = await requireBranchContext();
    const Cours = await prisma.cours.findMany({
      where: { branchId },
    });

    const transformedCourses: ICours[] = Cours.map(
      (cours: (typeof Cours)[number]) => ({
        ...cours,
        description: cours.description || "",
      }),
    );
    return transformedCourses;
  } catch (error: any) {
    throw new Error(error.message);
  }
});
// GET ONE COURS
export const getCourseAction = action
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ICours[]> => {
    try {
      const { branchId } = await requireBranchContext();
      const Cours = await prisma.cours.findMany({
        where: {
          id: input.id,
          branchId,
        },
      });
      const transformedCourses: ICours[] = Cours.map((cours) => ({
        ...cours,
        description: cours.description || "",
      }));
      return transformedCourses;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

// GET COURS BY CLASSE
export const getCoursByClasseAction = action
  .input(
    z.object({
      classeId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ICours[]> => {
    const { branchId } = await requireBranchContext();
    const Cours = await prisma.teaching.findMany({
      where: {
        classeId: input.classeId,
        OR: [{ branchId }, { branchId: null }],
        classe: {
          branchId,
        },
        cours: {
          branchId,
        },
      },
      select: {
        cours: true,
      },
    });
    const transformedCourses: ICours[] = Cours.map((cours) => ({
      ...cours.cours,
      id: cours.cours?.id || "",
      codeCours: cours.cours?.codeCours || "",
      nameCours: cours.cours?.nameCours || "",
      description: cours.cours?.description || "",
    }));
    return transformedCourses;
  });

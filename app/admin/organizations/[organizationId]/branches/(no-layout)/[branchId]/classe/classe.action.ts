"use server";

import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { classeSchema, IClasse } from "@/src/interfaces/Classe";
import { Prisma } from "@/prisma/generated/prisma/client";
import { z } from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
// CREATION DE LA CLASSE
export const createClasseAction = action
  .input(classeSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId } = await requireBranchContext();
      const { nameClasse, codeClasse, optionId, statusClasse, creneauId } =
        input;
      const [option, creneau] = await Promise.all([
        optionId
          ? prisma.option.findFirst({
              where: { id: optionId, branchId },
              select: { id: true },
            })
          : null,
        creneauId
          ? prisma.creneau.findFirst({
              where: { id: creneauId, branchId },
              select: { id: true },
            })
          : null,
      ]);

      if (optionId && !option) {
        throw new Error("Option introuvable dans cette branche");
      }

      if (creneauId && !creneau) {
        throw new Error("Creneau introuvable dans cette branche");
      }

      const classe = await prisma.classe.create({
        data: {
          ...input,
          branchId,
        },
      });
      return classe;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Vérifier si c'est une erreur P2002 (contrainte d'unicité)
        if (error.code === "P2002") {
          console.error(
            "Erreur : la contrainte d'unicité a échoué sur les champs suivants :",
            error.meta?.target,
          );
          // Gérez l'erreur ici, par exemple en retournant un message d'erreur à l'utilisateur
          return {
            status: "error",
            message: `Une entrée avec ce ${
              Array.isArray(error.meta?.target)
                ? error.meta.target[0]
                : "champ inconnu"
            } existe déjà. Veuillez utiliser une autre valeur.`,
          };
        }
      } else {
        // Gérer d'autres erreurs ici
        throw error;
      }
    }
  });
//SELECT ALL CLASSE
export const getClassesAction = action.handler(async (): Promise<IClasse[]> => {
  try {
    const { branchId } = await requireBranchContext();
    const classes = await prisma.classe.findMany({
      where: { branchId },
      include: {
        option: true,
        creneau: true,
      },
    });
    const tranformedClasses: IClasse[] = classes.map((classe: any) => ({
      ...classe,
      optionId: classe.optionId || "",
      nameOption: classe?.option?.nameOption || "",
      codeOption: classe?.option?.codeOption || "",
      codeClasse: classe?.codeClasse || "",
      nameClasse: classe.nameClasse || "",
      statusClasse: classe.statusClasse || true,
      creneauId: classe.creneauId || "",
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
      option: classe.option
        ? {
            ...classe.option,
            sectionId: classe.option.sectionId || "",
            codeSection: "",
            nameSection: "",
            statusSection: true,
            statusOption: classe.option.statusOption || true,
          }
        : undefined,
    }));
    return tranformedClasses;
  } catch (error: any) {
    throw new Error(error.message);
  }
});
//SELECT CLASSE BY ID
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
          option: true,
        },
        where: {
          id: input.id,
          branchId,
        },
      });
      const tranformedClasses: IClasse[] = classes.map((classe: any) => ({
        ...classe,
        optionId: classe.optionId || "",
        nameOption: classe?.option?.nameOption || "",
        codeOption: classe?.option?.codeOption || "",
        codeClasse: classe?.codeClasse || "",
        nameClasse: classe.nameClasse || "",
        statusClasse: classe.statusClasse || true,
        creneauId: classe.creneauId || "",

        option: classe.option
          ? {
              ...classe.option,
              sectionId: classe.option.sectionId || "",
              codeSection: "",
              nameSection: "",
              statusSection: true,
              statusOption: classe.option.statusOption || true,
            }
          : undefined,
      }));
      return tranformedClasses;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

//UPDATE CLASSE
export const updateClasseAction = action
  .input(classeSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { nameClasse, codeClasse, id, optionId, statusClasse, creneauId } =
      input;
    const existing = await prisma.classe.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Classe introuvable dans cette branche");
    const [option, creneau] = await Promise.all([
      optionId
        ? prisma.option.findFirst({
            where: { id: optionId, branchId },
            select: { id: true },
          })
        : null,
      creneauId
        ? prisma.creneau.findFirst({
            where: { id: creneauId, branchId },
            select: { id: true },
          })
        : null,
    ]);

    if (optionId && !option) {
      throw new Error("Option introuvable dans cette branche");
    }

    if (creneauId && !creneau) {
      throw new Error("Creneau introuvable dans cette branche");
    }

    const updatedClasse = await prisma.classe.update({
      where: {
        id,
      },
      data: {
        nameClasse,
        codeClasse,
        optionId,
        statusClasse,
        creneauId,
      },
    });
    return updatedClasse;
  });
//DELETE CLASSE
export const deleteClasseAction = action
  .input(classeSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { id } = input;

    const existClass = await prisma.classe.findMany({
      where: {
        id,
        branchId,
      },
    });
    if (existClass.length === 0) {
      throw new Error("La classe n'existe pas");
    }
    const deletedClasse = await prisma.classe.delete({
      where: {
        id,
      },
    });
    return deletedClasse;
  });

//STATUS CLASSE
export const statusClasseAction = action
  .input(classeSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { statusClasse, id } = input;
    const existing = await prisma.classe.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Classe introuvable dans cette branche");

    const updateStatusClasse = await prisma.classe.update({
      where: {
        id,
      },
      data: {
        statusClasse,
      },
    });
  });

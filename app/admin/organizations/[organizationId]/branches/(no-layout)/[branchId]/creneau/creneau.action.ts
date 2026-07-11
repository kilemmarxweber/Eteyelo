"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import { ICreneau, creneauSchema } from "@/src/interfaces/creneau";
import { z } from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { buildIsArchivedUpdate } from "@/lib/archive";

function revalidateCreneauPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/creneau`);
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/classe`);
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/schedule`);
}

// ACTION POUR CRÉER UNE NOUVELLE CRENEAU
export const createCreneauAction = action
  .input(creneauSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, organizationId } = await requireBranchContext();
      const {
        nameCreneau,
        startTime,
        endTime,
        durationCourse,
        recreationDuration,
        recreationHour,
      } = input;
      const [heuresDebut, minutesDebut] = startTime.split(":").map(Number);
      const [heuresFin, minutesFin] = endTime.split(":").map(Number);
      const [RecreHeure, RecreMinutes] = recreationHour.split(":").map(Number);
      const existingCreneau = await prisma.creneau.findFirst({
        where: { branchId, nameCreneau },
        select: { id: true },
      });
      if (existingCreneau) {
        throw new Error("La vacation existe deja dans cette branche");
      }

      // VÉRIFIE SILE CRENEAU EXISTE DÉJÀ

      // CRÉE UNE NOUVELLE CRENEAU
      const creneau = await prisma.creneau.create({
        data: {
          nameCreneau,
          startTime: new Date(Date.UTC(2000, 1, 1, heuresDebut, minutesDebut)),
          endTime: new Date(Date.UTC(2000, 1, 1, heuresFin, minutesFin)),
          durationCourse,
          recreationDuration,
          branchId,
          recreationHour: new Date(
            Date.UTC(2000, 1, 1, RecreHeure, RecreMinutes),
          ),
        },
      });
      revalidateCreneauPages(organizationId, branchId);
      return creneau;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

// ACTION POUR METTRE À JOUR UNE CRENEAU EXISTANTE
export const updateCreneauAction = action
  .input(creneauSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const {
      id,
      nameCreneau,
      endTime,
      startTime,
      durationCourse,
      recreationDuration,
      recreationHour,
    } = input;
    const existing = await prisma.creneau.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Creneau introuvable dans cette branche");

    const duplicate = await prisma.creneau.findFirst({
      where: { branchId, nameCreneau, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("La vacation existe deja dans cette branche");
    }

    const [heuresDebut, minutesDebut] = startTime.split(":").map(Number);
    const [heuresFin, minutesFin] = endTime.split(":").map(Number);
    const [RecreHeure, RecreMinutes] = recreationHour.split(":").map(Number);
    // MET À JOURLE CRENEAU AVEC LES NOUVELLES DONNÉES
    const updatedCreneau = await prisma.creneau.update({
      where: {
        id,
      },
      data: {
        nameCreneau,
        startTime: new Date(Date.UTC(2000, 1, 1, heuresDebut, minutesDebut)),
        endTime: new Date(Date.UTC(2000, 1, 1, heuresFin, minutesFin)),
        durationCourse,
        recreationDuration,
        recreationHour: new Date(
          Date.UTC(2000, 1, 1, RecreHeure, RecreMinutes),
        ),
      },
    });
    revalidateCreneauPages(organizationId, branchId);
    return updatedCreneau;
  });

// ACTION POUR ARCHIVER UN CRENEAU
export const archiveCreneauAction = action
  .input(creneauSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId } = await requireBranchContext();
    const { id, nameCreneau } = input;

    const existCreneau = await prisma.creneau.findFirst({
      where: { id, branchId, nameCreneau },
    });
    if (!existCreneau) {
      throw new Error("le creneau n'existe pas");
    }

    const archivedCreneau = await prisma.creneau.update({
      where: { id },
      data: buildIsArchivedUpdate(userId),
    });
    revalidateCreneauPages(organizationId, branchId);
    return archivedCreneau;
  });

/** @deprecated Utiliser archiveCreneauAction */
export const deleteCreneauAction = archiveCreneauAction;

// ACTION POUR RÉCUPÉRER LES CRENEAUX PAR CLASSE
export const getCreneauByClasseAction = action
  .input(
    z.object({
      classeId: z.string(),
    }),
  )
  .handler(async ({ input }): Promise<ICreneau[]> => {
    try {
      // RÉCUPÈRE TOUTES LES CRENEAUS AVEC LEURS SECTIONS ET CLASSES ASSOCIÉES
      const { branchId } = await requireBranchContext();
      const classe = await prisma.classe.findFirst({
        where: { id: input.classeId, branchId },
        include: {
          creneau: true,
        },
      });
      if (!classe || !classe.creneau) return [];

      const creneaux = Array.isArray(classe.creneau)
        ? classe.creneau
        : [classe.creneau];
      // TRANSFORME LES CRENEAUS POUR INCLURE LES INFORMATIONS NÉCESSAIRES
      const transformedCreneaus: ICreneau[] = creneaux.map((creneau) => ({
        ...creneau,
        id: creneau.id || "",
        nameCreneau: creneau.nameCreneau || "",
        startTime: creneau.startTime
          ? creneau.startTime.toISOString().split("T")[1].slice(0, 5)
          : new Date().toISOString().split("T")[1].slice(0, 5),
        endTime: creneau.endTime
          ? creneau.endTime.toISOString().split("T")[1].slice(0, 5)
          : "",
        recreationDuration: creneau.recreationDuration || 0,
        recreationHour: creneau.recreationHour
          ? creneau.recreationHour.toISOString().split("T")[1].slice(0, 5)
          : "",
        durationCourse: creneau.durationCourse || 0,
        createdAt: creneau.createdAt || new Date(),
        updatedAt: creneau.updatedAt || new Date(),
      }));
      return transformedCreneaus;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

// ACTION POUR RECUPERER LE CRENEAU PAR CLASSE
export const getCreneauxAction = action
  .input(
    z
      .object({
        includeArchived: z.boolean().optional(),
      })
      .optional(),
  )
  .handler(async ({ input }): Promise<ICreneau[]> => {
    try {
      const { branchId } = await requireBranchContext();
      const includeArchived = input?.includeArchived ?? false;
      const creneaux = await prisma.creneau.findMany({
        where: {
          branchId,
          ...(includeArchived ? {} : { isArchived: false }),
        },
        include: {
          classe: {
            where: { branchId },
          },
        },
      });

      // TRANSFORME LES CRENEAUS POUR INCLURE LES INFORMATIONS NÉCESSAIRES
      const transformedCreneaus: ICreneau[] = creneaux.map((creneau) => ({
        ...creneau,
        id: creneau.id || "",
        nameCreneau: creneau.nameCreneau || "",
        startTime: creneau.startTime
          ? creneau.startTime.toISOString().split("T")[1].slice(0, 5)
          : new Date().toISOString().split("T")[1].slice(0, 5),
        endTime: creneau.endTime
          ? creneau.endTime.toISOString().split("T")[1].slice(0, 5)
          : "",
        recreationDuration: creneau.recreationDuration || 0,
        recreationHour: creneau.recreationHour
          ? creneau.recreationHour.toISOString().split("T")[1].slice(0, 5)
          : "",
        durationCourse: creneau.durationCourse || 0,
        classes: creneau.classe
          ? creneau.classe.map((classe) => ({
              ...classe,
              id: classe.id || "",
              nameClasse: classe.nameClasse || "",
              creneauId: classe.creneauId || "",
              codeClasse: classe.codeClasse || "",
              createdAt: classe.createdAt,
              updatedAt: classe.updatedAt,
              statusClasse: classe.statusClasse || true,
            }))
          : [],
        section: undefined, // AJOUTEZ CETTE LIGNE POUR PERMETTRE UNE VALEUR NULLE
      }));
      return transformedCreneaus;
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

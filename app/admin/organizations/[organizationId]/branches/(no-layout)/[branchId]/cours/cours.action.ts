"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import { ICours, coursSchema } from "@/src/interfaces/Cours";
import { Prisma } from "@/prisma/generated/prisma/client";
import z from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  ensureUniqueIdentifier,
  generateCourseCode,
} from "@/lib/generated-identifiers";
import { getCatalogPrimaryPlacement, type PrimaryDomainCode } from "@/lib/primary-domains";
import { upsertSecondaryCatalogCoursesForBranch } from "@/lib/secondary-catalog-sync";
import { normalizeBranchType } from "@/lib/academic-structure";
import { canManageOrganization } from "@/lib/auth/session-roles";

function requireCoursManagement(session: unknown) {
  if (!canManageOrganization(session as Parameters<typeof canManageOrganization>[0])) {
    throw new Error("Action non autorisée");
  }
}

function revalidateCoursPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/cours`);
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/settings/primary-domains`,
  );
}

function resolvePrimaryDomainFields(
  courseName: string,
  selectedDomain: PrimaryDomainCode | null | undefined,
  options?: { fallbackToCatalog?: boolean },
) {
  const fallbackToCatalog = options?.fallbackToCatalog ?? false;
  if (selectedDomain) {
    const catalog = getCatalogPrimaryPlacement(courseName);
    const useCatalog = catalog.domain === selectedDomain;
    return {
      primaryDomain: selectedDomain,
      primarySection: useCatalog
        ? catalog.section === "AUTRES" || catalog.section === "AUTRES COURS"
          ? null
          : catalog.section
        : null,
      domainOrder: useCatalog ? catalog.sortOrder : null,
    };
  }
  if (!fallbackToCatalog) {
    return {
      primaryDomain: null,
      primarySection: null,
      domainOrder: null,
    };
  }
  const catalog = getCatalogPrimaryPlacement(courseName);
  return {
    primaryDomain: catalog.domain,
    primarySection:
      catalog.section === "AUTRES" || catalog.section === "AUTRES COURS"
        ? null
        : catalog.section,
    domainOrder: catalog.sortOrder,
  };
}

// CREATE COURS
export const createCoursAction = action
  .input(coursSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, organizationId, session, typebranch } =
        await requireBranchContext();
      requireCoursManagement(session);
      const existCours = await prisma.cours.findFirst({
        where: {
          nameCours: { equals: input.nameCours.trim(), mode: "insensitive" },
          branchId,
        },
        select: { id: true },
      });
      if (existCours) {
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

      const selectedDomain = (input.primaryDomain ?? null) as PrimaryDomainCode | null;
      const primaryFields =
        typebranch === "PRIMAIRE"
          ? resolvePrimaryDomainFields(input.nameCours.trim(), selectedDomain, {
              // Si aucun domaine choisi : suggestion catalogue (modifiable ensuite)
              fallbackToCatalog: !selectedDomain,
            })
          : null;

      const cours = await prisma.cours.create({
        data: {
          nameCours: input.nameCours.trim(),
          description: input.description?.trim() || null,
          codeCours,
          branchId,
          statusCours: true,
          ...(primaryFields ?? {}),
        },
      });
      revalidateCoursPages(organizationId, branchId);
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
    const { branchId, organizationId, session, typebranch } =
      await requireBranchContext();
    requireCoursManagement(session);
    const { id } = input;
    if (!id) throw new Error("Identifiant du cours manquant");
    const existing = await prisma.cours.findFirst({
      where: { id, branchId },
      select: { id: true, primaryDomain: true, primarySection: true, domainOrder: true },
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

    const selectedDomain =
      input.primaryDomain === undefined
        ? (existing.primaryDomain as PrimaryDomainCode | null)
        : (input.primaryDomain as PrimaryDomainCode | null);

    const primaryFields =
      typebranch === "PRIMAIRE"
        ? resolvePrimaryDomainFields(input.nameCours.trim(), selectedDomain, {
            fallbackToCatalog: false,
          })
        : {};

    // Si le domaine n'a pas changé, conserver section / ordre existants
    const domainUnchanged =
      typebranch === "PRIMAIRE" &&
      selectedDomain === existing.primaryDomain &&
      selectedDomain != null;

    const cours = await prisma.cours.update({
      data: {
        nameCours: input.nameCours.trim(),
        description: input.description?.trim() || null,
        codeCours,
        branchId,
        ...(typebranch === "PRIMAIRE"
          ? domainUnchanged
            ? { primaryDomain: selectedDomain }
            : primaryFields
          : {}),
      },
      where: {
        id,
      },
    });
    revalidateCoursPages(organizationId, branchId);
    return cours;
  });

// ARCHIVE COURS
export const archiveCoursAction = action
  .input(coursSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireCoursManagement(session);
    const { id } = input;
    const existing = await prisma.cours.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Cours introuvable dans cette branche");

    const archivedCours = await prisma.cours.update({
      where: { id },
      data: { statusCours: false },
    });
    revalidateCoursPages(organizationId, branchId);
    return archivedCours;
  });

/** @deprecated Utiliser archiveCoursAction */
export const deleteCoursAction = archiveCoursAction;

export const setCoursStatusAction = action
  .input(z.object({ id: z.string().min(1), active: z.boolean() }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireCoursManagement(session);
    const existing = await prisma.cours.findFirst({ where: { id: input.id, branchId }, select: { id: true } });
    if (!existing) throw new Error("Cours introuvable dans cette branche");
    const cours = await prisma.cours.update({ where: { id: input.id }, data: { statusCours: input.active } });
    revalidateCoursPages(organizationId, branchId);
    return cours;
  });

// GET ALL COURS
export const getCoursAction = action
  .input(
    z
      .object({
        includeInactive: z.boolean().optional(),
      })
      .optional(),
  )
  .handler(async ({ input }): Promise<ICours[]> => {
  try {
    const { branchId } = await requireBranchContext();
    const includeInactive = input?.includeInactive ?? false;
    const Cours = await prisma.cours.findMany({
      where: {
        branchId,
        ...(includeInactive ? {} : { OR: [{ statusCours: true }, { statusCours: null }] }),
      },
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

/**
 * Importe le catalogue RDC des cours secondaire pour la branche courante.
 * Crée les matières et leurs pondérations par option (sections/options doivent déjà exister).
 */
export async function importSecondaryCatalogCoursesAction() {
  const { branchId, organizationId, session, typebranch } =
    await requireBranchContext();
  requireCoursManagement(session);

  if (normalizeBranchType(typebranch) !== "SECONDAIRE") {
    return {
      success: false as const,
      message: "Disponible uniquement pour une branche secondaire.",
      coursesCreated: 0,
      coursesUpdated: 0,
      coursesSkipped: 0,
      ponderationsCreated: 0,
      ponderationsUpdated: 0,
      ponderationsSkipped: 0,
    };
  }

  const result = await upsertSecondaryCatalogCoursesForBranch(branchId);
  revalidateCoursPages(organizationId, branchId);
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/coursPonderationOption`,
  );

  return {
    success: true as const,
    message:
      `${result.coursesCreated} cours créé(s), ${result.coursesUpdated} mis à jour` +
      ` · ${result.ponderationsCreated} pondération(s) créée(s), ${result.ponderationsUpdated} mise(s) à jour`,
    ...result,
  };
}

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

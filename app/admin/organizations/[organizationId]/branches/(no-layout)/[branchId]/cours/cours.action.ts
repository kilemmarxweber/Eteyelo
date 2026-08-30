"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import { ICours, coursSchema, coursComponentSchema } from "@/src/interfaces/Cours";
import { Prisma } from "@/prisma/generated/prisma/client";
import z from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  ensureUniqueIdentifier,
  generateCourseCode,
} from "@/lib/generated-identifiers";
import { getCatalogPrimaryPlacement, type PrimaryDomainCode } from "@/lib/primary-domains";
import { upsertAngolaSecondaryCoursesForBranch } from "@/lib/angola-secondary-catalog-sync";
import { upsertSecondaryCatalogCoursesForBranch } from "@/lib/secondary-catalog-sync";
import { normalizeBranchType } from "@/lib/academic-structure";
import { normalizeEducationSystem } from "@/lib/education-system";
import { canManageOrganization } from "@/lib/auth/session-roles";
import {
  importCourseToBranch,
  searchOrganizationCoursesForBranchImport,
  supportsCourseImport,
} from "@/lib/extended-course-import";
import { activeCoursStatusFilter } from "@/lib/active-cours";
import { getConfiguredCoursIdsForClasse } from "@/lib/course-ponderation";
import {
  COURS_KIND,
  expandConfiguredCoursIdsForSchedule,
  gradeableCoursFilter,
  slugifyComponentCodePart,
} from "@/lib/cours-components";

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
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/teaching`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/coursPonderationOption`,
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
          kind: COURS_KIND.SUBJECT,
          parentCoursId: null,
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
    // Masquer aussi les affectations encore actives pour ce cours.
    await prisma.teaching.updateMany({
      where: {
        coursId: id,
        branchId,
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
      },
      data: { statusTeaching: false },
    });
    revalidateCoursPages(organizationId, branchId);
    return archivedCours;
  });

/** @deprecated Utiliser archiveCoursAction */
export const deleteCoursAction = archiveCoursAction;

export const deleteCoursPermanentlyAction = action
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireCoursManagement(session);

    const existing = await prisma.cours.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Cours introuvable dans cette branche");

    const teachingsCount = await prisma.teaching.count({
      where: { coursId: input.id, OR: [{ branchId }, { branchId: null }] },
    });
    if (teachingsCount > 0) {
      throw new Error(
        `Impossible de supprimer ce cours : ${teachingsCount} affectation${teachingsCount > 1 ? "s" : ""} y ${teachingsCount > 1 ? "sont encore liées" : "est encore liée"}. Supprimez d'abord ${teachingsCount > 1 ? "ces affectations" : "cette affectation"}.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.coursOptionPonderation.deleteMany({
        where: { coursId: input.id, branchId },
      });
      await tx.cours.update({
        where: { id: input.id },
        data: { period: { set: [] } },
      });
      await tx.cours.delete({ where: { id: input.id } });
    });

    revalidateCoursPages(organizationId, branchId);
    return { ok: true as const };
  });

export const setCoursStatusAction = action
  .input(z.object({ id: z.string().min(1), active: z.boolean() }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireCoursManagement(session);
    const existing = await prisma.cours.findFirst({ where: { id: input.id, branchId }, select: { id: true } });
    if (!existing) throw new Error("Cours introuvable dans cette branche");
    const cours = await prisma.cours.update({
      where: { id: input.id },
      data: { statusCours: input.active },
    });
    if (!input.active) {
      await prisma.teaching.updateMany({
        where: {
          coursId: input.id,
          branchId,
          OR: [{ statusTeaching: true }, { statusTeaching: null }],
        },
        data: { statusTeaching: false },
      });
    }
    revalidateCoursPages(organizationId, branchId);
    return cours;
  });

// GET ALL COURS
export const getCoursAction = action
  .input(
    z
      .object({
        includeInactive: z.boolean().optional(),
        classeId: z.string().optional(),
        /** Inclure les postes d'horaire (défaut: parents bulletin seulement). */
        includeComponents: z.boolean().optional(),
      })
      .optional(),
  )
  .handler(async ({ input }): Promise<ICours[]> => {
  try {
    const { branchId } = await requireBranchContext();
    const includeInactive = input?.includeInactive ?? false;
    const includeComponents = input?.includeComponents ?? false;
    let configuredIds: string[] | null = null;
    if (input?.classeId) {
      const classe = await prisma.classe.findFirst({
        where: { id: input.classeId, branchId },
        select: { optionId: true, level: true },
      });
      if (!classe) {
        throw new Error("Classe introuvable dans cette branche");
      }
      const parentIds = await getConfiguredCoursIdsForClasse({
        branchId,
        optionId: classe.optionId,
        level: classe.level,
      });
      configuredIds = await expandConfiguredCoursIdsForSchedule({
        branchId,
        configuredParentIds: parentIds,
      });
      if (!configuredIds.length) return [];
    }
    const Cours = await prisma.cours.findMany({
      where: {
        branchId,
        ...(includeInactive ? {} : activeCoursStatusFilter),
        ...(configuredIds
          ? { id: { in: configuredIds } }
          : includeComponents
            ? {}
            : gradeableCoursFilter),
      },
      include: {
        _count: { select: { teaching: true, components: true } },
        parentCours: { select: { nameCours: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { nameCours: "asc" }],
    });

    const transformedCourses: ICours[] = Cours.map(
      ({ _count, parentCours, ...cours }) => ({
        ...cours,
        description: cours.description || "",
        teachingsCount: _count.teaching,
        componentsCount: _count.components,
        parentNameCours: parentCours?.nameCours ?? null,
        kind: cours.kind,
      }),
    );
    return transformedCourses;
  } catch (error: any) {
    throw new Error(error.message);
  }
});

export const getCoursComponentsAction = action
  .input(z.object({ parentCoursId: z.string().min(1) }))
  .handler(async ({ input }): Promise<ICours[]> => {
    const { branchId } = await requireBranchContext();
    const parent = await prisma.cours.findFirst({
      where: {
        id: input.parentCoursId,
        branchId,
        ...gradeableCoursFilter,
      },
      select: { id: true, nameCours: true },
    });
    if (!parent) throw new Error("Cours parent introuvable");

    const rows = await prisma.cours.findMany({
      where: {
        branchId,
        parentCoursId: parent.id,
        kind: COURS_KIND.SCHEDULE_COMPONENT,
      },
      include: { _count: { select: { teaching: true } } },
      orderBy: [{ sortOrder: "asc" }, { nameCours: "asc" }],
    });

    return rows.map(({ _count, ...cours }) => ({
      ...cours,
      description: cours.description || "",
      teachingsCount: _count.teaching,
      parentNameCours: parent.nameCours,
      kind: cours.kind,
    }));
  });

export const createCoursComponentAction = action
  .input(coursComponentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireCoursManagement(session);

    const parent = await prisma.cours.findFirst({
      where: {
        id: input.parentCoursId,
        branchId,
        ...gradeableCoursFilter,
      },
      select: { id: true, nameCours: true, codeCours: true },
    });
    if (!parent) throw new Error("Cours parent introuvable");

    const label = input.nameCours.trim();
    let nameCours = label;
    const nameTaken = await prisma.cours.findFirst({
      where: {
        branchId,
        nameCours: { equals: nameCours, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (nameTaken) {
      nameCours = `${parent.nameCours} — ${label}`;
      const stillTaken = await prisma.cours.findFirst({
        where: {
          branchId,
          nameCours: { equals: nameCours, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (stillTaken) {
        throw new Error("Un poste avec ce nom existe déjà");
      }
    }

    const codeBase =
      (input.codeCours?.trim() ||
        `${parent.codeCours}-${slugifyComponentCodePart(label) || "POSTE"}`)
        .slice(0, 24);
    const codeCours = await ensureUniqueIdentifier({
      base: codeBase,
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.cours.findFirst({
            where: { branchId, codeCours: value },
            select: { id: true },
          }),
        ),
    });

    const maxOrder = await prisma.cours.aggregate({
      where: {
        branchId,
        parentCoursId: parent.id,
        kind: COURS_KIND.SCHEDULE_COMPONENT,
      },
      _max: { sortOrder: true },
    });

    const component = await prisma.cours.create({
      data: {
        branchId,
        nameCours,
        codeCours,
        description: null,
        statusCours: input.statusCours ?? true,
        kind: COURS_KIND.SCHEDULE_COMPONENT,
        parentCoursId: parent.id,
        sortOrder: input.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    revalidateCoursPages(organizationId, branchId);
    return component;
  });

export const updateCoursComponentAction = action
  .input(coursComponentSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireCoursManagement(session);
    if (!input.id) throw new Error("Identifiant du poste manquant");

    const existing = await prisma.cours.findFirst({
      where: {
        id: input.id,
        branchId,
        kind: COURS_KIND.SCHEDULE_COMPONENT,
        parentCoursId: input.parentCoursId,
      },
      select: { id: true, parentCoursId: true },
    });
    if (!existing?.parentCoursId) throw new Error("Poste introuvable");

    const parent = await prisma.cours.findFirst({
      where: { id: existing.parentCoursId, branchId },
      select: { nameCours: true },
    });

    const label = input.nameCours.trim();
    let nameCours = label;
    const nameTaken = await prisma.cours.findFirst({
      where: {
        branchId,
        id: { not: existing.id },
        nameCours: { equals: nameCours, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (nameTaken && parent) {
      nameCours = `${parent.nameCours} — ${label}`;
    }

    const component = await prisma.cours.update({
      where: { id: existing.id },
      data: {
        nameCours,
        ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
        ...(input.statusCours != null ? { statusCours: input.statusCours } : {}),
      },
    });
    revalidateCoursPages(organizationId, branchId);
    return component;
  });

export const deleteCoursComponentAction = action
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, session } = await requireBranchContext();
    requireCoursManagement(session);

    const existing = await prisma.cours.findFirst({
      where: {
        id: input.id,
        branchId,
        kind: COURS_KIND.SCHEDULE_COMPONENT,
      },
      select: { id: true },
    });
    if (!existing) throw new Error("Poste introuvable");

    const teachingsCount = await prisma.teaching.count({
      where: {
        coursId: existing.id,
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
      },
    });
    if (teachingsCount > 0) {
      throw new Error(
        "Impossible de supprimer ce poste : des affectations y sont encore liées.",
      );
    }

    await prisma.cours.delete({ where: { id: existing.id } });
    revalidateCoursPages(organizationId, branchId);
    return { ok: true as const };
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
 * Importe le catalogue des cours secondaire pour la branche courante
 * (PORTUGUESA si enseignement angolais, sinon catalogue RDC).
 * Crée les matières et leurs pondérations par option (sections/options doivent déjà exister).
 */
export async function importSecondaryCatalogCoursesAction() {
  const { branchId, organizationId, session, typebranch, educationSystem } =
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

  const isAngola = normalizeEducationSystem(educationSystem) === "ANGOLAIS";
  const result = isAngola
    ? await upsertAngolaSecondaryCoursesForBranch(branchId)
    : await upsertSecondaryCatalogCoursesForBranch(branchId);
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

export async function searchOrganizationCoursesForImportAction(params: {
  query?: string;
  limit?: number;
}) {
  const { branchId, organizationId, session, typebranch } =
    await requireBranchContext();
  requireCoursManagement(session);

  if (!supportsCourseImport(typebranch)) {
    return {
      ok: false as const,
      message: "L'import de cours n'est pas disponible pour ce type de branche",
    };
  }

  const courses = await searchOrganizationCoursesForBranchImport({
    organizationId,
    targetBranchId: branchId,
    query: params.query,
    limit: params.limit,
  });

  return { ok: true as const, courses };
}

export async function importCourseFromBranchAction(input: {
  courseId: string;
  sourceBranchId: string;
}) {
  const { branchId, organizationId, session, typebranch } =
    await requireBranchContext();
  requireCoursManagement(session);

  if (!supportsCourseImport(typebranch)) {
    return {
      ok: false as const,
      message: "L'import de cours n'est pas disponible pour ce type de branche",
    };
  }

  if (!input.courseId?.trim() || !input.sourceBranchId?.trim()) {
    return { ok: false as const, message: "Donnees invalides" };
  }

  try {
    await importCourseToBranch({
      courseId: input.courseId.trim(),
      sourceBranchId: input.sourceBranchId.trim(),
      targetBranchId: branchId,
      organizationId,
      targetBranchType: typebranch,
    });

    revalidateCoursPages(organizationId, branchId);
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/coursPonderationOption`,
    );

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Import impossible",
    };
  }
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

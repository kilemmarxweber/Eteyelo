"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import {
  classeCreateSchema,
  classeSchema,
  IClasse,
} from "@/src/interfaces/Classe";
import { Prisma } from "@/prisma/generated/prisma/client";
import { z } from "zod";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  buildClassCode,
  buildClassName,
  isCtebLevel,
  isPrimaryBranch,
  validateClassInput,
} from "@/lib/class-structure";
import {
  getCatalogAbbrevForOptionName,
} from "@/lib/class-catalog";
import { ensurePrimaryAcademicStructure } from "@/lib/primary-academic-structure";
import { ensureSecondaryCtebStructure } from "@/lib/secondary-cteb-structure";
import {
  ensureUniqueIdentifier,
  generateClassCode,
} from "@/lib/generated-identifiers";
import { upsertClassCatalogForBranch } from "@/lib/class-catalog-sync";
import { normalizeBranchType } from "@/lib/academic-structure";

function revalidateClassePages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/classe`);
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/schedule`);
}

async function resolveClassIdentity(params: {
  typebranch: unknown;
  level?: string | null;
  parallel?: string | null;
  optionId?: string | null;
  nameClasse?: string | null;
  branchId: string;
  isLegacy?: boolean;
}) {
  const primary = isPrimaryBranch(params.typebranch);

  let optionId = primary ? undefined : params.optionId;
  if (!primary && !params.isLegacy && isCtebLevel(params.level ?? "")) {
    const cteb = await ensureSecondaryCtebStructure(prisma, params.branchId);
    optionId = cteb.option.id;
  }

  const validated = validateClassInput({
    typebranch: params.typebranch,
    level: params.level,
    parallel: params.parallel,
    optionId,
    nameClasse: params.nameClasse,
    isLegacy: params.isLegacy,
  });

  if (params.isLegacy) {
    return {
      nameClasse: validated.nameClasse!,
      codeBase: generateClassCode(validated.nameClasse!),
      level: undefined,
      parallel: validated.parallel ?? null,
      optionId: validated.optionId ?? null,
    };
  }

  const option = primary
    ? (await ensurePrimaryAcademicStructure(prisma, params.branchId)).option
    : isCtebLevel(validated.level ?? "")
      ? (await ensureSecondaryCtebStructure(prisma, params.branchId)).option
      : validated.optionId
        ? await prisma.option.findFirst({
            where: { id: validated.optionId, branchId: params.branchId },
            select: { id: true, nameOption: true, codeOption: true },
          })
        : null;

  if (validated.optionId && !option) {
    throw new Error("Option introuvable dans cette branche");
  }

  const nameClasse = buildClassName({
    typebranch: params.typebranch,
    level: validated.level!,
    parallel: validated.parallel,
    optionName: option?.nameOption,
  });

  const codeBase = buildClassCode({
    typebranch: params.typebranch,
    level: validated.level!,
    parallel: validated.parallel,
    optionName: option?.nameOption,
    optionAbbrev: getCatalogAbbrevForOptionName(option?.nameOption),
  });

  return {
    nameClasse,
    codeBase,
    level: validated.level,
    parallel: validated.parallel ?? null,
    optionId: option?.id ?? null,
  };
}

export const getBranchTypeAction = action.handler(async () => {
  const { typebranch } = await requireBranchContext();
  return { typebranch };
});

export const createClasseAction = action
  .input(classeCreateSchema)
  .handler(async ({ input }) => {
    try {
      const { branchId, organizationId, typebranch } =
        await requireBranchContext();
      const { statusClasse, creneauId, capacity } = input;

      const identity = await resolveClassIdentity({
        typebranch,
        level: input.level,
        parallel: input.parallel,
        optionId: input.optionId,
        branchId,
      });

      const codeClasse = await ensureUniqueIdentifier({
        base: identity.codeBase,
        separator: "",
        exists: async (value) =>
          Boolean(
            await prisma.classe.findFirst({
              where: { branchId, codeClasse: value },
              select: { id: true },
            }),
          ),
      });

      const duplicate = await prisma.classe.findFirst({
        where: { branchId, nameClasse: identity.nameClasse },
        select: { id: true },
      });
      if (duplicate) {
        throw new Error("La classe existe deja dans cette branche");
      }

      if (creneauId) {
        const creneau = await prisma.creneau.findFirst({
          where: { id: creneauId, branchId },
          select: { id: true },
        });
        if (!creneau) {
          throw new Error("Creneau introuvable dans cette branche");
        }
      }

      const classe = await prisma.classe.create({
        data: {
          nameClasse: identity.nameClasse,
          codeClasse,
          level: identity.level,
          parallel: identity.parallel,
          capacity: capacity ?? null,
          optionId: identity.optionId,
          statusClasse,
          creneauId: creneauId || null,
          branchId,
        },
      });
      revalidateClassePages(organizationId, branchId);
      return classe;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          console.error(
            "Erreur : la contrainte d'unicite a echoue sur les champs suivants :",
            error.meta?.target,
          );
          return {
            status: "error",
            message: `Une entree avec ce ${
              Array.isArray(error.meta?.target)
                ? error.meta.target[0]
                : "champ inconnu"
            } existe deja. Veuillez utiliser une autre valeur.`,
          };
        }
      } else {
        throw error;
      }
    }
  });

function transformClasse(classe: any): IClasse {
  return {
    ...classe,
    optionId: classe.optionId || "",
    nameOption: classe?.option?.nameOption || "",
    codeOption: classe?.option?.codeOption || "",
    codeClasse: classe?.codeClasse || "",
    nameClasse: classe.nameClasse || "",
    level: classe.level ?? null,
    parallel: classe.parallel ?? null,
    capacity: classe.capacity ?? null,
    statusClasse: classe.statusClasse ?? true,
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
          statusOption: classe.option.statusOption ?? true,
        }
      : undefined,
  };
}

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
    return classes.map(transformClasse);
  } catch (error: any) {
    throw new Error(error.message);
  }
});

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
      return classes.map(transformClasse);
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

export const updateClasseAction = action
  .input(classeSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } =
      await requireBranchContext();
    const { id, statusClasse, creneauId, capacity } = input;
    if (!id) throw new Error("Identifiant de classe manquant");

    const existing = await prisma.classe.findFirst({
      where: { id, branchId },
      select: { id: true, level: true },
    });
    if (!existing) throw new Error("Classe introuvable dans cette branche");

    const isLegacy = !existing.level && !input.level;

    const identity = await resolveClassIdentity({
      typebranch,
      level: input.level?.trim() || existing.level,
      parallel: input.parallel,
      optionId: input.optionId,
      nameClasse: input.nameClasse,
      branchId,
      isLegacy,
    });

    if (creneauId) {
      const creneau = await prisma.creneau.findFirst({
        where: { id: creneauId, branchId },
        select: { id: true },
      });
      if (!creneau) {
        throw new Error("Creneau introuvable dans cette branche");
      }
    }

    const codeClasse = await ensureUniqueIdentifier({
      base: identity.codeBase,
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.classe.findFirst({
            where: { branchId, codeClasse: value, id: { not: id } },
            select: { id: true },
          }),
        ),
    });

    const duplicate = await prisma.classe.findFirst({
      where: { branchId, nameClasse: identity.nameClasse, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new Error("La classe existe deja dans cette branche");

    const updatedClasse = await prisma.classe.update({
      where: { id },
      data: {
        nameClasse: identity.nameClasse,
        codeClasse,
        level: identity.level ?? null,
        parallel: identity.parallel ?? null,
        capacity: capacity ?? null,
        optionId: identity.optionId,
        statusClasse,
        creneauId: creneauId || null,
      },
    });
    revalidateClassePages(organizationId, branchId);
    return updatedClasse;
  });

export const archiveClasseAction = action
  .input(classeSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
    const { id } = input;

    const existClass = await prisma.classe.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existClass) {
      throw new Error("La classe n'existe pas");
    }

    const activeEnrollments = await prisma.classEnrollment.count({
      where: {
        classeId: id,
        branchId,
        statusEnrollment: true,
      },
    });

    if (activeEnrollments > 0) {
      throw new Error(
        "Impossible d'archiver cette classe : des inscriptions actives existent. Annulez-les ou cloturez-les d'abord.",
      );
    }

    const archivedClasse = await prisma.classe.update({
      where: { id },
      data: { statusClasse: false },
    });
    revalidateClassePages(organizationId, branchId);
    return archivedClasse;
  });

/** @deprecated Utiliser archiveClasseAction */
export const deleteClasseAction = archiveClasseAction;

export const statusClasseAction = action
  .input(classeSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireBranchContext();
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
    revalidateClassePages(organizationId, branchId);
    return updateStatusClasse;
  });

/**
 * Importe le catalogue RDC des classes pour la branche courante.
 * - PRIMAIRE : 1è-PR … 6è-PR
 * - SECONDAIRE : 7è/8è CTEB Tronc commun + 1è–4è Humanités pour options actives
 * @param importSectionsAndOptions D3=A si true (upsert sections/options catalogue)
 */
export async function importClassCatalogAction(params?: {
  importSectionsAndOptions?: boolean;
}) {
  const { branchId, organizationId, typebranch } =
    await requireBranchContext();

  const result = await upsertClassCatalogForBranch(branchId, {
    importSectionsAndOptions:
      params?.importSectionsAndOptions ??
      normalizeBranchType(typebranch) === "SECONDAIRE",
  });

  revalidateClassePages(organizationId, branchId);
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/section`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/option`,
  );

  return {
    success: true as const,
    ...result,
    typebranch: normalizeBranchType(typebranch),
  };
}

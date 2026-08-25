"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireFinanceBranchContext } from "@/lib/auth/require-branch-context";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { action } from "@/lib/zsa";
import {
  fraisSchema,
  IFrais,
  typeFraisSchema,
  ITypeFrais,
  deleteFraisSchema,
  replicateFraisSchema,
} from "@/src/interfaces/Frais";
import { z } from "zod";
import {
  ensureUniqueIdentifier,
  generateCode,
} from "@/lib/generated-identifiers";
import {
  getSchoolYearForBranch,
  requireCurrentSchoolYear,
} from "@/lib/school-year";
import { resolveCycle } from "@/lib/cycle";
import { randomUUID } from "crypto";

type FraisWithRelations = Prisma.FraisGetPayload<{
  include: {
    classe: true;
    typeFrais: true;
    schoolYear: true;
  };
}>;


async function getCurrentBranchSchoolYear(branchId: string) {
  return requireCurrentSchoolYear(branchId);
}

async function requireClasseInBranch(classeId: string, branchId: string) {
  const classe = await prisma.classe.findFirst({
    where: {
      id: classeId,
      branchId,
    },
  });

  if (!classe) {
    throw new Error("Classe introuvable dans cette branche");
  }

  return classe;
}

async function requireTypeFraisInBranch(
  typeFraisId: string | undefined,
  branchId: string,
) {
  if (!typeFraisId || typeFraisId === "none") {
    throw new Error("Type de frais requis");
  }

  const typeFrais = await prisma.typeFrais.findFirst({
    where: {
      id: typeFraisId,
      branchId,
      statusType: true,
    },
  });

  if (!typeFrais) {
    throw new Error("Type de frais introuvable dans cette branche");
  }

  return typeFrais;
}

function mapFrais(frais: FraisWithRelations): IFrais {
  return {
    id: frais.id,
    nameFrais: frais.nameFrais,
    montantFrais: Number(frais.montantFrais),
    classeId: frais.classeId,
    typeFraisId: frais.typeFraisId,
    echeance: frais.echeance || undefined,
    statusFrais: frais.statusFrais,
    createdAt: frais.createdAt,
    updatedAt: frais.updatedAt,
    priority: frais.priority,
    schoolYearId: frais.schoolYearId ?? "",
    schoolYear: frais.schoolYear
      ? {
          id: frais.schoolYear.id,
          nameSchoolYear: frais.schoolYear.nameYear,
        }
      : undefined,
    Classe: frais.classe
      ? {
          id: frais.classe.id,
          codeClasse: frais.classe.codeClasse,
          nameClasse: frais.classe.nameClasse,
          statusClasse: frais.classe.statusClasse ?? true,
          createdAt: frais.classe.createdAt,
          updatedAt: frais.classe.updatedAt,
        }
      : undefined,
    typeFrais: frais.typeFrais
      ? {
          id: frais.typeFrais.id,
          codeType: frais.typeFrais.codeType,
          nameType: frais.typeFrais.nameType,
          description: frais.typeFrais.description || undefined,
          statusType: frais.typeFrais.statusType,
          createdAt: frais.typeFrais.createdAt,
          updatedAt: frais.typeFrais.updatedAt,
        }
      : undefined,
  };
}

function revalidateFraisPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/frais`);
}

export const createTypeFraisAction = action
  .input(typeFraisSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();
    const { nameType, description, statusType } = input;
    const codeType = await ensureUniqueIdentifier({
      base: generateCode(nameType, "TYPE", 16),
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.typeFrais.findUnique({
            where: { codeType: value },
            select: { id: true },
          }),
        ),
    });

    const existingType = await prisma.typeFrais.findFirst({
      where: { nameType, branchId },
    });

    if (existingType) {
      throw new Error("Ce type de frais existe deja");
    }

    const typeFrais = await prisma.typeFrais.create({
      data: {
        codeType,
        nameType,
        description,
        statusType: statusType ?? true,
        cycle: input.cycle ?? null,
        branch: {
          connect: { id: branchId },
        },
      },
    });
    revalidateFraisPages(organizationId, branchId);
    return typeFrais;
  });

export const updateTypeFraisAction = action
  .input(typeFraisSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();
    const { id, nameType, description, statusType } = input;

    if (!id) {
      throw new Error("ID requis pour la mise a jour");
    }

    const existingType = await prisma.typeFrais.findFirst({
      where: { id, branchId },
      select: { id: true },
    });

    if (!existingType) {
      throw new Error("Type de frais introuvable dans cette branche");
    }

    const codeType = await ensureUniqueIdentifier({
      base: generateCode(nameType, "TYPE", 16),
      separator: "",
      exists: async (value) =>
        Boolean(
          await prisma.typeFrais.findFirst({
            where: { codeType: value, id: { not: id } },
            select: { id: true },
          }),
        ),
    });

    const typeFrais = await prisma.typeFrais.update({
      where: { id },
      data: {
        codeType,
        nameType,
        description,
        statusType: statusType ?? true,
        cycle: input.cycle ?? null,
      },
    });
    revalidateFraisPages(organizationId, branchId);
    return typeFrais;
  });

export const getTypeFraisAction = action.handler(
  async (): Promise<ITypeFrais[]> => {
    const { branchId } = await requireFinanceBranchContext();
    const typeFrais = await prisma.typeFrais.findMany({
      where: {
        statusType: true,
        branchId,
      },
      orderBy: { nameType: "asc" },
    });

    return typeFrais.map((type) => ({
      id: type.id,
      codeType: type.codeType,
      nameType: type.nameType,
      description: type.description || undefined,
      cycle: type.cycle ?? null,
      statusType: type.statusType,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    }));
  },
);

export const getTypeFraisSettingsAction = action.handler(
  async (): Promise<ITypeFrais[]> => {
    const { branchId } = await requireFinanceBranchContext();
    const typeFrais = await prisma.typeFrais.findMany({
      where: {
        branchId,
      },
      orderBy: { nameType: "asc" },
    });

    return typeFrais.map((type) => ({
      id: type.id,
      codeType: type.codeType,
      nameType: type.nameType,
      description: type.description || undefined,
      cycle: type.cycle ?? null,
      statusType: type.statusType,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    }));
  },
);

export const createFraisAction = action
  .input(fraisSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId, typebranch } =
      await requireFinanceBranchContext();
    const {
      nameFrais,
      montantFrais,
      statusFrais,
      classeId,
      typeFraisId,
      echeance,
      priority,
      semesterId,
      applyToCycle,
      applyToLevel,
    } = input;

    const [currentYear, classe, typeFrais] = await Promise.all([
      getCurrentBranchSchoolYear(branchId),
      requireClasseInBranch(classeId, branchId),
      requireTypeFraisInBranch(typeFraisId, branchId),
    ]);

    const sourceCycle = resolveCycle(classe, { typebranch });
    let targets = [classe];
    if (applyToCycle || applyToLevel) {
      const allClasses = await prisma.classe.findMany({
        where: { branchId },
        select: { id: true, cycle: true, level: true },
      });
      targets = allClasses.filter((item) => {
        if (
          applyToCycle &&
          resolveCycle(item, { typebranch }) !== sourceCycle
        ) {
          return false;
        }
        if (applyToLevel && (item.level ?? "") !== (classe.level ?? "")) {
          return false;
        }
        return true;
      }) as typeof targets;
    }

    const groupKey = targets.length > 1 ? randomUUID() : null;
    let created = null;

    for (const target of targets) {
      const existFrais = await prisma.frais.findFirst({
        where: {
          branchId,
          nameFrais,
          classeId: target.id,
          schoolYearId: currentYear.id,
        },
      });
      if (existFrais) continue;

      created = await prisma.frais.create({
        data: {
          nameFrais,
          montantFrais,
          statusFrais: statusFrais ?? true,
          echeance,
          priority: priority ?? 99,
          semesterId: semesterId ?? null,
          fraisGroupKey: groupKey,
          classe: { connect: { id: target.id } },
          typeFrais: { connect: { id: typeFrais.id } },
          schoolYear: { connect: { id: currentYear.id } },
          branch: { connect: { id: branchId } },
        },
        include: {
          classe: true,
          typeFrais: true,
          schoolYear: true,
        },
      });
    }

    if (!created) {
      throw new Error("Ce frais existe deja pour cette classe");
    }

    revalidateFraisPages(organizationId, branchId);
    return mapFrais(created);
  });

export const archiveFrais = action
  .input(deleteFraisSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();

    const frais = await prisma.frais.findFirst({
      where: {
        id: input.id,
        branchId,
      },
    });

    if (!frais) {
      throw new Error("Frais introuvable dans cette branche");
    }

    const archivedFrais = await prisma.frais.update({
      where: { id: frais.id },
      data: { statusFrais: false },
    });

    revalidateFraisPages(organizationId, branchId);
    return {
      ...archivedFrais,
      montantFrais: Number(archivedFrais.montantFrais),
    };
  });

/** @deprecated Utiliser archiveFrais */
export const deleteFrais = archiveFrais;

export const updateFraisAction = action
  .input(fraisSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();
    const {
      id,
      nameFrais,
      montantFrais,
      statusFrais,
      classeId,
      typeFraisId,
      echeance,
      priority,
    } = input;

    if (!id) {
      throw new Error("ID requis pour la mise a jour");
    }

    const existingFrais = await prisma.frais.findFirst({
      where: {
        id,
        branchId,
      },
    });

    if (!existingFrais) {
      throw new Error("Frais introuvable dans cette branche");
    }

    const targetClasseId = classeId || existingFrais.classeId;
    const targetTypeFraisId = typeFraisId || existingFrais.typeFraisId;
    const [currentYear, classe, typeFrais] = await Promise.all([
      getCurrentBranchSchoolYear(branchId),
      requireClasseInBranch(targetClasseId, branchId),
      requireTypeFraisInBranch(targetTypeFraisId, branchId),
    ]);

    const frais = await prisma.frais.update({
      where: { id },
      data: {
        nameFrais,
        montantFrais,
        statusFrais: statusFrais ?? existingFrais.statusFrais,
        echeance,
        priority: priority ?? existingFrais.priority,
        classe: {
          connect: { id: classe.id },
        },
        typeFrais: {
          connect: { id: typeFrais.id },
        },
        schoolYear: {
          connect: { id: currentYear.id },
        },
      },
      include: {
        classe: true,
        typeFrais: true,
        schoolYear: true,
      },
    });

    revalidateFraisPages(organizationId, branchId);
    return mapFrais(frais);
  });

export const getFraisAction = action
  .input(
    z
      .object({
        schoolYearId: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ input }): Promise<IFrais[]> => {
    const { branchId } = await requireFinanceBranchContext();
    const schoolYear = input?.schoolYearId
      ? await prisma.schoolYear.findFirst({
          where: {
            id: input.schoolYearId,
            branchId,
            isArchived: false,
          },
        })
      : await getCurrentBranchSchoolYear(branchId);

    if (!schoolYear) {
      throw new Error("Annee scolaire introuvable pour cette branche");
    }

    const frais = await prisma.frais.findMany({
      where: {
        branchId,
        schoolYearId: schoolYear.id,
      },
      include: {
        classe: true,
        typeFrais: true,
        schoolYear: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return frais.map(mapFrais);
  });

export const getFraisByClassAction = action
  .input(z.object({ classeId: z.string() }))
  .handler(async ({ input }): Promise<IFrais[]> => {
    const { branchId } = await requireFinanceBranchContext();
    const currentYear = await getCurrentBranchSchoolYear(branchId);
    const classe = await requireClasseInBranch(input.classeId, branchId);

    const frais = await prisma.frais.findMany({
      where: {
        branchId,
        classeId: classe.id,
        schoolYearId: currentYear.id,
      },
      include: {
        classe: true,
        typeFrais: true,
        schoolYear: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return frais.map(mapFrais);
  });

export const statusFraisAction = action
  .input(fraisSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();
    const { id, statusFrais } = input;

    if (!id) {
      throw new Error("ID requis");
    }

    const frais = await prisma.frais.findFirst({
      where: {
        id,
        branchId,
      },
    });

    if (!frais) {
      throw new Error("Frais introuvable dans cette branche");
    }

    const updatedFrais = await prisma.frais.update({
      where: { id },
      data: { statusFrais },
    });
    revalidateFraisPages(organizationId, branchId);
    return updatedFrais;
  });

export const getFraisByStudent = action
  .input(z.object({ studentId: z.string() }))
  .handler(async ({ input }): Promise<IFrais[]> => {
    const { branchId } = await requireFinanceBranchContext();
    const currentYear = await getCurrentBranchSchoolYear(branchId);

    const classEnrollments = await prisma.classEnrollment.findMany({
      where: {
        studentId: input.studentId,
        branchId,
        schoolYearId: currentYear.id,
      },
      include: {
        schoolYear: true,
        classe: {
          include: {
            Frais: {
              where: {
                branchId,
                schoolYearId: currentYear.id,
              },
              include: {
                classe: true,
                typeFrais: true,
                schoolYear: true,
              },
            },
          },
        },
      },
    });

    return classEnrollments.flatMap((enrollment) =>
      (enrollment.classe?.Frais ?? []).map(mapFrais),
    );
  });

export const calculateFraisBalanceAction = action
  .input(z.object({ fraisId: z.string(), studentId: z.string() }))
  .handler(async ({ input }) => {
    const { branchId } = await requireFinanceBranchContext();
    const { fraisId, studentId } = input;

    const frais = await prisma.frais.findFirst({
      where: {
        id: fraisId,
        branchId,
      },
    });

    if (!frais) {
      throw new Error("Frais non trouve");
    }

    const classEnrollment = await prisma.classEnrollment.findFirst({
      where: {
        studentId,
        classeId: frais.classeId,
        branchId,
      },
    });

    if (!classEnrollment) {
      throw new Error("Inscription non trouvee");
    }

    const paiements = await prisma.familyPayment.findMany({
      where: {
        fraisId,
        classEnrollmentId: classEnrollment.id,
        status: "VALIDE",
        branchId,
      },
    });

    const totalPaye = paiements.reduce((sum, p) => sum + Number(p.amount), 0);
    const montantDu = Number(frais.montantFrais);
    const solde = montantDu - totalPaye;

    return {
      fraisId,
      montantDu,
      totalPaye,
      solde,
      estSolde: solde <= 0,
    };
  });

export const getFraisClassSidebarAction = action.handler(async () => {
  const { branchId, organizationId } = await requireFinanceBranchContext();
  const currentYear = await getSchoolYearForBranch(branchId);

  const [classes, counts] = await Promise.all([
    prisma.classe.findMany({
      where: {
        branchId,
        branch: { organizationId },
      },
      include: {
        option: {
          include: {
            section: true,
          },
        },
      },
      orderBy: { nameClasse: "asc" },
    }),
    prisma.frais.groupBy({
      by: ["classeId"],
      where: {
        branchId,
        statusFrais: true,
        ...(currentYear ? { schoolYearId: currentYear.id } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map(
    counts.map((item) => [item.classeId, item._count._all]),
  );

  return {
    schoolYearName: currentYear?.nameYear ?? null,
    classes: classes.map((classe) => ({
      id: classe.id,
      nameClasse: classe.nameClasse,
      codeClasse: classe.codeClasse,
      cycle: classe.cycle,
      level: classe.level,
      optionName: classe.option?.nameOption ?? "",
      sectionName: classe.option?.section?.nameSection ?? "",
      activeFraisCount: countMap.get(classe.id) ?? 0,
    })),
  };
});

export const replicateFraisAction = action
  .input(replicateFraisSchema)
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();
    const { sourceClasseId, fraisIds, targetClasseIds, allOtherClasses } =
      input;

    const currentYear = await getCurrentBranchSchoolYear(branchId);
    const sourceClasse = await requireClasseInBranch(sourceClasseId, branchId);

    const sourceFrais = await prisma.frais.findMany({
      where: {
        branchId,
        classeId: sourceClasse.id,
        schoolYearId: currentYear.id,
        ...(fraisIds?.length ? { id: { in: fraisIds } } : {}),
      },
    });

    if (sourceFrais.length === 0) {
      throw new Error("Aucun frais à reconduire pour cette classe");
    }

    const requestedTargetIds = allOtherClasses
      ? undefined
      : Array.from(
          new Set(
            (targetClasseIds ?? []).filter((id) => id !== sourceClasse.id),
          ),
        );

    if (!allOtherClasses && (!requestedTargetIds || requestedTargetIds.length === 0)) {
      throw new Error("Aucune autre classe sélectionnée");
    }

    const otherClasses = await prisma.classe.findMany({
      where: {
        branchId,
        id: allOtherClasses
          ? { not: sourceClasse.id }
          : { in: requestedTargetIds ?? [] },
      },
      select: { id: true },
    });

    const validTargetIds = otherClasses.map((classe) => classe.id);

    if (validTargetIds.length === 0) {
      throw new Error("Aucune autre classe sélectionnée");
    }

    const existing = await prisma.frais.findMany({
      where: {
        branchId,
        schoolYearId: currentYear.id,
        classeId: { in: validTargetIds },
        nameFrais: { in: sourceFrais.map((frais) => frais.nameFrais) },
      },
      select: { classeId: true, nameFrais: true },
    });

    const existingKeys = new Set(
      existing.map((row) => `${row.classeId}::${row.nameFrais}`),
    );

    const toCreate = validTargetIds.flatMap((classeId) =>
      sourceFrais
        .filter((frais) => !existingKeys.has(`${classeId}::${frais.nameFrais}`))
        .map((frais) => ({
          nameFrais: frais.nameFrais,
          montantFrais: frais.montantFrais,
          statusFrais: frais.statusFrais,
          classeId,
          typeFraisId: frais.typeFraisId,
          echeance: frais.echeance,
          schoolYearId: currentYear.id,
          priority: frais.priority,
          branchId,
        })),
    );

    if (toCreate.length > 0) {
      await prisma.frais.createMany({ data: toCreate });
    }

    const skipped =
      validTargetIds.length * sourceFrais.length - toCreate.length;

    revalidateFraisPages(organizationId, branchId);

    return {
      created: toCreate.length,
      skipped,
      classCount: validTargetIds.length,
      feeCount: sourceFrais.length,
    };
  });

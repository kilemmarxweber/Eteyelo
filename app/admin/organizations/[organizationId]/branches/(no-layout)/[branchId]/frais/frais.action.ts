"use server";

import { prisma } from "@/lib/prisma";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { action } from "@/lib/zsa";
import {
  fraisSchema,
  IFrais,
  typeFraisSchema,
  ITypeFrais,
  deleteFraisSchema,
} from "@/src/interfaces/Frais";
import { z } from "zod";
import {
  ensureUniqueIdentifier,
  generateCode,
} from "@/lib/generated-identifiers";

type FraisWithRelations = Prisma.FraisGetPayload<{
  include: {
    classe: true;
    typeFrais: true;
    schoolYear: true;
  };
}>;

async function getCurrentBranchSchoolYear(branchId: string) {
  const currentYear = await prisma.schoolYear.findFirst({
    where: {
      isCurrentYear: true,
      branchId,
    },
  });

  if (!currentYear) {
    throw new Error("Annee scolaire non trouvee pour cette branche");
  }

  return currentYear;
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

export const createTypeFraisAction = action
  .input(typeFraisSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
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

    return await prisma.typeFrais.create({
      data: {
        codeType,
        nameType,
        description,
        statusType: statusType ?? true,
        branch: {
          connect: { id: branchId },
        },
      },
    });
  });

export const updateTypeFraisAction = action
  .input(typeFraisSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
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

    return await prisma.typeFrais.update({
      where: { id },
      data: {
        codeType,
        nameType,
        description,
        statusType: statusType ?? true,
      },
    });
  });

export const getTypeFraisAction = action.handler(
  async (): Promise<ITypeFrais[]> => {
    const { branchId } = await requireBranchContext();
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
      statusType: type.statusType,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    }));
  },
);

export const getTypeFraisSettingsAction = action.handler(
  async (): Promise<ITypeFrais[]> => {
    const { branchId } = await requireBranchContext();
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
      statusType: type.statusType,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    }));
  },
);

export const createFraisAction = action
  .input(fraisSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const {
      nameFrais,
      montantFrais,
      statusFrais,
      classeId,
      typeFraisId,
      echeance,
      priority,
    } = input;

    const [currentYear, classe, typeFrais] = await Promise.all([
      getCurrentBranchSchoolYear(branchId),
      requireClasseInBranch(classeId, branchId),
      requireTypeFraisInBranch(typeFraisId, branchId),
    ]);

    const existFrais = await prisma.frais.findFirst({
      where: {
        branchId,
        nameFrais,
        classeId: classe.id,
        schoolYearId: currentYear.id,
      },
    });

    if (existFrais) {
      throw new Error("Ce frais existe deja pour cette classe");
    }

    const frais = await prisma.frais.create({
      data: {
        nameFrais,
        montantFrais,
        statusFrais: statusFrais ?? true,
        echeance,
        priority: priority ?? 99,
        classe: {
          connect: { id: classe.id },
        },
        typeFrais: {
          connect: { id: typeFrais.id },
        },
        schoolYear: {
          connect: { id: currentYear.id },
        },
        branch: {
          connect: { id: branchId },
        },
      },
      include: {
        classe: true,
        typeFrais: true,
        schoolYear: true,
      },
    });

    return mapFrais(frais);
  });

export const deleteFrais = action
  .input(deleteFraisSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();

    const frais = await prisma.frais.findFirst({
      where: {
        id: input.id,
        branchId,
      },
    });

    if (!frais) {
      throw new Error("Frais introuvable dans cette branche");
    }

    const paiements = await prisma.familyPayment.findMany({
      where: {
        fraisId: frais.id,
        branchId,
      },
    });

    if (paiements.length > 0) {
      throw new Error(
        "Impossible de supprimer ce frais car il a des paiements associes",
      );
    }

    const deletedFrais = await prisma.frais.delete({
      where: {
        id: frais.id,
      },
    });

    return {
      ...deletedFrais,
      montantFrais: Number(deletedFrais.montantFrais),
    };
  });

export const updateFraisAction = action
  .input(fraisSchema)
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
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

    return mapFrais(frais);
  });

export const getFraisAction = action.handler(async (): Promise<IFrais[]> => {
  const { branchId } = await requireBranchContext();
  const currentYear = await getCurrentBranchSchoolYear(branchId);

  const frais = await prisma.frais.findMany({
    where: {
      branchId,
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

export const getFraisByClassAction = action
  .input(z.object({ classeId: z.string() }))
  .handler(async ({ input }): Promise<IFrais[]> => {
    const { branchId } = await requireBranchContext();
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
    const { branchId } = await requireBranchContext();
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

    return await prisma.frais.update({
      where: { id },
      data: { statusFrais },
    });
  });

export const getFraisByStudent = action
  .input(z.object({ studentId: z.string() }))
  .handler(async ({ input }): Promise<IFrais[]> => {
    const { branchId } = await requireBranchContext();
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
    const { branchId } = await requireBranchContext();
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

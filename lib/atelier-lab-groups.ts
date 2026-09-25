import { prisma } from "@/lib/prisma";
import { isAtelierBranchType } from "@/lib/atelier-student-access";

export { buildAtelierLabGroupLabel } from "@/lib/atelier-lab-groups-shared";

/**
 * Vérifie qu'une classe source appartient à une branche école de la même org.
 */
export async function assertValidAtelierSourceClasse(params: {
  atelierBranchId: string;
  organizationId: string;
  sourceClasseId: string;
}) {
  const source = await prisma.classe.findFirst({
    where: { id: params.sourceClasseId },
    select: {
      id: true,
      nameClasse: true,
      branchId: true,
      branch: {
        select: {
          id: true,
          organizationId: true,
          typebranch: true,
        },
      },
    },
  });

  if (!source) {
    throw new Error("Classe source introuvable");
  }
  if (source.branch.organizationId !== params.organizationId) {
    throw new Error("La classe source doit appartenir à la même organisation");
  }
  if (String(source.branch.typebranch) !== "SECONDAIRE") {
    throw new Error("La classe source doit être une classe du secondaire");
  }
  if (source.branchId === params.atelierBranchId) {
    throw new Error("La classe source ne peut pas être un groupe atelier");
  }

  return source;
}

/**
 * Refuse d'inscrire un élève dans un groupe atelier s'il n'est pas
 * dans la classe source (année courante secondaire) ou si le groupe n'a pas de source.
 */
export async function assertStudentAllowedInAtelierGroup(params: {
  atelierClasseId: string;
  atelierBranchId: string;
  studentId: string;
  /** Conservé pour compat ; l'année source est résolue sur la branche de la classe source. */
  schoolYearId?: string;
}) {
  const atelierClasse = await prisma.classe.findFirst({
    where: {
      id: params.atelierClasseId,
      branchId: params.atelierBranchId,
    },
    select: {
      id: true,
      sourceClasseId: true,
      sourceClasse: {
        select: {
          id: true,
          nameClasse: true,
          branchId: true,
        },
      },
      branch: { select: { typebranch: true } },
    },
  });

  if (!atelierClasse) {
    throw new Error("Groupe atelier introuvable");
  }

  if (!isAtelierBranchType(atelierClasse.branch.typebranch)) {
    return; // hors atelier : pas de garde
  }

  if (!atelierClasse.sourceClasseId || !atelierClasse.sourceClasse) {
    throw new Error(
      "Ce groupe n'a pas de classe source : définissez-la avant d'inscrire des élèves",
    );
  }

  const sourceYear = await prisma.schoolYear.findFirst({
    where: {
      branchId: atelierClasse.sourceClasse.branchId,
      isCurrentYear: true,
      isArchived: false,
    },
    select: { id: true },
  });

  const sourceEnrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentId: params.studentId,
      classeId: atelierClasse.sourceClasseId,
      statusEnrollment: true,
      ...(sourceYear
        ? { schoolYearId: sourceYear.id }
        : {
            schoolYear: { isCurrentYear: true, isArchived: false },
          }),
    },
    select: { id: true },
  });

  if (!sourceEnrollment) {
    throw new Error(
      `Seuls les élèves de la classe « ${atelierClasse.sourceClasse.nameClasse} » peuvent être inscrits dans ce groupe`,
    );
  }
}

/**
 * Synchronise les inscriptions atelier depuis la classe source (année donnée).
 * N'ajoute que les élèves de la source ; désactive ceux qui n'y sont plus.
 */
export async function syncAtelierGroupEnrollmentsFromSource(params: {
  atelierClasseId: string;
  atelierBranchId: string;
  sourceClasseId: string;
  schoolYearId: string;
}) {
  const sourceEnrollments = await prisma.classEnrollment.findMany({
    where: {
      classeId: params.sourceClasseId,
      schoolYearId: params.schoolYearId,
      statusEnrollment: true,
    },
    select: { studentId: true },
  });
  const sourceStudentIds = new Set(sourceEnrollments.map((e) => e.studentId));

  const existing = await prisma.classEnrollment.findMany({
    where: {
      classeId: params.atelierClasseId,
      schoolYearId: params.schoolYearId,
    },
    select: { id: true, studentId: true, statusEnrollment: true },
  });

  const existingByStudent = new Map(
    existing.map((e) => [e.studentId, e] as const),
  );

  for (const studentId of sourceStudentIds) {
    const row = existingByStudent.get(studentId);
    if (!row) {
      await prisma.classEnrollment.create({
        data: {
          studentId,
          classeId: params.atelierClasseId,
          schoolYearId: params.schoolYearId,
          branchId: params.atelierBranchId,
          statusEnrollment: true,
        },
      });
    } else if (!row.statusEnrollment) {
      await prisma.classEnrollment.update({
        where: { id: row.id },
        data: { statusEnrollment: true },
      });
    }
  }

  for (const row of existing) {
    if (row.statusEnrollment && !sourceStudentIds.has(row.studentId)) {
      await prisma.classEnrollment.update({
        where: { id: row.id },
        data: { statusEnrollment: false },
      });
    }
  }

  return { synced: sourceStudentIds.size };
}

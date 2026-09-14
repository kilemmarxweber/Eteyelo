import { prisma } from "@/lib/prisma";
import {
  ensureUniqueIdentifier,
  generateCode,
} from "@/lib/generated-identifiers";

export type BranchStructureMergeSelection = {
  sections: boolean;
  options: boolean;
  cours: boolean;
  ponderations: boolean;
  classes: boolean;
  /** Types de frais + frais (année courante), rattachés aux classes de même nom/code. */
  frais: boolean;
};

export type BranchStructureMergeItemCounts = {
  sections: number;
  options: number;
  cours: number;
  ponderations: number;
  classes: number;
  typeFrais: number;
  frais: number;
};

export type BranchStructureMergeTargetResult = {
  targetBranchId: string;
  targetBranchName: string;
  created: BranchStructureMergeItemCounts;
  reused: BranchStructureMergeItemCounts;
};

function emptyCounts(): BranchStructureMergeItemCounts {
  return {
    sections: 0,
    options: 0,
    cours: 0,
    ponderations: 0,
    classes: 0,
    typeFrais: 0,
    frais: 0,
  };
}

function bump(
  counts: BranchStructureMergeItemCounts,
  key: keyof BranchStructureMergeItemCounts,
) {
  counts[key] += 1;
}

function norm(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function typeFraisMatchKey(params: {
  nameType: string;
  cycle?: string | null;
}) {
  return `${norm(params.nameType)}::${params.cycle ?? ""}`;
}

export function resolveMergeSelection(
  selection: BranchStructureMergeSelection,
): BranchStructureMergeSelection {
  const next = { ...selection };
  if (next.frais) {
    next.classes = true;
  }
  if (next.ponderations) {
    next.cours = true;
    next.options = true;
  }
  if (next.classes) {
    next.options = true;
  }
  if (next.options) {
    next.sections = true;
  }
  return next;
}

export function isMergeSelectionEmpty(selection: BranchStructureMergeSelection) {
  return !(
    selection.sections ||
    selection.options ||
    selection.cours ||
    selection.ponderations ||
    selection.classes ||
    selection.frais
  );
}

async function uniqueInBranch(params: {
  base: string;
  exists: (value: string) => boolean | Promise<boolean>;
}) {
  return ensureUniqueIdentifier({
    base: params.base.trim() || "ITEM",
    separator: "-",
    exists: async (value) => Boolean(await params.exists(value)),
  });
}

export async function previewBranchStructureMerge(params: {
  organizationId: string;
  sourceBranchId: string;
  targetBranchIds: string[];
}) {
  const source = await prisma.branch.findFirst({
    where: {
      id: params.sourceBranchId,
      organizationId: params.organizationId,
    },
    select: {
      id: true,
      name: true,
      typebranch: true,
      _count: {
        select: {
          section: true,
          option: true,
          cours: true,
          coursPonderations: true,
          classes: true,
          typeFrais: true,
          frais: true,
        },
      },
    },
  });

  if (!source) {
    throw new Error("Branche source introuvable dans cette organisation.");
  }

  const targets = await prisma.branch.findMany({
    where: {
      organizationId: params.organizationId,
      id: { in: params.targetBranchIds.filter((id) => id !== source.id) },
    },
    select: {
      id: true,
      name: true,
      typebranch: true,
      _count: {
        select: {
          section: true,
          option: true,
          cours: true,
          coursPonderations: true,
          classes: true,
          typeFrais: true,
          frais: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return {
    source: {
      id: source.id,
      name: source.name,
      typebranch: source.typebranch,
      counts: {
        sections: source._count.section,
        options: source._count.option,
        cours: source._count.cours,
        ponderations: source._count.coursPonderations,
        classes: source._count.classes,
        typeFrais: source._count.typeFrais,
        frais: source._count.frais,
      } satisfies BranchStructureMergeItemCounts,
    },
    targets: targets.map((target) => ({
      id: target.id,
      name: target.name,
      typebranch: target.typebranch,
      counts: {
        sections: target._count.section,
        options: target._count.option,
        cours: target._count.cours,
        ponderations: target._count.coursPonderations,
        classes: target._count.classes,
        typeFrais: target._count.typeFrais,
        frais: target._count.frais,
      } satisfies BranchStructureMergeItemCounts,
      typeMismatch: target.typebranch !== source.typebranch,
    })),
  };
}

export async function mergeBranchStructureToTargets(params: {
  organizationId: string;
  sourceBranchId: string;
  targetBranchIds: string[];
  selection: BranchStructureMergeSelection;
}): Promise<BranchStructureMergeTargetResult[]> {
  const selection = resolveMergeSelection(params.selection);
  if (isMergeSelectionEmpty(selection)) {
    throw new Error("Choisissez au moins un élément à copier.");
  }

  const uniqueTargets = [
    ...new Set(params.targetBranchIds.filter((id) => id !== params.sourceBranchId)),
  ];
  if (!uniqueTargets.length) {
    throw new Error("Choisissez au moins une branche destination.");
  }

  const source = await prisma.branch.findFirst({
    where: {
      id: params.sourceBranchId,
      organizationId: params.organizationId,
    },
    select: { id: true, name: true, organizationId: true },
  });
  if (!source) {
    throw new Error("Branche source introuvable dans cette organisation.");
  }

  const targets = await prisma.branch.findMany({
    where: {
      organizationId: params.organizationId,
      id: { in: uniqueTargets },
    },
    select: { id: true, name: true },
  });
  if (targets.length !== uniqueTargets.length) {
    throw new Error("Une branche destination n'appartient pas à cette organisation.");
  }

  const results: BranchStructureMergeTargetResult[] = [];
  for (const target of targets) {
    results.push(
      await mergeBranchStructure({
        sourceBranchId: source.id,
        targetBranchId: target.id,
        targetBranchName: target.name,
        selection,
      }),
    );
  }
  return results;
}

async function mergeBranchStructure(params: {
  sourceBranchId: string;
  targetBranchId: string;
  targetBranchName: string;
  selection: BranchStructureMergeSelection;
}): Promise<BranchStructureMergeTargetResult> {
  const created = emptyCounts();
  const reused = emptyCounts();

  const [
    sourceSections,
    sourceOptions,
    sourceCourses,
    sourcePonderations,
    sourceClasses,
    sourceCreneaux,
    sourceTypeFrais,
    sourceFrais,
    sourceCurrentYear,
    targetCurrentYear,
    sourceSemesters,
    targetSemesters,
  ] = await Promise.all([
    params.selection.sections
      ? prisma.section.findMany({ where: { branchId: params.sourceBranchId } })
      : Promise.resolve([]),
    params.selection.options
      ? prisma.option.findMany({ where: { branchId: params.sourceBranchId } })
      : Promise.resolve([]),
    params.selection.cours
      ? prisma.cours.findMany({ where: { branchId: params.sourceBranchId } })
      : Promise.resolve([]),
    params.selection.ponderations
      ? prisma.coursOptionPonderation.findMany({
          where: { branchId: params.sourceBranchId },
        })
      : Promise.resolve([]),
    params.selection.classes || params.selection.frais
      ? prisma.classe.findMany({ where: { branchId: params.sourceBranchId } })
      : Promise.resolve([]),
    params.selection.classes
      ? prisma.creneau.findMany({
          where: { branchId: params.sourceBranchId, isArchived: false },
        })
      : Promise.resolve([]),
    params.selection.frais
      ? prisma.typeFrais.findMany({ where: { branchId: params.sourceBranchId } })
      : Promise.resolve([]),
    params.selection.frais
      ? prisma.frais.findMany({
          where: {
            branchId: params.sourceBranchId,
            schoolYear: { isCurrentYear: true, isArchived: false },
          },
        })
      : Promise.resolve([]),
    params.selection.frais
      ? prisma.schoolYear.findFirst({
          where: {
            branchId: params.sourceBranchId,
            isCurrentYear: true,
            isArchived: false,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    params.selection.frais
      ? prisma.schoolYear.findFirst({
          where: {
            branchId: params.targetBranchId,
            isCurrentYear: true,
            isArchived: false,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    params.selection.frais
      ? prisma.semester.findMany({
          where: { branchId: params.sourceBranchId },
          select: { id: true, label: true, cycle: true },
        })
      : Promise.resolve([]),
    params.selection.frais
      ? prisma.semester.findMany({
          where: { branchId: params.targetBranchId },
          select: { id: true, label: true, cycle: true },
        })
      : Promise.resolve([]),
  ]);

  await prisma.$transaction(
    async (tx) => {
      const sectionIdBySource = new Map<string, string>();
      const optionIdBySource = new Map<string, string>();
      const coursIdBySource = new Map<string, string>();
      const creneauIdBySource = new Map<string, string>();
      const classeIdBySource = new Map<string, string>();
      const typeFraisIdBySource = new Map<string, string>();
      const semesterIdBySource = new Map<number, number>();

      for (const sourceSemester of sourceSemesters) {
        const match = targetSemesters.find(
          (item) =>
            item.cycle === sourceSemester.cycle &&
            norm(item.label) === norm(sourceSemester.label),
        );
        if (match) {
          semesterIdBySource.set(sourceSemester.id, match.id);
        }
      }

      if (params.selection.sections) {
        const targetSections = await tx.section.findMany({
          where: { branchId: params.targetBranchId },
        });
        for (const section of sourceSections) {
          const existing = targetSections.find(
            (item) =>
              norm(item.codeSection) === norm(section.codeSection) ||
              norm(item.nameSection) === norm(section.nameSection),
          );
          if (existing) {
            sectionIdBySource.set(section.id, existing.id);
            bump(reused, "sections");
            continue;
          }
          const codeSection = await uniqueInBranch({
            base: section.codeSection,
            exists: (value) =>
              targetSections.some((item) => norm(item.codeSection) === norm(value)),
          });
          const nameSection = await uniqueInBranch({
            base: section.nameSection,
            exists: (value) =>
              targetSections.some((item) => norm(item.nameSection) === norm(value)),
          });
          const createdSection = await tx.section.create({
            data: {
              branchId: params.targetBranchId,
              codeSection,
              nameSection,
              statusSection: true,
              cycle: section.cycle,
            },
          });
          targetSections.push(createdSection);
          sectionIdBySource.set(section.id, createdSection.id);
          bump(created, "sections");
        }
      }

      if (params.selection.options) {
        const targetOptions = await tx.option.findMany({
          where: { branchId: params.targetBranchId },
        });
        for (const option of sourceOptions) {
          const existing = targetOptions.find(
            (item) =>
              norm(item.codeOption) === norm(option.codeOption) ||
              norm(item.nameOption) === norm(option.nameOption),
          );
          if (existing) {
            optionIdBySource.set(option.id, existing.id);
            bump(reused, "options");
            continue;
          }
          const codeOption = await uniqueInBranch({
            base: option.codeOption,
            exists: (value) =>
              targetOptions.some((item) => norm(item.codeOption) === norm(value)),
          });
          const nameOption = await uniqueInBranch({
            base: option.nameOption,
            exists: (value) =>
              targetOptions.some((item) => norm(item.nameOption) === norm(value)),
          });
          const createdOption = await tx.option.create({
            data: {
              branchId: params.targetBranchId,
              codeOption,
              nameOption,
              statusOption: true,
              cycle: option.cycle,
              sectionId: option.sectionId
                ? (sectionIdBySource.get(option.sectionId) ?? null)
                : null,
            },
          });
          targetOptions.push(createdOption);
          optionIdBySource.set(option.id, createdOption.id);
          bump(created, "options");
        }
      }

      if (params.selection.cours) {
        const targetCourses = await tx.cours.findMany({
          where: { branchId: params.targetBranchId },
        });
        for (const course of sourceCourses) {
          const existing = targetCourses.find(
            (item) =>
              norm(item.codeCours) === norm(course.codeCours) ||
              norm(item.nameCours) === norm(course.nameCours),
          );
          if (existing) {
            coursIdBySource.set(course.id, existing.id);
            bump(reused, "cours");
            continue;
          }
          const codeCours = await uniqueInBranch({
            base: course.codeCours,
            exists: (value) =>
              targetCourses.some((item) => norm(item.codeCours) === norm(value)),
          });
          const nameCours = await uniqueInBranch({
            base: course.nameCours,
            exists: (value) =>
              targetCourses.some((item) => norm(item.nameCours) === norm(value)),
          });
          const createdCourse = await tx.cours.create({
            data: {
              branchId: params.targetBranchId,
              codeCours,
              nameCours,
              description: course.description,
              statusCours: course.statusCours ?? true,
              primaryDomain: course.primaryDomain,
              primarySection: course.primarySection,
              domainOrder: course.domainOrder,
            },
          });
          targetCourses.push(createdCourse);
          coursIdBySource.set(course.id, createdCourse.id);
          bump(created, "cours");
        }
      }

      if (params.selection.ponderations) {
        const targetPonderations = await tx.coursOptionPonderation.findMany({
          where: { branchId: params.targetBranchId },
          select: { coursId: true, optionId: true, level: true },
        });
        const seen = new Set(
          targetPonderations.map(
            (item) => `${item.coursId}::${item.optionId}::${item.level ?? ""}`,
          ),
        );
        for (const ponderation of sourcePonderations) {
          const coursId = coursIdBySource.get(ponderation.coursId);
          const optionId = optionIdBySource.get(ponderation.optionId);
          if (!coursId || !optionId) continue;
          const level = ponderation.level ?? "";
          const key = `${coursId}::${optionId}::${level}`;
          if (seen.has(key)) {
            bump(reused, "ponderations");
            continue;
          }
          await tx.coursOptionPonderation.create({
            data: {
              branchId: params.targetBranchId,
              coursId,
              optionId,
              level,
              ponderation: ponderation.ponderation,
            },
          });
          seen.add(key);
          bump(created, "ponderations");
        }
      }

      if (params.selection.classes) {
        const targetCreneaux = await tx.creneau.findMany({
          where: { branchId: params.targetBranchId },
        });
        for (const creneau of sourceCreneaux) {
          const existing = targetCreneaux.find(
            (item) => norm(item.nameCreneau) === norm(creneau.nameCreneau),
          );
          if (existing) {
            creneauIdBySource.set(creneau.id, existing.id);
            continue;
          }
          const nameCreneau = await uniqueInBranch({
            base: creneau.nameCreneau,
            exists: (value) =>
              targetCreneaux.some((item) => norm(item.nameCreneau) === norm(value)),
          });
          const createdCreneau = await tx.creneau.create({
            data: {
              branchId: params.targetBranchId,
              nameCreneau,
              startTime: creneau.startTime,
              endTime: creneau.endTime,
              durationCourse: creneau.durationCourse,
              recreationHour: creneau.recreationHour,
              recreationDuration: creneau.recreationDuration,
            },
          });
          targetCreneaux.push(createdCreneau);
          creneauIdBySource.set(creneau.id, createdCreneau.id);
        }

        const targetClasses = await tx.classe.findMany({
          where: { branchId: params.targetBranchId },
        });
        for (const classe of sourceClasses) {
          const existing = targetClasses.find(
            (item) =>
              norm(item.codeClasse) === norm(classe.codeClasse) ||
              norm(item.nameClasse) === norm(classe.nameClasse),
          );
          if (existing) {
            classeIdBySource.set(classe.id, existing.id);
            bump(reused, "classes");
            continue;
          }
          const codeClasse = await uniqueInBranch({
            base: classe.codeClasse,
            exists: (value) =>
              targetClasses.some((item) => norm(item.codeClasse) === norm(value)),
          });
          const nameClasse = await uniqueInBranch({
            base: classe.nameClasse,
            exists: (value) =>
              targetClasses.some((item) => norm(item.nameClasse) === norm(value)),
          });
          const createdClasse = await tx.classe.create({
            data: {
              branchId: params.targetBranchId,
              codeClasse,
              nameClasse,
              level: classe.level,
              parallel: classe.parallel,
              capacity: classe.capacity,
              statusClasse: true,
              horaireType: classe.horaireType,
              cycle: classe.cycle,
              optionId: classe.optionId
                ? (optionIdBySource.get(classe.optionId) ?? null)
                : null,
              creneauId: classe.creneauId
                ? (creneauIdBySource.get(classe.creneauId) ?? null)
                : null,
            },
          });
          targetClasses.push(createdClasse);
          classeIdBySource.set(classe.id, createdClasse.id);
          bump(created, "classes");
        }
      }

      if (params.selection.frais) {
        if (!sourceCurrentYear || !targetCurrentYear) {
          throw new Error(
            `Impossible de copier les frais : année scolaire courante manquante (${
              !sourceCurrentYear ? "source" : "destination"
            }).`,
          );
        }

        const targetTypes = await tx.typeFrais.findMany({
          where: { branchId: params.targetBranchId },
        });
        for (const type of sourceTypeFrais) {
          const existing = targetTypes.find(
            (item) =>
              typeFraisMatchKey(item) ===
              typeFraisMatchKey({
                nameType: type.nameType,
                cycle: type.cycle,
              }),
          );
          if (existing) {
            typeFraisIdBySource.set(type.id, existing.id);
            bump(reused, "typeFrais");
            continue;
          }
          const codeType = await ensureUniqueIdentifier({
            base: generateCode(type.nameType, "TYPE", 16),
            separator: "-",
            exists: async (value) =>
              Boolean(
                await tx.typeFrais.findUnique({
                  where: { codeType: value },
                  select: { id: true },
                }),
              ),
          });
          const createdType = await tx.typeFrais.create({
            data: {
              branchId: params.targetBranchId,
              codeType,
              nameType: type.nameType,
              description: type.description,
              statusType: type.statusType,
              cycle: type.cycle,
            },
          });
          targetTypes.push(createdType);
          typeFraisIdBySource.set(type.id, createdType.id);
          bump(created, "typeFrais");
        }

        // Si classes n'était pas sélectionné mais frais oui, mapper les classes existantes.
        if (classeIdBySource.size === 0 && sourceClasses.length > 0) {
          const targetClasses = await tx.classe.findMany({
            where: { branchId: params.targetBranchId },
          });
          for (const classe of sourceClasses) {
            const existing = targetClasses.find(
              (item) =>
                norm(item.codeClasse) === norm(classe.codeClasse) ||
                norm(item.nameClasse) === norm(classe.nameClasse),
            );
            if (existing) {
              classeIdBySource.set(classe.id, existing.id);
            }
          }
        }

        const targetFrais = await tx.frais.findMany({
          where: {
            branchId: params.targetBranchId,
            schoolYearId: targetCurrentYear.id,
          },
          select: { classeId: true, nameFrais: true },
        });
        const existingFeeKeys = new Set(
          targetFrais.map(
            (row) => `${row.classeId}::${norm(row.nameFrais)}`,
          ),
        );

        for (const fee of sourceFrais) {
          const classeId = classeIdBySource.get(fee.classeId);
          const typeFraisId = typeFraisIdBySource.get(fee.typeFraisId);
          if (!classeId || !typeFraisId) {
            bump(reused, "frais");
            continue;
          }
          const key = `${classeId}::${norm(fee.nameFrais)}`;
          if (existingFeeKeys.has(key)) {
            bump(reused, "frais");
            continue;
          }
          await tx.frais.create({
            data: {
              branchId: params.targetBranchId,
              nameFrais: fee.nameFrais,
              montantFrais: fee.montantFrais,
              statusFrais: fee.statusFrais,
              classeId,
              typeFraisId,
              echeance: fee.echeance,
              schoolYearId: targetCurrentYear.id,
              priority: fee.priority,
              isOptional: fee.isOptional,
              semesterId: fee.semesterId
                ? (semesterIdBySource.get(fee.semesterId) ?? null)
                : null,
              fraisGroupKey: fee.fraisGroupKey,
            },
          });
          existingFeeKeys.add(key);
          bump(created, "frais");
        }
      }
    },
    { timeout: 120_000 },
  );

  return {
    targetBranchId: params.targetBranchId,
    targetBranchName: params.targetBranchName,
    created,
    reused,
  };
}

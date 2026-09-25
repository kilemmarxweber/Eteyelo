import {
  getAcademicPeriodKey,
  normalizeBranchType,
} from "@/lib/academic-structure";
import { normalizeEducationSystem } from "@/lib/education-system";
import { activeCoursStatusFilter } from "@/lib/active-cours";
import { gradeableCoursFilter } from "@/lib/cours-components";
import { prisma } from "@/lib/prisma";
import {
  ATELIER_LINK_PERIOD_AUTO,
  isAtelierPeriodAuto,
  listSecondaryPeriodOptions,
  periodLabelForKey,
  secondaryOptionKey,
  type AtelierCourseLinkView,
  type AtelierLinkOptions,
  type AtelierLinkSecondaryClassOption,
  type AtelierLinkSecondaryCourseOption,
} from "@/lib/atelier-course-link-shared";
import { configuredCoursIdsForClass } from "@/lib/course-ponderation-shared";

export {
  ATELIER_LINK_PERIOD_AUTO,
  isAtelierPeriodAuto,
  listSecondaryPeriodOptions,
  periodLabelForKey,
  secondaryOptionKey,
  courseMatchesSecondaryClass,
  filterCoursesForSecondaryClass,
  type AtelierCourseLinkView,
  type AtelierLinkOptions,
  type AtelierLinkSecondaryClassOption,
  type AtelierLinkSecondaryCourseOption,
} from "@/lib/atelier-course-link-shared";

export type FicheNoteContribution = {
  studentId: string;
  nom?: string;
  studentSurname?: string;
  studentusername?: string;
  studentSexe?: string;
  score?: number | null;
  maxScore?: number | null;
};

export type AtelierBridgeIntervention = {
  id: string;
  typeFiche: string;
  dateCreated: string;
  teacherName: string;
  status: boolean;
  notesCount: number;
  averageScore: number | null;
  sourceLabel: string;
};

/**
 * Première période secondaire non encore close pour ce cours :
 * fiche de cote validée (status=true), gradesGenerated, ou PeriodResultLock.
 * Sinon la dernière période du catalogue.
 */
export async function resolveActiveSecondaryPeriodKey(params: {
  secondaryBranchId: string;
  secondaryCoursId: string;
  schoolYearId?: string | null;
}): Promise<{ key: string; label: string } | null> {
  const branch = await prisma.branch.findFirst({
    where: { id: params.secondaryBranchId, typebranch: "SECONDAIRE" },
    select: { id: true, educationSystem: true },
  });
  if (!branch) return null;

  const educationSystem = normalizeEducationSystem(branch.educationSystem);
  const catalog = listSecondaryPeriodOptions(educationSystem);
  if (!catalog.length) return null;

  const yearId =
    params.schoolYearId ??
    (
      await prisma.schoolYear.findFirst({
        where: {
          branchId: branch.id,
          isCurrentYear: true,
          isArchived: false,
        },
        select: { id: true },
      })
    )?.id ??
    null;

  const dbPeriods = await prisma.period.findMany({
    where: {
      branchId: branch.id,
      cycle: "SECONDAIRE",
    },
    select: {
      id: true,
      label: true,
      gradesGenerated: true,
    },
  });

  const locks = await prisma.periodResultLock.findMany({
    where: {
      branchId: branch.id,
      periodId: { in: dbPeriods.map((p) => p.id) },
    },
    select: { periodId: true, status: true },
  });
  const lockByPeriodId = new Map(
    locks.map((row) => [row.periodId, row.status] as const),
  );

  const periodsByKey = new Map<string, typeof dbPeriods>();
  for (const row of dbPeriods) {
    const key = getAcademicPeriodKey(row.label, "SECONDAIRE", educationSystem);
    if (!key) continue;
    const list = periodsByKey.get(key) ?? [];
    list.push(row);
    periodsByKey.set(key, list);
  }

  for (const entry of catalog) {
    const rows = periodsByKey.get(entry.key) ?? [];
    const periodIds = rows.map((r) => r.id);

    const lockedByGrades = rows.some((r) => {
      const lockStatus = lockByPeriodId.get(r.id)?.toLowerCase() ?? "";
      const locked =
        Boolean(lockStatus) &&
        lockStatus !== "open" &&
        lockStatus !== "unlocked";
      return r.gradesGenerated || locked;
    });

    let coteValidated = false;
    if (periodIds.length) {
      const validated = await prisma.fiche.findFirst({
        where: {
          branchId: branch.id,
          typeFiche: "ficheCote",
          status: true,
          periodId: { in: periodIds },
          lesson: { coursId: params.secondaryCoursId },
          ...(yearId ? { anneeId: yearId } : {}),
        },
        select: { id: true },
      });
      coteValidated = Boolean(validated);
    }

    if (!lockedByGrades && !coteValidated) {
      return { key: entry.key, label: entry.label };
    }
  }

  const last = catalog[catalog.length - 1]!;
  return { key: last.key, label: last.label };
}

/**
 * Options UI atelier → secondaire :
 * - uniquement des cours SUBJECT de branches SECONDAIRE
 * - pondérés sur une option secondaire (exclut maternelle / primaire)
 * - classes secondaires pour filtrer le curriculum
 * - priorité aux branches sources déjà liées (élèves importés)
 */
export async function getAtelierLinkOptionsForOrganization(params: {
  organizationId: string;
  atelierBranchId: string;
}): Promise<AtelierLinkOptions> {
  const linkedSourceBranchIds = (
    await prisma.studentBranchLink.findMany({
      where: {
        targetBranchId: params.atelierBranchId,
        isActive: true,
        sourceBranch: { typebranch: "SECONDAIRE", isActive: true },
      },
      select: { sourceBranchId: true },
      distinct: ["sourceBranchId"],
    })
  ).map((row) => row.sourceBranchId);

  const secondaryBranches = await prisma.branch.findMany({
    where: {
      organizationId: params.organizationId,
      typebranch: "SECONDAIRE",
      isActive: true,
      id: linkedSourceBranchIds.length
        ? { in: linkedSourceBranchIds }
        : { not: params.atelierBranchId },
    },
    select: {
      id: true,
      name: true,
      educationSystem: true,
    },
    orderBy: { name: "asc" },
  });

  const secondaryBranchIds = secondaryBranches.map((b) => b.id);
  const empty: AtelierLinkOptions = {
    courses: [],
    classes: [],
    periodsByBranchId: {},
  };
  if (!secondaryBranchIds.length) return empty;

  const [ponderations, classesRows, coursRows] = await Promise.all([
    prisma.coursOptionPonderation.findMany({
      where: {
        branchId: { in: secondaryBranchIds },
        option: {
          OR: [
            { cycle: "SECONDAIRE" },
            {
              cycle: null,
              section: { cycle: "SECONDAIRE" },
            },
            {
              cycle: null,
              section: { cycle: null },
              branch: { typebranch: "SECONDAIRE" },
            },
          ],
          NOT: {
            OR: [
              { cycle: "MATERNELLE" },
              { cycle: "PRIMAIRE" },
              { section: { cycle: "MATERNELLE" } },
              { section: { cycle: "PRIMAIRE" } },
            ],
          },
        },
      },
      select: {
        coursId: true,
        optionId: true,
        level: true,
      },
    }),
    prisma.classe.findMany({
      where: {
        branchId: { in: secondaryBranchIds },
        statusClasse: { not: false },
        OR: [{ cycle: "SECONDAIRE" }, { cycle: null }],
        NOT: {
          OR: [{ cycle: "MATERNELLE" }, { cycle: "PRIMAIRE" }],
        },
      },
      select: {
        id: true,
        nameClasse: true,
        level: true,
        optionId: true,
        option: { select: { nameOption: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ nameClasse: "asc" }],
    }),
    prisma.cours.findMany({
      where: {
        branchId: { in: secondaryBranchIds },
        ...activeCoursStatusFilter,
        ...gradeableCoursFilter,
      },
      select: {
        id: true,
        nameCours: true,
        codeCours: true,
        branchId: true,
      },
      orderBy: { nameCours: "asc" },
    }),
  ]);

  const optionKeysByCours = new Map<string, Set<string>>();
  for (const row of ponderations) {
    let set = optionKeysByCours.get(row.coursId);
    if (!set) {
      set = new Set();
      optionKeysByCours.set(row.coursId, set);
    }
    set.add(secondaryOptionKey(row.optionId, row.level));
  }

  const branchNameById = new Map(
    secondaryBranches.map((b) => [b.id, b.name] as const),
  );

  const courses: AtelierLinkSecondaryCourseOption[] = [];
  for (const cours of coursRows) {
    const keys = optionKeysByCours.get(cours.id);
    if (!keys?.size) continue; // pas de pondération secondaire → exclu (maternelle/primaire seuls)
    const branchName = branchNameById.get(cours.branchId) ?? "";
    courses.push({
      id: cours.id,
      nameCours: cours.nameCours,
      codeCours: cours.codeCours,
      branchId: cours.branchId,
      branchName,
      label: `${cours.nameCours} · ${branchName}`,
      secondaryOptionKeys: [...keys],
    });
  }

  courses.sort((a, b) => {
    const byName = a.nameCours.localeCompare(b.nameCours, "fr");
    if (byName !== 0) return byName;
    return a.branchName.localeCompare(b.branchName, "fr");
  });

  const courseBranchIds = new Set(courses.map((c) => c.branchId));

  const periodsByBranchId: AtelierLinkOptions["periodsByBranchId"] = {};
  for (const branch of secondaryBranches) {
    periodsByBranchId[branch.id] = listSecondaryPeriodOptions(
      branch.educationSystem,
    );
  }

  const classes: AtelierLinkSecondaryClassOption[] = classesRows
    .map((c) => {
      const optionName = c.option?.nameOption?.trim() || "—";
      const configuredCoursIds = configuredCoursIdsForClass(ponderations, {
        optionId: c.optionId,
        level: c.level,
      }).filter((coursId) => optionKeysByCours.has(coursId));
      return {
        id: c.id,
        branchId: c.branch.id,
        optionId: c.optionId,
        level: c.level,
        label: `${c.nameClasse} · ${optionName} · ${c.branch.name}`,
        configuredCoursIds,
      };
    })
    // Uniquement les écoles qui ont au moins un cours secondaire listable
    .filter((c) => courseBranchIds.has(c.branchId));

  return { courses, classes, periodsByBranchId };
}

export async function getAtelierCourseLinkForCours(
  atelierCoursId: string,
): Promise<AtelierCourseLinkView | null> {
  const link = await prisma.atelierCourseLink.findUnique({
    where: { atelierCoursId },
    include: {
      secondaryCours: { select: { id: true, nameCours: true } },
      secondaryBranch: {
        select: {
          id: true,
          name: true,
          educationSystem: true,
          typebranch: true,
        },
      },
    },
  });
  if (!link) return null;

  const typebranch = normalizeBranchType(link.secondaryBranch.typebranch);
  const educationSystem = normalizeEducationSystem(
    link.secondaryBranch.educationSystem,
  );
  const auto = isAtelierPeriodAuto(link.targetPeriodKey);
  const active = auto
    ? await resolveActiveSecondaryPeriodKey({
        secondaryBranchId: link.secondaryBranchId,
        secondaryCoursId: link.secondaryCoursId,
      })
    : null;

  const effectiveLabel = auto
    ? active
      ? `${active.label} (auto)`
      : "Période active (auto)"
    : periodLabelForKey(
        link.targetPeriodKey,
        typebranch === "SECONDAIRE" ? "SECONDAIRE" : typebranch,
        educationSystem,
      );

  return {
    secondaryCoursId: link.secondaryCoursId,
    secondaryCoursName: link.secondaryCours.nameCours,
    secondaryBranchId: link.secondaryBranchId,
    secondaryBranchName: link.secondaryBranch.name,
    targetPeriodKey: link.targetPeriodKey,
    targetPeriodLabel: effectiveLabel,
    activePeriodKey: active?.key ?? (auto ? null : link.targetPeriodKey),
    activePeriodLabel: active?.label ?? (auto ? null : effectiveLabel),
    isPeriodAuto: auto,
  };
}

export async function upsertAtelierCourseLink(params: {
  atelierBranchId: string;
  organizationId: string;
  atelierCoursId: string;
  secondaryCoursId: string | null | undefined;
  secondaryBranchId: string | null | undefined;
  /** null / undefined / AUTO → période active automatique. */
  targetPeriodKey: string | null | undefined;
}) {
  const secondaryCoursId = params.secondaryCoursId?.trim() || null;
  const secondaryBranchId = params.secondaryBranchId?.trim() || null;
  const rawPeriod = params.targetPeriodKey?.trim() || null;
  const targetPeriodKey: string = isAtelierPeriodAuto(rawPeriod)
    ? ATELIER_LINK_PERIOD_AUTO
    : rawPeriod!;

  const atelierCours = await prisma.cours.findFirst({
    where: { id: params.atelierCoursId, branchId: params.atelierBranchId },
    select: { id: true },
  });
  if (!atelierCours) {
    throw new Error("Cours atelier introuvable dans cette branche");
  }

  if (!secondaryCoursId && !secondaryBranchId) {
    await prisma.atelierCourseLink.deleteMany({
      where: { atelierCoursId: params.atelierCoursId },
    });
    return null;
  }

  if (!secondaryCoursId || !secondaryBranchId) {
    throw new Error("Pour associer l'atelier, choisissez un cours secondaire.");
  }

  const secondaryBranch = await prisma.branch.findFirst({
    where: {
      id: secondaryBranchId,
      organizationId: params.organizationId,
      typebranch: "SECONDAIRE",
      isActive: true,
    },
    select: { id: true, educationSystem: true },
  });
  if (!secondaryBranch) {
    throw new Error("Branche secondaire introuvable dans l'organisation");
  }

  const secondaryCours = await prisma.cours.findFirst({
    where: {
      id: secondaryCoursId,
      branchId: secondaryBranch.id,
      ...gradeableCoursFilter,
    },
    select: { id: true },
  });
  if (!secondaryCours) {
    throw new Error("Cours secondaire introuvable dans la branche choisie");
  }

  if (targetPeriodKey !== ATELIER_LINK_PERIOD_AUTO) {
    const validKeys = new Set(
      listSecondaryPeriodOptions(secondaryBranch.educationSystem).map(
        (p) => p.key,
      ),
    );
    if (!validKeys.has(targetPeriodKey)) {
      throw new Error("Période secondaire cible invalide");
    }
  }

  return prisma.atelierCourseLink.upsert({
    where: { atelierCoursId: params.atelierCoursId },
    create: {
      atelierCoursId: params.atelierCoursId,
      secondaryCoursId,
      secondaryBranchId: secondaryBranch.id,
      targetPeriodKey,
    },
    update: {
      secondaryCoursId,
      secondaryBranchId: secondaryBranch.id,
      targetPeriodKey,
    },
  });
}

async function resolveMatchingAtelierSchoolYearId(params: {
  atelierBranchId: string;
  secondarySchoolYearId: string;
}): Promise<string | null> {
  const secondaryYear = await prisma.schoolYear.findFirst({
    where: { id: params.secondarySchoolYearId },
    select: {
      nameYear: true,
      startYear: true,
      endYear: true,
      isCurrentYear: true,
    },
  });
  if (!secondaryYear) return null;

  const byName = await prisma.schoolYear.findFirst({
    where: {
      branchId: params.atelierBranchId,
      nameYear: secondaryYear.nameYear,
      isArchived: false,
    },
    select: { id: true },
  });
  if (byName) return byName.id;

  if (secondaryYear.isCurrentYear) {
    const current = await prisma.schoolYear.findFirst({
      where: {
        branchId: params.atelierBranchId,
        isCurrentYear: true,
        isArchived: false,
      },
      select: { id: true },
    });
    if (current) return current.id;
  }

  const overlapping = await prisma.schoolYear.findFirst({
    where: {
      branchId: params.atelierBranchId,
      isArchived: false,
      startYear: { lte: secondaryYear.endYear },
      endYear: { gte: secondaryYear.startYear },
    },
    orderBy: { startYear: "desc" },
    select: { id: true },
  });
  return overlapping?.id ?? null;
}

/**
 * Récupère les notes intermédiaires atelier à fusionner dans la fiche centrale
 * d'un cours secondaire pour la période ciblée par AtelierCourseLink.
 * Liens AUTO : inclus uniquement pour la période active (avance après validation).
 */
export async function collectLinkedAtelierContributions(params: {
  secondaryBranchId: string;
  secondaryCoursId: string;
  secondaryPeriodId: number;
  secondaryPeriodLabel: string;
  secondaryAnneeId: string;
  secondaryClassId: string;
  educationSystem?: unknown;
}): Promise<{
  notes: FicheNoteContribution[];
  interventions: AtelierBridgeIntervention[];
}> {
  const periodKey = getAcademicPeriodKey(
    params.secondaryPeriodLabel,
    "SECONDAIRE",
    params.educationSystem,
  );
  if (!periodKey) {
    return { notes: [], interventions: [] };
  }

  const candidateLinks = await prisma.atelierCourseLink.findMany({
    where: {
      secondaryCoursId: params.secondaryCoursId,
      secondaryBranchId: params.secondaryBranchId,
      OR: [
        { targetPeriodKey: periodKey },
        { targetPeriodKey: ATELIER_LINK_PERIOD_AUTO },
      ],
    },
    include: {
      atelierCours: {
        select: {
          id: true,
          nameCours: true,
          branchId: true,
          branch: { select: { name: true } },
        },
      },
    },
  });

  const links = [];
  for (const link of candidateLinks) {
    if (link.targetPeriodKey === periodKey) {
      links.push(link);
      continue;
    }
    if (!isAtelierPeriodAuto(link.targetPeriodKey)) continue;
    const active = await resolveActiveSecondaryPeriodKey({
      secondaryBranchId: params.secondaryBranchId,
      secondaryCoursId: params.secondaryCoursId,
      schoolYearId: params.secondaryAnneeId,
    });
    if (active?.key === periodKey) {
      links.push(link);
    }
  }

  if (!links.length) {
    return { notes: [], interventions: [] };
  }

  const classStudentIds = new Set(
    (
      await prisma.classEnrollment.findMany({
        where: {
          branchId: params.secondaryBranchId,
          classeId: params.secondaryClassId,
          schoolYearId: params.secondaryAnneeId,
        },
        select: { studentId: true },
      })
    ).map((row) => row.studentId),
  );

  if (!classStudentIds.size) {
    return { notes: [], interventions: [] };
  }

  const allNotes: FicheNoteContribution[] = [];
  const interventions: AtelierBridgeIntervention[] = [];

  for (const link of links) {
    const atelierBranchId = link.atelierCours.branchId;
    const atelierYearId = await resolveMatchingAtelierSchoolYearId({
      atelierBranchId,
      secondarySchoolYearId: params.secondaryAnneeId,
    });
    if (!atelierYearId) continue;

    const linkedStudentIds = new Set(
      (
        await prisma.studentBranchLink.findMany({
          where: {
            targetBranchId: atelierBranchId,
            sourceBranchId: params.secondaryBranchId,
            isActive: true,
            studentId: { in: [...classStudentIds] },
          },
          select: { studentId: true },
        })
      ).map((row) => row.studentId),
    );
    if (!linkedStudentIds.size) continue;

    const teachings = await prisma.teaching.findMany({
      where: {
        branchId: atelierBranchId,
        coursId: link.atelierCoursId,
        schoolYearId: atelierYearId,
      },
      select: { id: true },
    });
    if (!teachings.length) continue;

    const fiches = await prisma.fiche.findMany({
      where: {
        branchId: atelierBranchId,
        lessonId: { in: teachings.map((t) => t.id) },
        anneeId: atelierYearId,
        NOT: { typeFiche: "ficheCote" },
      },
      include: {
        teacher: {
          include: {
            branchMember: {
              include: {
                member: {
                  include: { user: true },
                },
              },
            },
          },
        },
      },
      orderBy: { dateCreated: "asc" },
    });

    const sourceLabel = `${link.atelierCours.branch.name} · ${link.atelierCours.nameCours}`;

    for (const fiche of fiches) {
      let notes: FicheNoteContribution[] = [];
      try {
        notes = fiche.notes ? JSON.parse(fiche.notes) : [];
      } catch {
        notes = [];
      }

      const relevant = notes.filter(
        (note) =>
          linkedStudentIds.has(note.studentId) &&
          classStudentIds.has(note.studentId),
      );
      if (!relevant.length) continue;

      allNotes.push(...relevant);

      const scored = relevant.filter((note) => note.score != null);
      const averageScore =
        scored.length > 0
          ? scored.reduce((sum, note) => sum + Number(note.score ?? 0), 0) /
            scored.length
          : null;

      interventions.push({
        id: `atelier:${fiche.id}`,
        typeFiche: `${fiche.typeFiche} (atelier)`,
        dateCreated:
          fiche.dateCreated &&
          !Number.isNaN(new Date(fiche.dateCreated).getTime())
            ? new Date(fiche.dateCreated).toISOString()
            : "",
        teacherName:
          fiche.teacher?.branchMember?.member?.user?.name ?? "N/A",
        status: fiche.status,
        notesCount: relevant.length,
        averageScore:
          averageScore == null ? null : Number(averageScore.toFixed(2)),
        sourceLabel,
      });
    }
  }

  return { notes: allNotes, interventions };
}

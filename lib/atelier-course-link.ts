import {
  getAcademicPeriodKey,
  getAcademicStructure,
  normalizeBranchType,
  type ManagedBranchType,
} from "@/lib/academic-structure";
import { normalizeEducationSystem } from "@/lib/education-system";
import { activeCoursStatusFilter } from "@/lib/active-cours";
import { gradeableCoursFilter } from "@/lib/cours-components";
import { prisma } from "@/lib/prisma";

export type AtelierLinkSecondaryCourseOption = {
  id: string;
  nameCours: string;
  codeCours: string;
  branchId: string;
  branchName: string;
};

export type AtelierLinkOptions = {
  /** Cours SUBJECT des branches SECONDAIRE uniquement (jamais domaines bulletin). */
  courses: AtelierLinkSecondaryCourseOption[];
  periodsByBranchId: Record<string, Array<{ key: string; label: string }>>;
};

export type AtelierCourseLinkView = {
  secondaryCoursId: string;
  secondaryCoursName: string;
  secondaryBranchId: string;
  secondaryBranchName: string;
  targetPeriodKey: string;
  targetPeriodLabel: string;
};

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

function periodLabelForKey(
  key: string,
  typebranch: ManagedBranchType,
  educationSystem: unknown,
): string {
  const structure = getAcademicStructure(typebranch, educationSystem);
  return structure.periods.find((period) => period.key === key)?.label ?? key;
}

export function listSecondaryPeriodOptions(educationSystem?: unknown) {
  const structure = getAcademicStructure("SECONDAIRE", educationSystem);
  return structure.periods.map((period) => ({
    key: period.key,
    label: period.label,
  }));
}

/**
 * Options UI atelier → secondaire :
 * - uniquement des cours SUBJECT de branches SECONDAIRE
 * - priorité aux branches sources déjà liées (élèves importés)
 * - pas de domaines bulletin
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
      cours: {
        where: {
          ...activeCoursStatusFilter,
          ...gradeableCoursFilter,
        },
        select: { id: true, nameCours: true, codeCours: true },
        orderBy: { nameCours: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const courses: AtelierLinkSecondaryCourseOption[] = [];
  const periodsByBranchId: AtelierLinkOptions["periodsByBranchId"] = {};

  for (const branch of secondaryBranches) {
    periodsByBranchId[branch.id] = listSecondaryPeriodOptions(
      branch.educationSystem,
    );
    for (const cours of branch.cours) {
      courses.push({
        id: cours.id,
        nameCours: cours.nameCours,
        codeCours: cours.codeCours,
        branchId: branch.id,
        branchName: branch.name,
      });
    }
  }

  courses.sort((a, b) => {
    const byName = a.nameCours.localeCompare(b.nameCours, "fr");
    if (byName !== 0) return byName;
    return a.branchName.localeCompare(b.branchName, "fr");
  });

  return { courses, periodsByBranchId };
}

export async function getAtelierCourseLinkForCours(
  atelierCoursId: string,
): Promise<AtelierCourseLinkView | null> {
  const link = await prisma.atelierCourseLink.findUnique({
    where: { atelierCoursId },
    include: {
      secondaryCours: { select: { id: true, nameCours: true } },
      secondaryBranch: {
        select: { id: true, name: true, educationSystem: true, typebranch: true },
      },
    },
  });
  if (!link) return null;

  const typebranch = normalizeBranchType(link.secondaryBranch.typebranch);
  const educationSystem = normalizeEducationSystem(
    link.secondaryBranch.educationSystem,
  );

  return {
    secondaryCoursId: link.secondaryCoursId,
    secondaryCoursName: link.secondaryCours.nameCours,
    secondaryBranchId: link.secondaryBranchId,
    secondaryBranchName: link.secondaryBranch.name,
    targetPeriodKey: link.targetPeriodKey,
    targetPeriodLabel: periodLabelForKey(
      link.targetPeriodKey,
      typebranch === "SECONDAIRE" ? "SECONDAIRE" : typebranch,
      educationSystem,
    ),
  };
}

export async function upsertAtelierCourseLink(params: {
  atelierBranchId: string;
  organizationId: string;
  atelierCoursId: string;
  secondaryCoursId: string | null | undefined;
  secondaryBranchId: string | null | undefined;
  targetPeriodKey: string | null | undefined;
}) {
  const secondaryCoursId = params.secondaryCoursId?.trim() || null;
  const secondaryBranchId = params.secondaryBranchId?.trim() || null;
  const targetPeriodKey = params.targetPeriodKey?.trim() || null;

  const atelierCours = await prisma.cours.findFirst({
    where: { id: params.atelierCoursId, branchId: params.atelierBranchId },
    select: { id: true },
  });
  if (!atelierCours) {
    throw new Error("Cours atelier introuvable dans cette branche");
  }

  if (!secondaryCoursId && !secondaryBranchId && !targetPeriodKey) {
    await prisma.atelierCourseLink.deleteMany({
      where: { atelierCoursId: params.atelierCoursId },
    });
    return null;
  }

  if (!secondaryCoursId || !secondaryBranchId || !targetPeriodKey) {
    throw new Error(
      "Pour associer l'atelier, choisissez la branche, le cours et la période secondaire.",
    );
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

  const validKeys = new Set(
    listSecondaryPeriodOptions(secondaryBranch.educationSystem).map((p) => p.key),
  );
  if (!validKeys.has(targetPeriodKey)) {
    throw new Error("Période secondaire cible invalide");
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

  const links = await prisma.atelierCourseLink.findMany({
    where: {
      secondaryCoursId: params.secondaryCoursId,
      secondaryBranchId: params.secondaryBranchId,
      targetPeriodKey: periodKey,
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

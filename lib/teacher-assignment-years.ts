import { prisma } from "@/lib/prisma";

export type TeacherParcoursItem = {
  courseName: string;
  className: string;
  classCode: string;
  level: string | null;
  titulaire: boolean;
};

export type TeacherParcoursYear = {
  yearId: string;
  yearLabel: string;
  startYear: string;
  isCurrent: boolean;
  items: TeacherParcoursItem[];
  subjects: string[];
  levels: string[];
};

export type TeacherAssignmentSnapshot = {
  count: number;
  yearLabels: string[];
  /** Matières des affectations de l'année en cours (sinon []). */
  currentSubjects: string[];
  currentLevels: string[];
  /** Affecté sur l'année scolaire en cours. */
  assignedToCurrentYear: boolean;
  hasCurrentAssignment: boolean;
  parcours: TeacherParcoursYear[];
};

function teachingScope(teacherId: string, branchId: string) {
  return {
    teacherId,
    AND: [
      {
        OR: [
          { branchId },
          { branchId: null, classe: { branchId } },
        ],
      },
      {
        OR: [{ statusTeaching: true }, { statusTeaching: null }],
      },
    ],
  };
}

/**
 * Snapshot affectations : années, matières/niveaux actuels, parcours année par année.
 */
export async function getTeacherAssignmentSnapshot(params: {
  teacherId: string;
  branchId: string;
}): Promise<TeacherAssignmentSnapshot> {
  const rows = await prisma.teaching.findMany({
    where: teachingScope(params.teacherId, params.branchId),
    select: {
      titulaire: true,
      schoolYear: {
        select: {
          id: true,
          nameYear: true,
          startYear: true,
          isCurrentYear: true,
        },
      },
      cours: { select: { nameCours: true } },
      classe: {
        select: { nameClasse: true, codeClasse: true, level: true },
      },
    },
    orderBy: [{ schoolYear: { startYear: "asc" } }],
  });

  const byYear = new Map<
    string,
    {
      yearLabel: string;
      startYear: Date;
      isCurrent: boolean;
      items: TeacherParcoursItem[];
    }
  >();

  for (const row of rows) {
    const year = row.schoolYear;
    if (!year) continue;
    const courseName = row.cours?.nameCours?.trim();
    if (!courseName) continue;

    let bucket = byYear.get(year.id);
    if (!bucket) {
      bucket = {
        yearLabel: year.nameYear,
        startYear: year.startYear,
        isCurrent: Boolean(year.isCurrentYear),
        items: [],
      };
      byYear.set(year.id, bucket);
    }

    bucket.items.push({
      courseName,
      className: row.classe?.nameClasse?.trim() || "Classe",
      classCode: row.classe?.codeClasse?.trim() || "",
      level: row.classe?.level?.trim() || null,
      titulaire: Boolean(row.titulaire),
    });
  }

  const parcours: TeacherParcoursYear[] = [...byYear.entries()]
    .map(([yearId, bucket]) => {
      const subjects = uniqueSorted(
        bucket.items.map((item) => item.courseName),
      );
      const levels = uniqueSorted(
        bucket.items
          .map((item) => item.level || item.className)
          .filter(Boolean),
      );
      return {
        yearId,
        yearLabel: bucket.yearLabel,
        startYear: bucket.startYear.toISOString(),
        isCurrent: bucket.isCurrent,
        items: bucket.items.sort((a, b) =>
          a.courseName.localeCompare(b.courseName, "fr"),
        ),
        subjects,
        levels,
      };
    })
    .sort(
      (a, b) =>
        new Date(a.startYear).getTime() - new Date(b.startYear).getTime(),
    );

  const currentYear = parcours.find((year) => year.isCurrent);
  const assignedToCurrentYear = Boolean(
    currentYear && currentYear.subjects.length > 0,
  );
  const currentSubjects = assignedToCurrentYear
    ? currentYear!.subjects
    : [];
  const currentLevels = assignedToCurrentYear ? currentYear!.levels : [];

  return {
    count: parcours.length,
    yearLabels: parcours.map((year) => year.yearLabel),
    currentSubjects,
    currentLevels,
    assignedToCurrentYear,
    hasCurrentAssignment: assignedToCurrentYear,
    parcours,
  };
}

/** Matières affichées : affectations année en cours, sinon dépôt candidature. */
export function resolveDossierSubjects(
  depositSubjects: string | null | undefined,
  assignedSubjects: string[],
): { value: string | null; source: "assignment" | "deposit" | "none" } {
  if (assignedSubjects.length > 0) {
    return { value: assignedSubjects.join(", "), source: "assignment" };
  }
  const deposit = depositSubjects?.trim() || null;
  if (deposit) return { value: deposit, source: "deposit" };
  return { value: null, source: "none" };
}

/** Niveaux affichés : classes affectées, sinon dépôt. */
export function resolveDossierLevels(
  depositLevels: string | null | undefined,
  assignedLevels: string[],
): { value: string | null; source: "assignment" | "deposit" | "none" } {
  if (assignedLevels.length > 0) {
    return { value: assignedLevels.join(", "), source: "assignment" };
  }
  const deposit = depositLevels?.trim() || null;
  if (deposit) return { value: deposit, source: "deposit" };
  return { value: null, source: "none" };
}

export type DossierAvailabilityLabel =
  | "Actif"
  | "Renvoyé"
  | "N'est plus actif";

/**
 * Disponibilité auto :
 * - Actif = compte engagé/actif + affecté à l'année en cours
 * - Renvoyé = compte inactif
 * - N'est plus actif = engagé mais sans affectation année en cours
 */
export function resolveDossierAvailability(params: {
  isUserActive: boolean;
  assignedToCurrentYear: boolean;
}): { value: DossierAvailabilityLabel; source: "auto" } {
  if (!params.isUserActive) {
    return { value: "Renvoyé", source: "auto" };
  }
  if (params.assignedToCurrentYear) {
    return { value: "Actif", source: "auto" };
  }
  return { value: "N'est plus actif", source: "auto" };
}

/**
 * Années d'affectation = années scolaires distinctes où l'enseignant
 * a une affectation de classe active.
 */
export async function countTeacherClassAssignmentYears(params: {
  teacherId: string;
  branchId: string;
}): Promise<{ count: number; yearLabels: string[] }> {
  const snapshot = await getTeacherAssignmentSnapshot(params);
  return { count: snapshot.count, yearLabels: snapshot.yearLabels };
}

/**
 * Fait progresser `yearsOfExperience` du dossier (jamais à la baisse)
 * et synchronise la disponibilité (Actif / Renvoyé / N'est plus actif).
 */
export async function syncTeacherDossierExperienceYears(params: {
  teacherId: string | null | undefined;
  branchId: string;
}): Promise<number> {
  if (!params.teacherId) return 0;

  const [snapshot, teacher] = await Promise.all([
    getTeacherAssignmentSnapshot({
      teacherId: params.teacherId,
      branchId: params.branchId,
    }),
    prisma.teacher.findUnique({
      where: { id: params.teacherId },
      select: {
        branchMember: {
          select: {
            member: {
              select: { user: { select: { statusUser: true } } },
            },
          },
        },
      },
    }),
  ]);

  const availability = resolveDossierAvailability({
    isUserActive: teacher?.branchMember?.member?.user?.statusUser !== false,
    assignedToCurrentYear: snapshot.assignedToCurrentYear,
  }).value;

  await prisma.$transaction([
    prisma.jobApplication.updateMany({
      where: {
        teacherId: params.teacherId,
        branchId: params.branchId,
        applicationType: "TEACHER",
        OR: [
          { yearsOfExperience: null },
          { yearsOfExperience: { lt: snapshot.count } },
        ],
      },
      data: { yearsOfExperience: snapshot.count },
    }),
    prisma.jobApplication.updateMany({
      where: {
        teacherId: params.teacherId,
        branchId: params.branchId,
        applicationType: "TEACHER",
      },
      data: { availability },
    }),
  ]);

  return snapshot.count;
}

function uniqueSorted(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "fr"));
}

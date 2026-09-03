import {
  getAcademicPeriodAliases,
  normalizeAcademicPeriodLabel,
} from "@/lib/academic-structure";
import {
  calculateBulletinPercentage,
  sumBulletinMaxima,
} from "@/lib/bulletin-maxima";
import { KLAMBOCORE_DEFAULT_IMAGE_PATH } from "@/lib/brand/klambocore-image";
import { isCycle } from "@/lib/cycle";
import { prisma } from "@/lib/prisma";
import { normalizeImageSrc } from "@/lib/utils";

export type PublicResultFilters = {
  branchId?: string;
  branchIds?: string[];
  classeId?: string;
  classeName?: string;
  yearId?: string;
  yearName?: string;
  periodId?: number;
  periodLabel?: string;
  cycle?: string;
  q?: string;
};

export type PublicStudentResult = {
  studentId: string;
  name: string;
  sexe: string;
  image: string | null;
  classe: string;
  year: string;
  periods: string[];
  average: number;
  branchId: string;
  branchName: string;
  branchCity: string;
};

type NoteRow = {
  studentId?: string;
  score?: number | null;
  maxScore?: number | null;
  nom?: string;
  studentSurname?: string;
  studentusername?: string;
  studentSexe?: string;
};

type PeriodTotals = {
  score: number;
  maxScores: number[];
};

type Acc = {
  studentId: string;
  branchId: string;
  branchName: string;
  branchCity: string;
  classe: string;
  year: string;
  noteName: string;
  noteSexe: string;
  /** Clé = période ; agrège tous les cours de la fiche. */
  periodTotals: Map<string, PeriodTotals>;
};

function joinNameParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** prenom + nom + postnom, tels qu'enregistrés dans la fiche de cote. */
function nameFromNote(note: NoteRow): string {
  return joinNameParts([note.studentusername, note.nom, note.studentSurname]);
}

function periodLabelsForFilter(label: string): string[] {
  const normalized = normalizeAcademicPeriodLabel(label);
  return Array.from(
    new Set([label, normalized, ...getAcademicPeriodAliases(normalized)]),
  );
}

function parseNotes(raw: unknown): NoteRow[] {
  try {
    const notes =
      typeof raw === "string"
        ? JSON.parse(raw)
        : Array.isArray(raw)
          ? raw
          : [];
    return Array.isArray(notes) ? notes : [];
  } catch {
    return [];
  }
}

/**
 * Résultats publics : % = total points obtenus / somme des maxima de période
 * de **tous** les cours présents en fiche (pas seulement les fiches validées).
 */
export async function getPublicStudentResults(
  filters: PublicResultFilters = {},
): Promise<PublicStudentResult[]> {
  const branchIds = Array.from(
    new Set(
      [filters.branchId, ...(filters.branchIds ?? [])].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );
  const periodNames = filters.periodLabel
    ? periodLabelsForFilter(filters.periodLabel)
    : [];
  const cycle = isCycle(filters.cycle) ? filters.cycle : undefined;

  const fiches = await prisma.fiche.findMany({
    where: {
      typeFiche: "ficheCote",
      ...(branchIds.length ? { branchId: { in: branchIds } } : {}),
      ...(filters.classeId ? { classSectionId: filters.classeId } : {}),
      ...(filters.classeName && !filters.classeId
        ? { ClassSection: { nameClasse: filters.classeName } }
        : {}),
      ...(filters.yearId ? { anneeId: filters.yearId } : {}),
      ...(filters.yearName && !filters.yearId
        ? { anneeName: filters.yearName }
        : {}),
      ...(filters.periodId ? { periodId: filters.periodId } : {}),
      ...(periodNames.length && !filters.periodId
        ? { periodeName: { in: periodNames } }
        : {}),
      ...(cycle
        ? {
            OR: [
              { period: { cycle } },
              { ClassSection: { cycle } },
            ],
          }
        : {}),
      branch: {
        isActive: true,
      },
    },
    select: {
      notes: true,
      anneeName: true,
      periodeName: true,
      classSectionId: true,
      branchId: true,
      coursName: true,
      branch: {
        select: {
          name: true,
          ville: true,
          pays: true,
        },
      },
      ClassSection: {
        select: {
          nameClasse: true,
        },
      },
    },
  });

  const byStudent = new Map<string, Acc>();

  for (const fiche of fiches) {
    const notes = parseNotes(fiche.notes);
    if (notes.length === 0) continue;

    const periodKey = fiche.periodeName
      ? normalizeAcademicPeriodLabel(fiche.periodeName)
      : "Période";

    // Maxima de période du cours = maxScore enregistré dans la fiche.
    const coursePeriodMax = Math.max(
      0,
      ...notes.map((note) => {
        const max = Number(note.maxScore ?? 0);
        return Number.isFinite(max) && max > 0 ? max : 0;
      }),
    );

    if (!(coursePeriodMax > 0)) continue;

    for (const note of notes) {
      if (!note?.studentId) continue;

      const score = Number(note.score ?? 0);
      const noteMax = Number(note.maxScore ?? 0);
      const maxForStudent =
        Number.isFinite(noteMax) && noteMax > 0 ? noteMax : coursePeriodMax;

      const current = byStudent.get(note.studentId) ?? {
        studentId: note.studentId,
        branchId: fiche.branchId,
        branchName: fiche.branch.name,
        branchCity: fiche.branch.ville || fiche.branch.pays || "RDC",
        classe: fiche.ClassSection.nameClasse || "Classe non renseignée",
        year: fiche.anneeName || "Année",
        noteName: "",
        noteSexe: "",
        periodTotals: new Map(),
      };

      if (!current.noteName) {
        current.noteName = nameFromNote(note);
      }
      if (!current.noteSexe && note.studentSexe) {
        current.noteSexe = String(note.studentSexe).trim();
      }

      const period = current.periodTotals.get(periodKey) ?? {
        score: 0,
        maxScores: [],
      };

      // Un cours compte toujours son maxima de période, même si la cote est 0.
      period.score += Number.isFinite(score) ? score : 0;
      period.maxScores.push(maxForStudent);
      current.periodTotals.set(periodKey, period);

      byStudent.set(note.studentId, current);
    }
  }

  if (byStudent.size === 0) return [];

  const students = await prisma.student.findMany({
    where: {
      id: { in: Array.from(byStudent.keys()) },
    },
    select: {
      id: true,
      branchMember: {
        select: {
          member: {
            select: {
              user: {
                select: {
                  name: true,
                  prenom: true,
                  postnom: true,
                  sexe: true,
                  image: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const userByStudentId = new Map(
    students.map((student) => [
      student.id,
      student.branchMember?.member?.user,
    ]),
  );

  const q = filters.q?.trim().toLowerCase();

  const results: PublicStudentResult[] = [];

  for (const acc of byStudent.values()) {
    const user = userByStudentId.get(acc.studentId);
    const name =
      joinNameParts([user?.prenom, user?.name, user?.postnom]) ||
      acc.noteName;

    if (q) {
      const haystack =
        `${name} ${user?.name ?? ""} ${user?.prenom ?? ""} ${user?.postnom ?? ""} ${acc.noteName}`.toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    let totalScore = 0;
    let totalMax = 0;
    const periodLabels: string[] = [];

    for (const [label, totals] of acc.periodTotals.entries()) {
      const periodMax = sumBulletinMaxima(totals.maxScores);
      if (!(periodMax > 0)) continue;
      totalScore += totals.score;
      totalMax += periodMax;
      periodLabels.push(label);
    }

    if (!(totalMax > 0)) continue;

    const average = calculateBulletinPercentage(totalScore, totalMax);

    results.push({
      studentId: acc.studentId,
      name: name || "Élève",
      sexe: user?.sexe || acc.noteSexe || "N/A",
      image: user?.image ? normalizeImageSrc(user.image) : null,
      classe: acc.classe,
      year: acc.year,
      periods: periodLabels,
      average,
      branchId: acc.branchId,
      branchName: acc.branchName,
      branchCity: acc.branchCity,
    });
  }

  return results.sort((a, b) => b.average - a.average);
}

export async function getHomeResultSlides(limitSchools = 3) {
  const results = await getPublicStudentResults();
  const grouped = new Map<
    string,
    {
      school: string;
      city: string;
      students: {
        studentid: string;
        name: string;
        percent: string;
        image: string;
      }[];
    }
  >();

  const defaultImage = KLAMBOCORE_DEFAULT_IMAGE_PATH;

  for (const result of results) {
    const current = grouped.get(result.branchId) ?? {
      school: result.branchName,
      city: result.branchCity,
      students: [],
    };

    if (
      current.students.length < 3 &&
      !current.students.some((s) => s.studentid === result.studentId)
    ) {
      current.students.push({
        studentid: result.studentId,
        name: result.name,
        percent: `${Math.round(result.average)}%`,
        image: result.image || defaultImage,
      });
    }

    grouped.set(result.branchId, current);
  }

  return Array.from(grouped.values())
    .filter((slide) => slide.students.length > 0)
    .slice(0, limitSchools);
}

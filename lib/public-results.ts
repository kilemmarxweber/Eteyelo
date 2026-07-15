import {
  calculateBulletinPercentage,
  sumBulletinMaxima,
} from "@/lib/bulletin-maxima";
import { prisma } from "@/lib/prisma";
import { normalizeImageSrc } from "@/lib/utils";

export type PublicResultFilters = {
  branchId?: string;
  classeId?: string;
  yearId?: string;
  periodId?: number;
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
  /** Clé = période ; agrège tous les cours de la fiche. */
  periodTotals: Map<string, PeriodTotals>;
};

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
  const fiches = await prisma.fiche.findMany({
    where: {
      typeFiche: "ficheCote",
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.classeId ? { classSectionId: filters.classeId } : {}),
      ...(filters.yearId ? { anneeId: filters.yearId } : {}),
      ...(filters.periodId ? { periodId: filters.periodId } : {}),
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

    const periodKey = fiche.periodeName || "Période";

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
        periodTotals: new Map(),
      };

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
    students.map((student) => [student.id, student.branchMember.member.user]),
  );

  const q = filters.q?.trim().toLowerCase();

  const results: PublicStudentResult[] = [];

  for (const acc of byStudent.values()) {
    const user = userByStudentId.get(acc.studentId);
    const name = [user?.prenom, user?.name, user?.postnom]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (q) {
      const haystack =
        `${name} ${user?.name ?? ""} ${user?.prenom ?? ""} ${user?.postnom ?? ""}`.toLowerCase();
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
      sexe: user?.sexe || "N/A",
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

  const defaultImage =
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=300&auto=format&fit=crop";

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

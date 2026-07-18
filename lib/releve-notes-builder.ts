import {
  getAcademicStructure,
  normalizeAcademicPeriodLabel,
} from "@/lib/academic-structure";
import { isUniversiteBranch } from "@/lib/branch-capabilities";
import {
  formatUniversitySemesterLabel,
  type SemesterInYear,
} from "@/lib/university-lmd";
import { prisma } from "@/lib/prisma";

export type ReleveCourseLine = {
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  score: number;
  maxScore: number;
  percentage: number;
};

export type ReleveSemesterBlock = {
  semesterLabel: string;
  semesterOrder: number;
  courses: ReleveCourseLine[];
  semesterAverage: number;
};

export type ReleveNotesData = {
  studentId: string;
  studentName: string;
  username: string;
  auditoireName: string;
  auditoireLevel: string | null;
  filiereName: string | null;
  faculteName: string | null;
  schoolYearName: string;
  schoolYearId: string;
  semesters: ReleveSemesterBlock[];
  overallAverage: number;
};

type ScoreAccumulator = {
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  scores: number[];
  maxScores: number[];
};

function resolveSemesterInYear(semesterOrder: number): SemesterInYear | null {
  if (semesterOrder === 1) return 1;
  if (semesterOrder === 2) return 2;
  return null;
}

function buildSemesterDisplayLabel(
  semesterLabel: string,
  semesterOrder: number,
  typebranch: unknown,
  auditoireLevel: string | null,
): string {
  if (!isUniversiteBranch(typebranch)) return semesterLabel;

  const semesterInYear = resolveSemesterInYear(semesterOrder);
  if (!semesterInYear) return semesterLabel;

  return formatUniversitySemesterLabel(semesterInYear, auditoireLevel);
}

function getSemesterForPeriod(periodName: string, typebranch: unknown) {
  const normalized = normalizeAcademicPeriodLabel(periodName);
  const structure = getAcademicStructure(typebranch);

  for (const group of structure.groups) {
    if (group.periods.some((period) => period.label === normalized)) {
      return { label: group.label, order: group.order };
    }
  }

  return { label: periodName, order: Number.MAX_SAFE_INTEGER };
}

function computeWeightedAverage(courses: ReleveCourseLine[]): number {
  if (!courses.length) return 0;

  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
  if (totalCredits <= 0) {
    return (
      courses.reduce((sum, course) => sum + course.percentage, 0) / courses.length
    );
  }

  return (
    courses.reduce((sum, course) => sum + course.percentage * course.credits, 0) /
    totalCredits
  );
}

function finalizeCourseLine(entry: ScoreAccumulator): ReleveCourseLine {
  const score =
    entry.scores.reduce((sum, value) => sum + value, 0) / entry.scores.length;
  const maxScore =
    entry.maxScores.reduce((sum, value) => sum + value, 0) / entry.maxScores.length;
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  return {
    courseId: entry.courseId,
    courseCode: entry.courseCode,
    courseName: entry.courseName,
    credits: entry.credits,
    score: Math.round(score * 100) / 100,
    maxScore: Math.round(maxScore * 100) / 100,
    percentage: Math.round(percentage * 100) / 100,
  };
}

export async function buildReleveNotesData(params: {
  studentId: string;
  branchId: string;
  typebranch: unknown;
  semesterOrder?: number;
}): Promise<ReleveNotesData | null> {
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentId: params.studentId,
      branchId: params.branchId,
      statusEnrollment: true,
      schoolYear: { isCurrentYear: true },
    },
    include: {
      schoolYear: true,
      classe: {
        include: {
          option: {
            include: {
              section: true,
            },
          },
        },
      },
    },
  });

  if (!enrollment) return null;

  if (!enrollment.classe) return null;

  const classe = enrollment.classe;

  const [student, ponderations, teachings] = await Promise.all([
    prisma.student.findUnique({
      where: { id: params.studentId },
      include: {
        branchMember: { include: { member: { include: { user: true } } } },
      },
    }),
    prisma.coursOptionPonderation.findMany({
      where: {
        branchId: params.branchId,
        optionId: classe.optionId ?? undefined,
      },
      select: { coursId: true, ponderation: true },
    }),
    prisma.teaching.findMany({
      where: {
        classeId: enrollment.classeId,
        OR: [{ branchId: params.branchId }, { branchId: null }],
      },
      include: {
        cours: true,
        fiche: {
          where: {
            branchId: params.branchId,
            typeFiche: "ficheCote",
            anneeId: enrollment.schoolYearId,
            status: true,
          },
        },
      },
    }),
  ]);

  if (!student) return null;

  const user = student.branchMember.member.user;
  const creditMap = new Map(
    ponderations.map((item) => [item.coursId, item.ponderation]),
  );

  const semesterMap = new Map<string, Map<string, ScoreAccumulator>>();

  for (const teaching of teachings) {
    if (!teaching.cours) continue;

    for (const fiche of teaching.fiche) {
      const semester = getSemesterForPeriod(fiche.periodeName, params.typebranch);

      if (
        params.semesterOrder !== undefined &&
        semester.order !== params.semesterOrder
      ) {
        continue;
      }

      let notes: Array<{ studentId?: string; score?: number; maxScore?: number }> =
        [];

      try {
        notes = fiche.notes ? JSON.parse(fiche.notes) : [];
      } catch {
        notes = [];
      }

      const studentNote = notes.find((note) => note.studentId === params.studentId);
      if (!studentNote || studentNote.score === undefined) continue;

      const maxScore = Number(studentNote.maxScore ?? 0);
      const score = Number(studentNote.score ?? 0);
      if (maxScore <= 0 && score <= 0) continue;

      const courseKey = teaching.cours.id;
      const semesterCourses =
        semesterMap.get(semester.label) ??
        new Map<string, ScoreAccumulator>();

      const existing = semesterCourses.get(courseKey) ?? {
        courseId: teaching.cours.id,
        courseCode: teaching.cours.codeCours,
        courseName: teaching.cours.nameCours,
        credits: creditMap.get(teaching.cours.id) ?? 1,
        scores: [],
        maxScores: [],
      };

      existing.scores.push(score);
      existing.maxScores.push(maxScore > 0 ? maxScore : 20);
      semesterCourses.set(courseKey, existing);
      semesterMap.set(semester.label, semesterCourses);
    }
  }

  const semesters: ReleveSemesterBlock[] = Array.from(semesterMap.entries())
    .map(([semesterLabel, coursesMap]) => {
      const courses = Array.from(coursesMap.values()).map(finalizeCourseLine);
      const semesterOrder = getAcademicStructure(params.typebranch).groups.find(
        (group) => group.label === semesterLabel,
      )?.order ?? Number.MAX_SAFE_INTEGER;

      return {
        semesterLabel: buildSemesterDisplayLabel(
          semesterLabel,
          semesterOrder,
          params.typebranch,
          classe.level ?? null,
        ),
        semesterOrder,
        courses,
        semesterAverage: Math.round(computeWeightedAverage(courses) * 100) / 100,
      };
    })
    .sort((left, right) => left.semesterOrder - right.semesterOrder);

  const allCourses = semesters.flatMap((semester) => semester.courses);

  return {
    studentId: params.studentId,
    studentName: [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" "),
    username: user?.username ?? "",
    auditoireName: classe.nameClasse,
    auditoireLevel: classe.level ?? null,
    filiereName: classe.option?.nameOption ?? null,
    faculteName: classe.option?.section?.nameSection ?? null,
    schoolYearName: enrollment.schoolYear.nameYear,
    schoolYearId: enrollment.schoolYearId,
    semesters,
    overallAverage: Math.round(computeWeightedAverage(allCourses) * 100) / 100,
  };
}

export async function generateReleveNumber(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { code: true },
  });

  const year = new Date().getFullYear();
  const prefix = `${branch?.code ?? "UNIV"}-${year}`;
  const count = await prisma.issuedDocument.count({
    where: {
      branchId,
      documentType: "RELEVE_NOTES",
      issuedAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
      },
    },
  });

  return `${prefix}-RN-${String(count + 1).padStart(4, "0")}`;
}

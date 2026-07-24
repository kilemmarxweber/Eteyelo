import {
  calculateBulletinPercentage,
  sumBulletinMaxima,
} from "@/lib/bulletin-maxima";
import { prisma } from "@/lib/prisma";
import { SUCCESS_THRESHOLD_PERCENT } from "./definitions";
import { buildBranchIdFilter, pct, type BranchScopeInput } from "./scope";

export type ResultsReport = {
  averageScore: number;
  successRate: number;
  studentsCount: number;
  passedCount: number;
  byClass: Array<{
    name: string;
    average: number;
    successRate: number;
    count: number;
  }>;
  byGender: Array<{
    name: string;
    average: number;
    successRate: number;
    count: number;
  }>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    average: number;
    successRate: number;
    count: number;
  }>;
};

type FicheNoteRow = {
  studentId?: string;
  score?: number | null;
  maxScore?: number | null;
};

function parseFicheNotes(raw: unknown): FicheNoteRow[] {
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

export async function getResultsReport(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
}): Promise<ResultsReport> {
  const branchFilter = buildBranchIdFilter(params.scope);

  const [fiches, students, classes, branches] = await Promise.all([
    prisma.fiche.findMany({
      where: {
        ...branchFilter,
        typeFiche: "ficheCote",
        ...(params.schoolYearIds.length > 0
          ? { anneeId: { in: params.schoolYearIds } }
          : {}),
      },
      select: {
        notes: true,
        classSectionId: true,
        branchId: true,
      },
    }),
    prisma.student.findMany({
      where: { branchMember: branchFilter },
      select: {
        id: true,
        branchMember: {
          select: {
            branchId: true,
            member: { select: { user: { select: { sexe: true } } } },
          },
        },
        classEnrollment: {
          where:
            params.schoolYearIds.length > 0
              ? { schoolYearId: { in: params.schoolYearIds } }
              : {},
          select: { classeId: true },
          take: 1,
        },
      },
    }),
    prisma.classe.findMany({
      where: branchFilter,
      select: { id: true, nameClasse: true },
    }),
    prisma.branch.findMany({
      where:
        params.scope.scope === "branch" && params.scope.branchId
          ? { id: params.scope.branchId }
          : { organizationId: params.scope.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const studentMeta = new Map(
    students.map((s) => [
      s.id,
      {
        sexe: s.branchMember.member.user.sexe,
        branchId: s.branchMember.branchId,
        classeId: s.classEnrollment[0]?.classeId ?? null,
      },
    ]),
  );

  const byStudent = new Map<string, { score: number; maxScores: number[] }>();

  for (const fiche of fiches) {
    const notes = parseFicheNotes(fiche.notes);
    if (notes.length === 0) continue;

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
        score: 0,
        maxScores: [],
      };
      current.score += Number.isFinite(score) ? score : 0;
      current.maxScores.push(maxForStudent);
      byStudent.set(note.studentId, current);
    }
  }

  type AvgRow = {
    studentId: string;
    average: number;
    sexe: string | null;
    branchId: string;
    classeId: string | null;
  };

  const averages: AvgRow[] = [];
  for (const [studentId, totals] of byStudent.entries()) {
    const totalMax = sumBulletinMaxima(totals.maxScores);
    if (!(totalMax > 0)) continue;
    const meta = studentMeta.get(studentId);
    averages.push({
      studentId,
      average: calculateBulletinPercentage(totals.score, totalMax),
      sexe: meta?.sexe ?? null,
      branchId: meta?.branchId ?? "",
      classeId: meta?.classeId ?? null,
    });
  }

  const studentsCount = averages.length;
  const passedCount = averages.filter(
    (a) => a.average >= SUCCESS_THRESHOLD_PERCENT,
  ).length;
  const averageScore =
    studentsCount > 0
      ? Math.round(
          (averages.reduce((sum, a) => sum + a.average, 0) / studentsCount) * 10,
        ) / 10
      : 0;

  function groupStats(
    keyFn: (row: AvgRow) => string | null,
    labelFn: (key: string) => string,
  ) {
    const map = new Map<string, number[]>();
    for (const row of averages) {
      const key = keyFn(row);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(row.average);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([key, vals]) => {
      const count = vals.length;
      const passed = vals.filter((v) => v >= SUCCESS_THRESHOLD_PERCENT).length;
      return {
        name: labelFn(key),
        average:
          count > 0
            ? Math.round((vals.reduce((s, v) => s + v, 0) / count) * 10) / 10
            : 0,
        successRate: pct(passed, count),
        count,
      };
    });
  }

  const classNameById = new Map(classes.map((c) => [c.id, c.nameClasse]));
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const byClass = groupStats(
    (r) => r.classeId,
    (id) => classNameById.get(id) ?? id,
  ).sort((a, b) => a.name.localeCompare(b.name));

  const byGender = groupStats(
    (r) => (r.sexe === "M" || r.sexe === "F" ? r.sexe : null),
    (k) => (k === "M" ? "Garçons" : "Filles"),
  );

  const byBranch = groupStats(
    (r) => r.branchId || null,
    (id) => branchNameById.get(id) ?? id,
  ).map((row) => {
    const branch = branches.find((b) => b.name === row.name || b.id === row.name);
    return {
      branchId: branch?.id ?? row.name,
      branchName: branch?.name ?? row.name,
      average: row.average,
      successRate: row.successRate,
      count: row.count,
    };
  });

  return {
    averageScore,
    successRate: pct(passedCount, studentsCount),
    studentsCount,
    passedCount,
    byClass,
    byGender,
    byBranch,
  };
}

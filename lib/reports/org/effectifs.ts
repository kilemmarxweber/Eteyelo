import { prisma } from "@/lib/prisma";
import { buildBranchIdFilter, type BranchScopeInput } from "./scope";

export type NamedCount = { name: string; value: number };
export type ClassCount = { name: string; total: number; boys: number; girls: number };
export type BranchCount = {
  branchId: string;
  branchName: string;
  students: number;
  parents: number;
  teachers: number;
  personnel: number;
};

export type EffectifsReport = {
  students: {
    total: number;
    active: number;
    inactive: number;
    boys: number;
    girls: number;
    unknownSex: number;
    byClass: ClassCount[];
    byStatus: NamedCount[];
    byGender: NamedCount[];
  };
  parents: {
    total: number;
    active: number;
    inactive: number;
    byGender: NamedCount[];
  };
  teachers: {
    total: number;
    active: number;
    inactive: number;
    byGender: NamedCount[];
  };
  personnel: {
    total: number;
    active: number;
    inactive: number;
    byGender: NamedCount[];
  };
  byBranch: BranchCount[];
};

function genderBucket(sexe: string | null | undefined): "M" | "F" | "?" {
  if (sexe === "M" || sexe === "F") return sexe;
  return "?";
}

export async function getEffectifsReport(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
}): Promise<EffectifsReport> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const yearFilter =
    params.schoolYearIds.length > 0
      ? { schoolYearId: { in: params.schoolYearIds } }
      : {};

  const [students, parents, teachers, personnel, classes, branches] =
    await Promise.all([
      prisma.student.findMany({
        where: { branchMember: branchFilter },
        select: {
          id: true,
          statusStudent: true,
          branchMember: {
            select: {
              branchId: true,
              member: {
                select: {
                  isArchived: true,
                  user: { select: { sexe: true } },
                },
              },
            },
          },
          classEnrollment: {
            where: yearFilter,
            select: {
              classe: { select: { id: true, nameClasse: true } },
            },
          },
        },
      }),
      prisma.parent.findMany({
        where: { branchMember: branchFilter },
        select: {
          id: true,
          branchMember: {
            select: {
              branchId: true,
              member: {
                select: {
                  isArchived: true,
                  user: { select: { sexe: true } },
                },
              },
            },
          },
        },
      }),
      prisma.teacher.findMany({
        where: { branchMember: branchFilter },
        select: {
          id: true,
          branchMember: {
            select: {
              branchId: true,
              member: {
                select: {
                  isArchived: true,
                  user: { select: { sexe: true } },
                },
              },
            },
          },
        },
      }),
      prisma.personnel.findMany({
        where: { branchMember: branchFilter },
        select: {
          id: true,
          branchMember: {
            select: {
              branchId: true,
              member: {
                select: {
                  isArchived: true,
                  user: { select: { sexe: true } },
                },
              },
            },
          },
        },
      }),
      prisma.classe.findMany({
        where: branchFilter,
        select: { id: true, nameClasse: true, branchId: true },
        orderBy: { nameClasse: "asc" },
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

  const classMap = new Map<string, ClassCount>();
  for (const c of classes) {
    classMap.set(c.id, {
      name: c.nameClasse,
      total: 0,
      boys: 0,
      girls: 0,
    });
  }

  let boys = 0;
  let girls = 0;
  let unknownSex = 0;
  let active = 0;
  let inactive = 0;

  for (const s of students) {
    const isActive = s.statusStudent === true;
    if (isActive) active += 1;
    else inactive += 1;

    const g = genderBucket(s.branchMember.member.user.sexe);
    if (g === "M") boys += 1;
    else if (g === "F") girls += 1;
    else unknownSex += 1;

    for (const enr of s.classEnrollment) {
      if (!enr.classe) continue;
      const row = classMap.get(enr.classe.id);
      if (!row) continue;
      row.total += 1;
      if (g === "M") row.boys += 1;
      if (g === "F") row.girls += 1;
    }
  }

  function peopleStats(
    rows: Array<{
      branchMember: {
        branchId: string;
        member: { isArchived: boolean; user: { sexe: string | null } };
      } | null;
    }>,
  ) {
    let total = 0;
    let act = 0;
    let inact = 0;
    let m = 0;
    let f = 0;
    for (const row of rows) {
      if (!row.branchMember) continue;
      total += 1;
      if (row.branchMember.member.isArchived) inact += 1;
      else act += 1;
      const g = genderBucket(row.branchMember.member.user.sexe);
      if (g === "M") m += 1;
      else if (g === "F") f += 1;
    }
    return {
      total,
      active: act,
      inactive: inact,
      byGender: [
        { name: "Hommes", value: m },
        { name: "Femmes", value: f },
      ] satisfies NamedCount[],
    };
  }

  const parentStats = peopleStats(parents);
  const teacherStats = peopleStats(teachers);
  const personnelStats = peopleStats(personnel);

  const byBranch: BranchCount[] = branches.map((b) => {
    const studentCount = students.filter(
      (s) => s.branchMember.branchId === b.id,
    ).length;
    const parentCount = parents.filter(
      (p) => p.branchMember?.branchId === b.id,
    ).length;
    const teacherCount = teachers.filter(
      (t) => t.branchMember?.branchId === b.id,
    ).length;
    const personnelCount = personnel.filter(
      (p) => p.branchMember?.branchId === b.id,
    ).length;
    return {
      branchId: b.id,
      branchName: b.name,
      students: studentCount,
      parents: parentCount,
      teachers: teacherCount,
      personnel: personnelCount,
    };
  });

  return {
    students: {
      total: students.length,
      active,
      inactive,
      boys,
      girls,
      unknownSex,
      byClass: Array.from(classMap.values()).filter((c) => c.total > 0),
      byStatus: [
        { name: "Actifs", value: active },
        { name: "Inactifs", value: inactive },
      ],
      byGender: [
        { name: "Garçons", value: boys },
        { name: "Filles", value: girls },
      ],
    },
    parents: parentStats,
    teachers: teacherStats,
    personnel: personnelStats,
    byBranch,
  };
}

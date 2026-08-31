import { branchDocumentName } from "@/lib/branch-document-name";
import { prisma } from "@/lib/prisma";
import { buildBranchIdFilter, type BranchScopeInput } from "./scope";

export type NamedCount = { name: string; value: number };
export type ClassCount = {
  name: string;
  total: number;
  boys: number;
  girls: number;
};
export type BranchCount = {
  branchId: string;
  branchName: string;
  students: number;
  parents: number;
  teachers: number;
  personnel: number;
};

export type EffectifsPersonRow = {
  matricule: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: string;
  statut: string;
  branche: string;
  telephone: string;
  classe?: string;
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
    list: EffectifsPersonRow[];
  };
  parents: {
    total: number;
    active: number;
    inactive: number;
    byGender: NamedCount[];
    list: EffectifsPersonRow[];
  };
  teachers: {
    total: number;
    active: number;
    inactive: number;
    byGender: NamedCount[];
    list: EffectifsPersonRow[];
  };
  personnel: {
    total: number;
    active: number;
    inactive: number;
    byGender: NamedCount[];
    list: EffectifsPersonRow[];
  };
  byBranch: BranchCount[];
};

const userSelect = {
  username: true,
  name: true,
  postnom: true,
  prenom: true,
  sexe: true,
  telephone: true,
} as const;

function genderBucket(sexe: string | null | undefined): "M" | "F" | "?" {
  if (sexe === "M" || sexe === "F") return sexe;
  return "?";
}

function sexeLabel(sexe: string | null | undefined) {
  if (sexe === "M") return "M";
  if (sexe === "F") return "F";
  return "—";
}

function sortPeople(rows: EffectifsPersonRow[]) {
  return rows.sort((a, b) => {
    const byBranch = a.branche.localeCompare(b.branche, "fr");
    if (byBranch !== 0) return byBranch;
    const byClass = (a.classe ?? "").localeCompare(b.classe ?? "", "fr");
    if (byClass !== 0) return byClass;
    return `${a.nom} ${a.postnom} ${a.prenom}`.localeCompare(
      `${b.nom} ${b.postnom} ${b.prenom}`,
      "fr",
    );
  });
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
              isActive: true,
              branch: { select: { name: true, description: true } },
              member: {
                select: {
                  isArchived: true,
                  user: { select: userSelect },
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
        orderBy: { createdAt: "asc" },
      }),
      prisma.parent.findMany({
        where: { branchMember: branchFilter },
        select: {
          id: true,
          branchMember: {
            select: {
              branchId: true,
              isActive: true,
              branch: { select: { name: true, description: true } },
              member: {
                select: {
                  isArchived: true,
                  user: { select: userSelect },
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
          isActive: true,
          branchMember: {
            select: {
              branchId: true,
              isActive: true,
              branch: { select: { name: true, description: true } },
              member: {
                select: {
                  isArchived: true,
                  user: { select: userSelect },
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
          isActive: true,
          branchMember: {
            select: {
              branchId: true,
              isActive: true,
              branch: { select: { name: true, description: true } },
              member: {
                select: {
                  isArchived: true,
                  user: { select: userSelect },
                },
              },
            },
          },
        },
      }),
      prisma.classe.findMany({
        where: {
          ...branchFilter,
          OR: [{ statusClasse: true }, { statusClasse: null }],
        },
        select: { id: true, nameClasse: true, branchId: true },
        orderBy: { nameClasse: "asc" },
      }),
      prisma.branch.findMany({
        where:
          params.scope.scope === "branch" && params.scope.branchId
            ? { id: params.scope.branchId }
            : { organizationId: params.scope.organizationId, isActive: true },
        select: { id: true, name: true, description: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const branchNameById = new Map(
    branches.map((b) => [b.id, branchDocumentName(b)]),
  );
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
  const studentList: EffectifsPersonRow[] = [];

  for (const s of students) {
    const isActive = s.branchMember.isActive !== false;
    if (isActive) active += 1;
    else inactive += 1;

    const user = s.branchMember.member.user;
    const g = genderBucket(user.sexe);
    if (isActive) {
      if (g === "M") boys += 1;
      else if (g === "F") girls += 1;
      else unknownSex += 1;
    }

    const classNames = s.classEnrollment
      .map((enr) => enr.classe?.nameClasse)
      .filter((name): name is string => Boolean(name));

    if (isActive) {
      for (const enr of s.classEnrollment) {
        if (!enr.classe) continue;
        const row = classMap.get(enr.classe.id);
        if (!row) continue;
        row.total += 1;
        if (g === "M") row.boys += 1;
        if (g === "F") row.girls += 1;
      }
    }

    studentList.push({
      matricule: user.username?.trim() || "—",
      nom: user.name?.trim() || "—",
      postnom: user.postnom?.trim() || "—",
      prenom: user.prenom?.trim() || "—",
      sexe: sexeLabel(user.sexe),
      statut: isActive ? "Actif" : "Inactif",
      branche:
        branchDocumentName(s.branchMember.branch) ||
        branchNameById.get(s.branchMember.branchId) ||
        "—",
      telephone: user.telephone?.trim() || "—",
      classe: classNames.join(", ") || "Non affecté",
    });
  }

  function peopleBlock(
    rows: Array<{
      isActive?: boolean | null;
      branchMember: {
        branchId: string;
        isActive?: boolean | null;
        branch: { name: string };
        member: {
          isArchived: boolean;
          user: {
            username: string | null;
            name: string;
            postnom: string | null;
            prenom: string | null;
            sexe: string | null;
            telephone: string | null;
          };
        };
      } | null;
    }>,
  ) {
    let total = 0;
    let act = 0;
    let inact = 0;
    let m = 0;
    let f = 0;
    const list: EffectifsPersonRow[] = [];

    for (const row of rows) {
      if (!row.branchMember) continue;
      total += 1;
      const archived =
        row.isActive === false ||
        row.branchMember.isActive === false ||
        Boolean(row.branchMember.member.isArchived);
      if (archived) inact += 1;
      else act += 1;
      const user = row.branchMember.member.user;
      const g = genderBucket(user.sexe);
      if (g === "M") m += 1;
      else if (g === "F") f += 1;

      list.push({
        matricule: user.username?.trim() || "—",
        nom: user.name?.trim() || "—",
        postnom: user.postnom?.trim() || "—",
        prenom: user.prenom?.trim() || "—",
        sexe: sexeLabel(user.sexe),
        statut: archived ? "Inactif" : "Actif",
        branche:
          branchDocumentName(row.branchMember.branch) ||
          branchNameById.get(row.branchMember.branchId) ||
          "—",
        telephone: user.telephone?.trim() || "—",
      });
    }

    return {
      total,
      active: act,
      inactive: inact,
      byGender: [
        { name: "Hommes", value: m },
        { name: "Femmes", value: f },
      ] satisfies NamedCount[],
      list: sortPeople(list),
    };
  }

  const parentStats = peopleBlock(parents);
  const teacherStats = peopleBlock(teachers);
  const personnelStats = peopleBlock(personnel);

  const byBranch: BranchCount[] = branches.map((b) => {
    const studentCount = students.filter(
      (s) =>
        s.branchMember.branchId === b.id && s.branchMember.isActive !== false,
    ).length;
    const parentCount = parents.filter(
      (p) =>
        p.branchMember?.branchId === b.id &&
        p.branchMember.isActive !== false,
    ).length;
    const teacherCount = teachers.filter(
      (t) =>
        t.branchMember?.branchId === b.id &&
        t.isActive !== false &&
        t.branchMember.isActive !== false,
    ).length;
    const personnelCount = personnel.filter(
      (p) =>
        p.branchMember?.branchId === b.id &&
        p.isActive !== false &&
        p.branchMember.isActive !== false,
    ).length;
    return {
      branchId: b.id,
      branchName: branchDocumentName(b),
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
      list: sortPeople(studentList),
    },
    parents: parentStats,
    teachers: teacherStats,
    personnel: personnelStats,
    byBranch,
  };
}

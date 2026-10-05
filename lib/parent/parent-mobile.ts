import { prisma } from "@/lib/prisma";
import { getStudentFeeStatus } from "@/lib/reports/org/finance";
import { listBranchPeriodOptions } from "@/lib/academic-periods";

function formatPersonName(user?: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  if (!user) return "—";
  return (
    [user.prenom, user.name, user.postnom].filter(Boolean).join(" ").trim() ||
    "—"
  );
}

export class ParentMobileError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ParentMobileError";
    this.statusCode = statusCode;
  }
}

export type ParentChild = {
  studentId: string;
  fullName: string;
  parentId: string;
  branchId: string;
  branchName: string;
  schoolYearId: string | null;
  schoolYearName: string | null;
  classId: string | null;
  className: string | null;
  classCode: string | null;
};

/** Enfants du parent authentifié dans l’organisation (toutes branches). */
export async function listParentChildren(params: {
  userId: string;
  organizationId: string;
}): Promise<ParentChild[]> {
  const parents = await prisma.parent.findMany({
    where: {
      branchMember: {
        role: "PARENT",
        isActive: true,
        branch: {
          organizationId: params.organizationId,
          isActive: true,
        },
        member: {
          userId: params.userId,
          isArchived: false,
        },
      },
    },
    select: {
      id: true,
      branchMember: {
        select: {
          branchId: true,
          branch: {
            select: {
              id: true,
              name: true,
              typebranch: true,
              educationSystem: true,
            },
          },
        },
      },
      students: {
        select: {
          id: true,
          branchMember: {
            select: {
              member: {
                select: {
                  user: {
                    select: { name: true, postnom: true, prenom: true },
                  },
                },
              },
            },
          },
          classEnrollment: {
            orderBy: [
              { schoolYear: { isCurrentYear: "desc" } },
              { createdAt: "desc" },
            ],
            take: 1,
            select: {
              schoolYearId: true,
              schoolYear: { select: { id: true, nameYear: true } },
              classe: {
                select: { id: true, nameClasse: true, codeClasse: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const out: ParentChild[] = [];
  for (const parent of parents) {
    const branch = parent.branchMember?.branch;
    if (!branch) continue;
    for (const student of parent.students) {
      const enrollment = student.classEnrollment[0];
      out.push({
        studentId: student.id,
        fullName: formatPersonName(student.branchMember?.member?.user),
        parentId: parent.id,
        branchId: branch.id,
        branchName: branch.name,
        schoolYearId: enrollment?.schoolYearId ?? null,
        schoolYearName: enrollment?.schoolYear?.nameYear ?? null,
        classId: enrollment?.classe?.id ?? null,
        className: enrollment?.classe?.nameClasse ?? null,
        classCode: enrollment?.classe?.codeClasse ?? null,
      });
    }
  }
  return out;
}

export async function assertParentOwnsStudent(params: {
  userId: string;
  organizationId: string;
  studentId: string;
}): Promise<ParentChild> {
  const children = await listParentChildren(params);
  const child = children.find((c) => c.studentId === params.studentId);
  if (!child) {
    throw new ParentMobileError("Élève non autorisé pour ce parent.", 403);
  }
  return child;
}

export async function getParentStudentFees(params: {
  userId: string;
  organizationId: string;
  studentId: string;
}) {
  const child = await assertParentOwnsStudent(params);
  if (!child.schoolYearId) {
    return {
      child,
      fees: [] as Array<{
        fraisId: string;
        nameFrais: string;
        due: number;
        paid: number;
        reste: number;
      }>,
      totalDue: 0,
      totalPaid: 0,
      totalReste: 0,
      remise: 0,
    };
  }
  const detail = await getStudentFeeStatus({
    organizationId: params.organizationId,
    branchId: child.branchId,
    schoolYearId: child.schoolYearId,
    studentId: child.studentId,
  });
  return {
    child,
    fees: detail?.fees ?? [],
    totalDue: detail?.totalDue ?? 0,
    totalPaid: detail?.totalPaid ?? 0,
    totalReste: detail?.totalReste ?? 0,
    remise: detail?.remise ?? 0,
  };
}

export async function getParentStudentGrades(params: {
  userId: string;
  organizationId: string;
  studentId: string;
}) {
  const child = await assertParentOwnsStudent(params);
  if (!child.schoolYearId) {
    return { child, periods: [] as Array<Record<string, unknown>> };
  }

  const branch = await prisma.branch.findUnique({
    where: { id: child.branchId },
    select: { typebranch: true, educationSystem: true },
  });

  const [grades, periodOptions] = await Promise.all([
    prisma.studentGrade.findMany({
      where: {
        studentId: child.studentId,
        branchId: child.branchId,
        schoolYearId: child.schoolYearId,
      },
      select: {
        periodId: true,
        score: true,
        period: { select: { id: true, label: true } },
      },
      orderBy: { periodId: "asc" },
    }),
    listBranchPeriodOptions({
      branchId: child.branchId,
      typebranch: branch?.typebranch,
      educationSystem: branch?.educationSystem,
      ensure: false,
    }),
  ]);

  const labelById = new Map(periodOptions.map((p) => [p.id, p.label]));
  const periods = grades.map((g) => {
    const score = Number(g.score);
    return {
      periodId: g.periodId,
      label: labelById.get(g.periodId) ?? g.period?.label ?? `Période ${g.periodId}`,
      score,
      // Pourcentage affiché tant que le maximum n’est pas exposé côté parent.
      percent: Math.round(score * 10) / 10,
    };
  });

  return { child, periods };
}

export async function getParentBulletinMeta(params: {
  userId: string;
  organizationId: string;
  studentId: string;
  periodId?: number;
}) {
  const child = await assertParentOwnsStudent(params);
  const branch = await prisma.branch.findUnique({
    where: { id: child.branchId },
    select: { typebranch: true, educationSystem: true },
  });
  const periods = await listBranchPeriodOptions({
    branchId: child.branchId,
    typebranch: branch?.typebranch,
    educationSystem: branch?.educationSystem,
    ensure: false,
  });

  const selected =
    params.periodId != null
      ? periods.find((p) => p.id === params.periodId) ?? null
      : null;

  return {
    child,
    periods: periods.map((p) => ({
      periodId: p.id,
      label: p.label,
    })),
    selectedPeriod: selected
      ? { periodId: selected.id, label: selected.label }
      : null,
    // PDF serveur pas encore branché : le client affiche la liste + message.
    pdfAvailable: false,
    pdfUrl: null as string | null,
  };
}

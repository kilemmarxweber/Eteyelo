import { prisma } from "@/lib/prisma";
import { getStudentFeeStatus } from "@/lib/reports/org/finance";
import {
  listBranchPeriodOptions,
  uniquePeriodOptions,
  type BranchPeriodOption,
} from "@/lib/academic-periods";
import { normalizeCycle, type Cycle } from "@/lib/cycle";

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

/**
 * Cycle de la classe (option/section) — même règle que getPeriods(classId).
 * Évite de mélanger maternelle / primaire / secondaire sur une branche multi-cycles.
 */
async function resolveChildClassCycle(child: ParentChild): Promise<{
  cycle: Cycle;
  typebranch: unknown;
  educationSystem: unknown;
} | null> {
  const branch = await prisma.branch.findUnique({
    where: { id: child.branchId },
    select: { typebranch: true, educationSystem: true },
  });
  if (!branch) return null;

  let classCycle: unknown = null;
  if (child.classId) {
    const classe = await prisma.classe.findFirst({
      where: { id: child.classId, branchId: child.branchId },
      select: {
        cycle: true,
        option: {
          select: {
            cycle: true,
            section: { select: { cycle: true } },
          },
        },
      },
    });
    classCycle =
      classe?.cycle ??
      classe?.option?.cycle ??
      classe?.option?.section?.cycle ??
      null;
  }

  const cycle =
    classCycle != null && classCycle !== ""
      ? normalizeCycle(classCycle)
      : normalizeCycle(branch.typebranch);

  return {
    cycle,
    typebranch: branch.typebranch,
    educationSystem: branch.educationSystem,
  };
}

/** Périodes du cycle de la classe, ordonnées (1ère, 2ème, Exam S1, …). */
async function listPeriodsForChildClass(
  child: ParentChild,
): Promise<BranchPeriodOption[]> {
  const ctx = await resolveChildClassCycle(child);
  if (!ctx) return [];

  const periods = await listBranchPeriodOptions({
    branchId: child.branchId,
    typebranch: ctx.typebranch,
    educationSystem: ctx.educationSystem,
    cycle: ctx.cycle,
    ensure: false,
  });

  return uniquePeriodOptions(periods);
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

  const periodOptions = await listPeriodsForChildClass(child);
  const allowedIds = new Set(periodOptions.map((p) => p.id));
  const orderById = new Map(periodOptions.map((p, index) => [p.id, index]));
  const labelById = new Map(periodOptions.map((p) => [p.id, p.label]));

  const grades = await prisma.studentGrade.findMany({
    where: {
      studentId: child.studentId,
      branchId: child.branchId,
      schoolYearId: child.schoolYearId,
      ...(allowedIds.size > 0 ? { periodId: { in: [...allowedIds] } } : {}),
    },
    select: {
      periodId: true,
      score: true,
      period: { select: { id: true, label: true } },
    },
  });

  const periods = grades
    .filter((g) => allowedIds.size === 0 || allowedIds.has(g.periodId))
    .map((g) => {
      const score = Number(g.score);
      return {
        periodId: g.periodId,
        label:
          labelById.get(g.periodId) ??
          g.period?.label ??
          `Période ${g.periodId}`,
        score,
        percent: Math.round(score * 10) / 10,
      };
    })
    .sort(
      (a, b) =>
        (orderById.get(a.periodId) ?? Number.MAX_SAFE_INTEGER) -
        (orderById.get(b.periodId) ?? Number.MAX_SAFE_INTEGER),
    );

  return { child, periods };
}

export async function getParentBulletinMeta(params: {
  userId: string;
  organizationId: string;
  studentId: string;
  periodId?: number;
}) {
  const child = await assertParentOwnsStudent(params);
  const periods = await listPeriodsForChildClass(child);

  const selected =
    params.periodId != null
      ? periods.find((p) => p.id === params.periodId) ?? null
      : null;

  return {
    child,
    periods: periods.map((p) => ({
      periodId: p.id,
      label: p.label,
      kind: p.kind,
      cycle: p.cycle,
    })),
    selectedPeriod: selected
      ? { periodId: selected.id, label: selected.label, kind: selected.kind }
      : null,
    // PDF serveur pas encore branché : le client affiche la liste + message.
    pdfAvailable: false,
    pdfUrl: null as string | null,
  };
}

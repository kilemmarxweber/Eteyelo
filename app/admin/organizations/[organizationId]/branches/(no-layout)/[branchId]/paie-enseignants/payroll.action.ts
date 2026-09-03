"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import {
  canComputePayroll,
  canPayPayroll,
  canValidatePayroll,
  getSessionRoles,
} from "@/lib/auth/session-roles";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  calculateAndPersistStaffPayroll,
  listPayrollAgents,
} from "@/lib/payroll/staff-payroll";
import {
  parsePayslipLineDetail,
  waivedSessionIdsFromLines,
} from "@/lib/payroll/teacher-payslip-line-detail";
import { recordPayslipSalaryExpense } from "@/lib/payroll/payslip-salary-expense";
import { settlePayrollTotals } from "@/lib/payroll/session-rate";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { StatusPaiement } from "@/src/interfaces/Paiement";
import { getBaseCurrency } from "@/lib/exchange-rate";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";

const CYCLE_SORT_ORDER: Record<string, number> = {
  MATERNELLE: 0,
  PRIMAIRE: 1,
  SECONDAIRE: 2,
  ATELIER: 3,
  CENTRE_FORMATION: 4,
  UNIVERSITE: 5,
  MIXTE: 6,
  PERSONNEL: 7,
  AUTRE: 8,
};

const CYCLE_LABELS: Record<string, string> = {
  MATERNELLE: "Maternelle",
  PRIMAIRE: "Primaire",
  SECONDAIRE: "Secondaire",
  ATELIER: "Atelier",
  CENTRE_FORMATION: "Centre de formation",
  UNIVERSITE: "Université",
  MIXTE: "Mixte",
  PERSONNEL: "Personnel",
  AUTRE: "Autre",
};

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
  month: z.coerce.number().int().min(1).max(12),
  schoolYearId: z.string().min(1).optional(),
});

const recalculateSchema = periodSchema.extend({
  teacherIds: z.array(z.string().min(1)).optional(),
  branchMemberIds: z.array(z.string().min(1)).optional(),
});

const deletePayslipsSchema = periodSchema.extend({
  payslipIds: z.array(z.string().min(1)).optional(),
});

const bulkPayslipsSchema = periodSchema.extend({
  payslipIds: z.array(z.string().min(1)).optional(),
});

const payslipSchema = z.object({ payslipId: z.string().min(1) });

const PAYSLIP_PAY_MEMBER_SELECT = {
  member: {
    select: {
      userId: true,
      role: true,
      user: {
        select: { name: true, postnom: true, prenom: true },
      },
    },
  },
} as const;

const PAYSLIP_PAY_TEACHER_SELECT = {
  branchMember: {
    select: PAYSLIP_PAY_MEMBER_SELECT,
  },
} as const;

type PayslipPayTeacher = {
  branchMember?: {
    member?: {
      userId?: string | null;
      user?: {
        name?: string | null;
        postnom?: string | null;
        prenom?: string | null;
      } | null;
    } | null;
  } | null;
};

function payslipAgentName(row: {
  teacher?: PayslipPayTeacher | null;
  personnel?: PayslipPayTeacher | null;
  branchMember?: PayslipPayTeacher["branchMember"] | null;
}) {
  const user =
    row.branchMember?.member?.user ??
    row.teacher?.branchMember?.member?.user ??
    row.personnel?.branchMember?.member?.user;
  return formatTeacherName(user);
}

function payslipAgentUserId(row: {
  teacher?: PayslipPayTeacher | null;
  personnel?: PayslipPayTeacher | null;
  branchMember?: PayslipPayTeacher["branchMember"] | null;
}) {
  return (
    row.branchMember?.member?.userId ??
    row.teacher?.branchMember?.member?.userId ??
    row.personnel?.branchMember?.member?.userId ??
    null
  );
}

function formatTeacherName(user?: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  return [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ");
}

function revalidatePayrollFinancePages(
  organizationId: string,
  branchId: string,
  payslipId?: string,
) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/paie-enseignants`,
  );
  if (payslipId) {
    revalidatePath(
      `/admin/organizations/${organizationId}/branches/${branchId}/paie-enseignants/${payslipId}`,
    );
  }
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/paiement`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/transactions`,
  );
}

async function markPayslipPaidInTx(
  tx: {
    teacherPayslip: typeof prisma.teacherPayslip;
    appNotification: typeof prisma.appNotification;
    transaction: typeof prisma.transaction;
    cashierExpense: typeof prisma.cashierExpense;
  },
  params: {
    payslip: {
      id: string;
      net: number;
      month: number;
      year: number;
      currency: string;
      teacher?: PayslipPayTeacher | null;
      personnel?: PayslipPayTeacher | null;
      branchMember?: PayslipPayTeacher["branchMember"] | null;
    };
    branchId: string;
    organizationId: string;
    userId: string;
    paidAt: Date;
  },
) {
  await tx.teacherPayslip.update({
    where: { id: params.payslip.id },
    data: {
      status: "PAID",
      paidAt: params.paidAt,
      paidById: params.userId,
    },
  });

  await recordPayslipSalaryExpense(tx, {
    branchId: params.branchId,
    userId: params.userId,
    payslipId: params.payslip.id,
    amount: params.payslip.net,
    teacherName: payslipAgentName(params.payslip),
    year: params.payslip.year,
    month: params.payslip.month,
  });

  const teacherUserId = payslipAgentUserId(params.payslip);
  if (teacherUserId) {
    await tx.appNotification.create({
      data: {
        branchId: params.branchId,
        organizationId: params.organizationId,
        userId: teacherUserId,
        type: "PAYROLL",
        title: "Bulletin de paie payé",
        body: `Votre bulletin de ${params.payslip.month}/${params.payslip.year} est payé. Net : ${params.payslip.net} ${params.payslip.currency}.`,
        href: `/admin/organizations/${params.organizationId}/branches/${params.branchId}/paie-enseignants/${params.payslip.id}`,
      },
    });
  }
}
const policySchema = z.object({
  secondarySessionMinutes: z.coerce.number().int().min(1).max(240),
  primarySessionMinutes: z.coerce.number().int().min(1).max(240),
  secondaryHourlyRate: z.coerce.number().min(0),
  secondaryMatriculePrimePercent: z.coerce.number().min(0).max(1000),
  secondaryNonMatriculeSessionRate: z.coerce.number().min(0),
  primaryMatriculeMonthly: z.coerce.number().min(0),
  primaryNonMatriculeMonthly: z.coerce.number().min(0),
  lateGraceMinutes: z.coerce.number().int().min(0).max(120),
  notifyByEmail: z.boolean(),
});

const DELETABLE_STATUSES = ["DRAFT", "VALIDATED"] as const;

async function getContext() {
  const context = await requireBranchContext();
  await assertBranchAreaAccess("payroll", context.session, {
    organizationId: context.organizationId,
    branchId: context.branchId,
  });
  return context;
}

async function getTeacherForUser(branchId: string, userId: string) {
  return prisma.teacher.findFirst({
    where: {
      isActive: true,
      branchMember: { branchId, member: { userId } },
    },
    select: { id: true },
  });
}

async function resolveSchoolYearId(
  branchId: string,
  schoolYearId?: string,
) {
  const year = await prisma.schoolYear.findFirst({
    where: {
      branchId,
      isArchived: false,
      ...(schoolYearId ? { id: schoolYearId } : { isCurrentYear: true }),
    },
    orderBy: [{ isCurrentYear: "desc" }, { startYear: "desc" }],
    select: { id: true },
  });
  if (schoolYearId && !year) {
    throw new Error("Année scolaire introuvable dans cette branche");
  }
  return year?.id ?? null;
}

export const getPayrollSchoolYearsAction = action.handler(async () => {
  const context = await getContext();
  const years = await prisma.schoolYear.findMany({
    where: { branchId: context.branchId, isArchived: false },
    orderBy: [{ isCurrentYear: "desc" }, { startYear: "desc" }],
    select: {
      id: true,
      nameYear: true,
      startYear: true,
      endYear: true,
      isCurrentYear: true,
    },
  });

  return years.map((year) => ({
    ...year,
    startYear: year.startYear.toISOString(),
    endYear: year.endYear.toISOString(),
  }));
});

export const getPayrollPolicyAction = action.handler(async () => {
  const context = await getContext();
  return prisma.branchPayrollPolicy.upsert({
    where: { branchId: context.branchId },
    create: { branchId: context.branchId },
    update: {},
  });
});

export const updatePayrollPolicyAction = action
  .input(policySchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canComputePayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de modifier le barème");
    }
    const policy = await prisma.branchPayrollPolicy.upsert({
      where: { branchId: context.branchId },
      create: { branchId: context.branchId, ...input },
      update: input,
    });
    revalidatePath(
      `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants`,
    );
    return policy;
  });

function extractClassNames(
  lines: Array<{ label: string; detail: unknown }>,
): string[] {
  const classes = new Set<string>();
  for (const line of lines) {
    const detail =
      line.detail && typeof line.detail === "object"
        ? (line.detail as { className?: string })
        : null;
    if (detail?.className?.trim()) {
      classes.add(detail.className.trim());
      continue;
    }
    if (line.label.startsWith("Forfait")) continue;
    const separator = line.label.indexOf(" · ");
    if (separator > 0) {
      const className = line.label.slice(0, separator).trim();
      if (className) classes.add(className);
    }
  }
  return [...classes].sort((a, b) => a.localeCompare(b, "fr"));
}

function extractCycles(
  lines: Array<{ cycle: string | null }>,
): string[] {
  const cycles = new Set<string>();
  for (const line of lines) {
    if (line.cycle) cycles.add(line.cycle);
  }
  return [...cycles].sort(
    (a, b) => (CYCLE_SORT_ORDER[a] ?? 99) - (CYCLE_SORT_ORDER[b] ?? 99),
  );
}

function resolveCycleGroup(
  cycles: string[],
  agentKind?: string | null,
): string {
  if (agentKind === "PERSONNEL") return "PERSONNEL";
  if (cycles.length === 0) return agentKind === "BOTH" ? "PERSONNEL" : "AUTRE";
  if (cycles.length === 1) return cycles[0]!;
  return "MIXTE";
}

function toListItem(row: {
  id: string;
  teacherId: string | null;
  branchMemberId: string;
  agentKind: string;
  year: number;
  month: number;
  currency: string;
  gross: number;
  deductions: number;
  net: number;
  status: string;
  createdAt: Date;
  branch?: { name: string } | null;
  teacher?: {
    employmentKind: string;
    branchMember?: {
      member?: {
        role?: string | null;
        user?: {
          name?: string | null;
          postnom?: string | null;
          prenom?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
  personnel?: {
    monthlyForfait?: number | null;
    branchMember?: {
      member?: {
        role?: string | null;
        user?: {
          name?: string | null;
          postnom?: string | null;
          prenom?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
  branchMember?: {
    member?: {
      role?: string | null;
      user?: {
        name?: string | null;
        postnom?: string | null;
        prenom?: string | null;
      } | null;
    } | null;
  } | null;
  lines: Array<{
    sessions: number;
    label: string;
    detail: unknown;
    cycle: string | null;
    minutes: number;
    kind: string;
  }>;
}) {
  const user =
    row.branchMember?.member?.user ??
    row.teacher?.branchMember?.member?.user ??
    row.personnel?.branchMember?.member?.user;
  const classes = extractClassNames(row.lines);
  const cycles = extractCycles(row.lines);
  const cycleGroup = resolveCycleGroup(cycles, row.agentKind);
  const lostMinutes = row.lines
    .filter((line) =>
      line.kind === "ABSENCE" || line.kind === "LATE" || line.kind === "EARLY_EXIT",
    )
    .reduce((sum, line) => sum + Number(line.minutes || 0), 0);
  const contractLabel =
    row.agentKind === "PERSONNEL"
      ? "Forfait"
      : row.teacher?.employmentKind === "MATRICULE"
        ? row.agentKind === "BOTH"
          ? "Matriculé + forfait"
          : "Matriculé"
        : row.agentKind === "BOTH"
          ? "Non matriculé + forfait"
          : "Non matriculé";
  return {
    id: row.id,
    teacherId: row.teacherId,
    branchMemberId: row.branchMemberId,
    agentKind: row.agentKind,
    teacherName: [user?.name, user?.postnom, user?.prenom]
      .filter(Boolean)
      .join(" "),
    employmentKind: row.teacher?.employmentKind ?? "FORFAIT",
    contractLabel,
    branchName: row.branch?.name ?? "",
    classes,
    classSummary:
      classes.length === 0
        ? "—"
        : classes.length <= 3
          ? classes.join(" · ")
          : `${classes.slice(0, 2).join(" · ")} +${classes.length - 2}`,
    cycles,
    cycleGroup,
    cycleLabel:
      row.agentKind === "PERSONNEL"
        ? "Personnel"
        : cycles.length === 0
          ? "—"
          : cycles.length === 1
            ? (CYCLE_LABELS[cycles[0]!] ?? cycles[0])
            : cycles.map((cycle) => CYCLE_LABELS[cycle] ?? cycle).join(" · "),
    year: row.year,
    month: row.month,
    currency: row.currency,
    gross: row.gross,
    deductions: row.deductions,
    net: row.net,
    lostMinutes: Math.round(lostMinutes * 10) / 10,
    difference: Math.round((row.gross - row.net) * 100) / 100,
    status: row.status,
    sessions: row.lines.reduce((sum, line) => sum + line.sessions, 0),
    createdAt: row.createdAt,
  };
}

export const getPayrollCashSnapshotAction = action
  .input(periodSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    const schoolYearId = await resolveSchoolYearId(
      context.branchId,
      input.schoolYearId,
    );

    const [incomeAgg, expenseAgg, rates, payrollRows] = await Promise.all([
      prisma.familyPayment.aggregate({
        where: {
          branchId: context.branchId,
          status: StatusPaiement.VALIDE,
          isArchived: false,
        },
        _sum: { amount: true },
      }),
      prisma.cashierExpense.aggregate({
        where: { branchId: context.branchId, isArchived: false },
        _sum: { amount: true },
      }),
      prisma.exchangeRate.findMany({
        where: { organizationId: context.organizationId, isActive: true },
        select: {
          fromCurrency: true,
          toCurrency: true,
          rate: true,
          isActive: true,
          isSelected: true,
        },
      }),
      prisma.teacherPayslip.findMany({
        where: {
          branchId: context.branchId,
          year: input.year,
          month: input.month,
          ...(schoolYearId ? { schoolYearId } : {}),
          status: { in: ["DRAFT", "VALIDATED"] },
        },
        select: { net: true, gross: true, deductions: true, status: true },
      }),
    ]);

    const incomeTotal = Number(incomeAgg._sum.amount ?? 0);
    const expenseTotal = Number(expenseAgg._sum.amount ?? 0);
    const cashNet = incomeTotal - expenseTotal;
    const payrollConsume = payrollRows.reduce((sum, row) => sum + row.net, 0);
    const payrollGross = payrollRows.reduce((sum, row) => sum + row.gross, 0);
    const payrollDeductions = payrollRows.reduce(
      (sum, row) => sum + row.deductions,
      0,
    );

    return {
      currency: getBaseCurrency(rates),
      incomeTotal,
      expenseTotal,
      cashNet,
      payrollConsume,
      payrollGross,
      payrollDeductions,
      remainingAfterPayroll: cashNet - payrollConsume,
      unpaidCount: payrollRows.length,
    };
  });

export const getTeacherPayslipsAction = action
  .input(periodSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    const schoolYearId = await resolveSchoolYearId(
      context.branchId,
      input.schoolYearId,
    );
    const teacher = await getTeacherForUser(context.branchId, context.userId);
    const roles = getSessionRoles(context.session);
    const isTeacher = roles.has("teacher");
    if (isTeacher && !teacher) return [];

    const rows = await prisma.teacherPayslip.findMany({
      where: {
        branchId: context.branchId,
        year: input.year,
        month: input.month,
        ...(schoolYearId ? { schoolYearId } : {}),
        ...(isTeacher && teacher ? { teacherId: teacher.id } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        branch: { select: { name: true } },
        teacher: {
          select: {
            employmentKind: true,
            branchMember: {
              select: {
                member: {
                  select: {
                    role: true,
                    user: { select: { name: true, postnom: true, prenom: true } },
                  },
                },
              },
            },
          },
        },
        personnel: {
          select: {
            monthlyForfait: true,
            branchMember: {
              select: {
                member: {
                  select: {
                    role: true,
                    user: { select: { name: true, postnom: true, prenom: true } },
                  },
                },
              },
            },
          },
        },
        branchMember: {
          select: {
            member: {
              select: {
                role: true,
                user: { select: { name: true, postnom: true, prenom: true } },
              },
            },
          },
        },
        lines: {
          select: {
            sessions: true,
            label: true,
            detail: true,
            cycle: true,
            minutes: true,
            kind: true,
          },
        },
      },
    });

    return rows
      .map(toListItem)
      .sort((a, b) => {
        const cycleDiff =
          (CYCLE_SORT_ORDER[a.cycleGroup] ?? 99) -
          (CYCLE_SORT_ORDER[b.cycleGroup] ?? 99);
        if (cycleDiff !== 0) return cycleDiff;
        return a.teacherName.localeCompare(b.teacherName, "fr");
      });
  });

export const recalculateTeacherPayslipsAction = action
  .input(recalculateSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canComputePayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de recalculer la paie");
    }

    const schoolYearId = await resolveSchoolYearId(
      context.branchId,
      input.schoolYearId,
    );
    const agents = await listPayrollAgents(context.branchId, {
      teacherIds: input.teacherIds,
      branchMemberIds: input.branchMemberIds,
    });
    if (
      (input.teacherIds?.length || input.branchMemberIds?.length) &&
      agents.length === 0
    ) {
      throw new Error("Aucun agent sélectionné introuvable");
    }

    const results = [];
    let missingExchangeRate = false;
    let skippedPaid = 0;
    let skippedNoForfait = 0;
    for (const agent of agents) {
      const paid = await prisma.teacherPayslip.findFirst({
        where: {
          branchId: context.branchId,
          branchMemberId: agent.branchMemberId,
          year: input.year,
          month: input.month,
          status: "PAID",
        },
        select: { id: true },
      });
      if (paid) {
        skippedPaid += 1;
        continue;
      }

      const previous = await prisma.teacherPayslip.findFirst({
        where: {
          branchId: context.branchId,
          branchMemberId: agent.branchMemberId,
          year: input.year,
          month: input.month,
          status: { in: [...DELETABLE_STATUSES] },
        },
        select: { lines: { select: { sessionId: true, detail: true } } },
      });
      const waivedSessionIds = waivedSessionIdsFromLines(previous?.lines ?? []);

      await prisma.teacherPayslip.deleteMany({
        where: {
          branchId: context.branchId,
          branchMemberId: agent.branchMemberId,
          year: input.year,
          month: input.month,
          status: { in: [...DELETABLE_STATUSES] },
        },
      });

      const persisted = await calculateAndPersistStaffPayroll({
        branchId: context.branchId,
        organizationId: context.organizationId,
        period: { ...input, schoolYearId },
        agent,
        waivedSessionIds,
      });
      if (persisted.skipped === "NO_FORFAIT") {
        skippedNoForfait += 1;
        continue;
      }
      missingExchangeRate ||= persisted.missingExchangeRate;
      if (persisted.payslipId) results.push(persisted.payslipId);
    }

    if (results.length > 0) {
      await prisma.appNotification.create({
        data: {
          branchId: context.branchId,
          organizationId: context.organizationId,
          userId: context.userId,
          type: "PAYROLL",
          title: "Paie du personnel générée",
          body: `${results.length} bulletin(s) brouillon(s) généré(s) pour ${input.month}/${input.year}.`,
          href: `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants?year=${input.year}&month=${input.month}`,
        },
      });
    }
    revalidatePath(
      `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants`,
    );
    return {
      count: results.length,
      missingExchangeRate,
      skippedPaid,
      skippedNoForfait,
    };
  });

export const deleteTeacherPayslipsAction = action
  .input(deletePayslipsSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canComputePayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de supprimer les bulletins");
    }

    const schoolYearId = await resolveSchoolYearId(
      context.branchId,
      input.schoolYearId,
    );

    const result = await prisma.teacherPayslip.deleteMany({
      where: {
        branchId: context.branchId,
        year: input.year,
        month: input.month,
        status: { in: [...DELETABLE_STATUSES] },
        ...(schoolYearId ? { schoolYearId } : {}),
        ...(input.payslipIds && input.payslipIds.length > 0
          ? { id: { in: input.payslipIds } }
          : {}),
      },
    });

    revalidatePath(
      `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants`,
    );
    return { count: result.count };
  });

export const getTeacherPayslipAction = action
  .input(payslipSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    const teacher = await getTeacherForUser(context.branchId, context.userId);
    const roles = getSessionRoles(context.session);
    if (roles.has("teacher") && !teacher) throw new Error("Profil enseignant introuvable");
    const row = await prisma.teacherPayslip.findFirst({
      where: {
        id: input.payslipId,
        branchId: context.branchId,
        ...(roles.has("teacher") && teacher ? { teacherId: teacher.id } : {}),
      },
      include: {
        teacher: {
          select: {
            employmentKind: true,
            matriculeEtat: true,
            branchMember: {
              select: {
                member: {
                  select: { user: { select: { name: true, postnom: true, prenom: true, email: true } } },
                },
              },
            },
          },
        },
        personnel: {
          select: {
            monthlyForfait: true,
            branchMember: {
              select: {
                member: {
                  select: { user: { select: { name: true, postnom: true, prenom: true, email: true } } },
                },
              },
            },
          },
        },
        branchMember: {
          select: {
            member: {
              select: { user: { select: { name: true, postnom: true, prenom: true, email: true } } },
            },
          },
        },
        lines: { orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }] },
        policy: { select: { lateGraceMinutes: true } },
      },
    });
    if (!row) throw new Error("Bulletin introuvable");

    const sessionIds = row.lines
      .map((line) => line.sessionId)
      .filter((id): id is string => Boolean(id));
    const sessions =
      sessionIds.length > 0
        ? await prisma.attendanceSession.findMany({
            where: { id: { in: sessionIds }, branchId: context.branchId },
            select: {
              id: true,
              startTime: true,
              endTime: true,
              teaching: {
                select: {
                  classe: {
                    select: {
                      nameClasse: true,
                      creneau: { select: { durationCourse: true } },
                    },
                  },
                  cours: { select: { nameCours: true } },
                },
              },
              teacherAttendance: {
                where: row.teacherId ? { teacherId: row.teacherId } : { id: { in: [] } },
                select: {
                  status: true,
                  checkIn: true,
                  checkOut: true,
                  earlyExit: true,
                },
              },
            },
          })
        : [];
    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const grace =
      row.policy?.lateGraceMinutes ??
      (typeof row.policySnapshot === "object" &&
      row.policySnapshot &&
      "lateGraceMinutes" in row.policySnapshot
        ? Number((row.policySnapshot as { lateGraceMinutes?: number }).lateGraceMinutes)
        : 10);

    return {
      ...row,
      lines: row.lines.map((line) => {
        if (line.detail || !line.sessionId) return line;
        const session = sessionById.get(line.sessionId);
        if (!session) return line;
        const attendance = session.teacherAttendance[0];
        const plannedMinutes = Math.max(
          0,
          (session.endTime.getTime() - session.startTime.getTime()) / 60000 ||
            session.teaching.classe?.creneau?.durationCourse ||
            0,
        );
        const status = (attendance?.status ?? "ABSENT") as
          | "PRESENT"
          | "LATE"
          | "ABSENT"
          | "EXCUSED";
        const lateMinutes =
          attendance?.checkIn && status === "LATE"
            ? Math.max(
                0,
                (attendance.checkIn.getTime() - session.startTime.getTime()) / 60000 -
                  grace,
              )
            : 0;
        const earlyExitMinutes =
          attendance?.earlyExit && attendance.checkOut
            ? Math.max(
                0,
                (session.endTime.getTime() - attendance.checkOut.getTime()) / 60000,
              )
            : 0;
        return {
          ...line,
          detail: {
            startTime: session.startTime.toISOString(),
            endTime: session.endTime.toISOString(),
            plannedMinutes: Math.round(plannedMinutes * 10) / 10,
            lateMinutes: Math.round(lateMinutes * 10) / 10,
            earlyExitMinutes: Math.round(earlyExitMinutes * 10) / 10,
            lostMinutes: line.minutes,
            checkIn: attendance?.checkIn?.toISOString() ?? null,
            checkOut: attendance?.checkOut?.toISOString() ?? null,
            status,
            className: session.teaching.classe?.nameClasse ?? "Classe",
            courseName: session.teaching.cours.nameCours,
            graceMinutes: grace,
            reason:
              line.kind === "ABSENCE" || line.kind === "LATE" || line.kind === "EARLY_EXIT"
                ? line.kind
                : null,
          },
        };
      }),
    };
  });

export const validateTeacherPayslipAction = action
  .input(payslipSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canValidatePayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de valider la paie");
    }
    const row = await prisma.teacherPayslip.findFirst({
      where: { id: input.payslipId, branchId: context.branchId, status: "DRAFT" },
    });
    if (!row) throw new Error("Bulletin brouillon introuvable");
    if (!row.exchangeRateId) {
      throw new Error(
        "Aucun taux de change sélectionné. Configurez la devise de base avant de valider la paie.",
      );
    }
    await prisma.teacherPayslip.update({
      where: { id: row.id },
      data: {
        status: "VALIDATED",
        validatedAt: new Date(),
        validatedById: context.userId,
      },
    });
    revalidatePayrollFinancePages(context.organizationId, context.branchId, row.id);
    return { ok: true };
  });

export const validateAllTeacherPayslipsAction = action
  .input(bulkPayslipsSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canValidatePayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de valider la paie");
    }
    const schoolYearId = await resolveSchoolYearId(
      context.branchId,
      input.schoolYearId,
    );
    const drafts = await prisma.teacherPayslip.findMany({
      where: {
        branchId: context.branchId,
        year: input.year,
        month: input.month,
        status: "DRAFT",
        ...(schoolYearId ? { schoolYearId } : {}),
        ...(input.payslipIds?.length ? { id: { in: input.payslipIds } } : {}),
      },
      select: { id: true, exchangeRateId: true },
    });
    const ready = drafts.filter((row) => row.exchangeRateId);
    const skippedNoRate = drafts.length - ready.length;
    if (ready.length === 0) {
      if (skippedNoRate > 0) {
        throw new Error(
          "Aucun taux de change sélectionné. Configurez la devise de base avant de valider la paie.",
        );
      }
      throw new Error("Aucun bulletin brouillon à valider");
    }

    await prisma.teacherPayslip.updateMany({
      where: {
        id: { in: ready.map((row) => row.id) },
        branchId: context.branchId,
        status: "DRAFT",
      },
      data: {
        status: "VALIDATED",
        validatedAt: new Date(),
        validatedById: context.userId,
      },
    });
    revalidatePayrollFinancePages(context.organizationId, context.branchId);
    return { count: ready.length, skippedNoRate };
  });

export const payTeacherPayslipAction = action
  .input(payslipSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canPayPayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de marquer la paie payée");
    }
    const row = await prisma.teacherPayslip.findFirst({
      where: {
        id: input.payslipId,
        branchId: context.branchId,
        status: "VALIDATED",
      },
      include: {
        teacher: { select: PAYSLIP_PAY_TEACHER_SELECT },
        personnel: {
          select: { branchMember: { select: PAYSLIP_PAY_MEMBER_SELECT } },
        },
        branchMember: { select: PAYSLIP_PAY_MEMBER_SELECT },
      },
    });
    if (!row) throw new Error("Bulletin validé introuvable");

    await prisma.$transaction(async (tx) => {
      await markPayslipPaidInTx(tx, {
        payslip: row,
        branchId: context.branchId,
        organizationId: context.organizationId,
        userId: context.userId,
        paidAt: new Date(),
      });
    });

    revalidatePayrollFinancePages(
      context.organizationId,
      context.branchId,
      row.id,
    );
    return { ok: true };
  });

export const payAllTeacherPayslipsAction = action
  .input(bulkPayslipsSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canPayPayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de marquer la paie payée");
    }
    const schoolYearId = await resolveSchoolYearId(
      context.branchId,
      input.schoolYearId,
    );
    const rows = await prisma.teacherPayslip.findMany({
      where: {
        branchId: context.branchId,
        year: input.year,
        month: input.month,
        status: "VALIDATED",
        ...(schoolYearId ? { schoolYearId } : {}),
        ...(input.payslipIds?.length ? { id: { in: input.payslipIds } } : {}),
      },
      include: {
        teacher: { select: PAYSLIP_PAY_TEACHER_SELECT },
        personnel: {
          select: { branchMember: { select: PAYSLIP_PAY_MEMBER_SELECT } },
        },
        branchMember: { select: PAYSLIP_PAY_MEMBER_SELECT },
      },
    });
    if (rows.length === 0) {
      throw new Error("Aucun bulletin validé à payer");
    }

    const paidAt = new Date();
    await prisma.$transaction(
      async (tx) => {
        for (const row of rows) {
          await markPayslipPaidInTx(tx, {
            payslip: row,
            branchId: context.branchId,
            organizationId: context.organizationId,
            userId: context.userId,
            paidAt,
          });
        }
      },
      { timeout: 60_000 },
    );

    revalidatePayrollFinancePages(context.organizationId, context.branchId);
    return { count: rows.length };
  });

const LOSS_LINE_KINDS = new Set(["ABSENCE", "LATE", "EARLY_EXIT"]);
const DEDUCTION_LINE_KINDS = new Set(["ABSENCE", "LATE", "EARLY_EXIT", "ADVANCE"]);

export const waiveTeacherPayslipDeductionAction = action
  .input(
    z.object({
      payslipId: z.string().min(1),
      lineId: z.string().min(1),
      waive: z.boolean(),
    }),
  )
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canComputePayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de modifier une retenue");
    }

    const payslip = await prisma.teacherPayslip.findFirst({
      where: { id: input.payslipId, branchId: context.branchId },
      include: { lines: true },
    });
    if (!payslip) throw new Error("Bulletin introuvable");
    if (payslip.status === "PAID" || payslip.status === "CANCELLED") {
      throw new Error("Ce bulletin ne peut plus être modifié");
    }

    const line = payslip.lines.find((row) => row.id === input.lineId);
    if (!line) throw new Error("Ligne introuvable");
    if (!LOSS_LINE_KINDS.has(line.kind)) {
      throw new Error("Seule une retenue (absence, retard, sortie) peut être retirée");
    }

    const currentDetail = parsePayslipLineDetail(line.detail);
    const baseDetail =
      currentDetail ??
      (typeof line.detail === "object" && line.detail ? line.detail : {});

    if (input.waive) {
      if (line.amount <= 0 && currentDetail?.waived) {
        throw new Error("Cette retenue est déjà retirée");
      }
      await prisma.teacherPayslipLine.update({
        where: { id: line.id },
        data: {
          amount: 0,
          detail: {
            ...baseDetail,
            waived: true,
            waivedAmount: line.amount > 0 ? line.amount : currentDetail?.waivedAmount,
          },
        },
      });
    } else {
      if (!currentDetail?.waived) {
        throw new Error("Cette retenue n'est pas retirée");
      }
      await prisma.teacherPayslipLine.update({
        where: { id: line.id },
        data: {
          amount: currentDetail.waivedAmount ?? 0,
          detail: {
            ...baseDetail,
            waived: false,
          },
        },
      });
    }

    const lines = await prisma.teacherPayslipLine.findMany({
      where: { payslipId: payslip.id },
      select: { kind: true, amount: true },
    });
    const deductions = lines
      .filter((row) => DEDUCTION_LINE_KINDS.has(row.kind))
      .reduce((sum, row) => sum + row.amount, 0);
    const settled = settlePayrollTotals(
      payslip.gross,
      deductions,
      payslip.currency,
    );

    await prisma.teacherPayslip.update({
      where: { id: payslip.id },
      data: {
        deductions: settled.deductions,
        net: settled.net,
        ...(payslip.status === "VALIDATED"
          ? { status: "DRAFT", validatedAt: null, validatedById: null }
          : {}),
      },
    });

    revalidatePath(
      `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants`,
    );
    revalidatePath(
      `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants/${payslip.id}`,
    );
    return {
      ...settled,
      status: payslip.status === "VALIDATED" ? "DRAFT" : payslip.status,
    };
  });

export const getPayrollReportContextAction = action.handler(async () => {
  const context = await getContext();
  const branch = await prisma.branch.findFirst({
    where: { id: context.branchId, organizationId: context.organizationId },
    select: schoolReportBranchSelect,
  });
  if (!branch) throw new Error("Branche active introuvable");
  return buildSchoolReportContext(branch);
});

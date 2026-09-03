"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import {
  canComputePayroll,
  canPayPayroll,
} from "@/lib/auth/session-roles";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getBranchPayrollOwners } from "@/lib/email/get-branch-manager-emails";
import {
  DEFAULT_EXCHANGE_PAIRS,
  getBaseCurrency,
} from "@/lib/exchange-rate";
import {
  MAX_SALARY_ADVANCE_INSTALLMENTS,
  planAdvanceInstallments,
} from "@/lib/payroll/salary-advance";
import { recordSalaryAdvanceExpense } from "@/lib/payroll/payslip-salary-expense";
import { calculateAndPersistStaffPayroll, listPayrollAgents } from "@/lib/payroll/staff-payroll";
import { waivedSessionIdsFromLines } from "@/lib/payroll/teacher-payslip-line-detail";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";

const periodPart = {
  firstYear: z.coerce.number().int().min(2000).max(2200),
  firstMonth: z.coerce.number().int().min(1).max(12),
};

const requestSchema = z.object({
  teacherId: z.string().min(1).optional(),
  personnelId: z.string().min(1).optional(),
  amount: z.coerce.number().positive(),
  installmentCount: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_SALARY_ADVANCE_INSTALLMENTS),
  reason: z.string().trim().max(500).optional(),
  approveNow: z.boolean().optional(),
  ...periodPart,
});

type PersonUser = {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
};

function formatPersonName(user?: PersonUser | null) {
  return [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ");
}

async function getContext() {
  return requireBranchContext();
}

async function requirePayrollOwner() {
  const context = await getContext();
  await assertBranchAreaAccess("payroll", context.session, {
    organizationId: context.organizationId,
    branchId: context.branchId,
  });
  if (!canComputePayroll(context.session)) {
    throw new Error("Vous n'avez pas le droit de gérer les avances sur salaire");
  }
  return context;
}

const memberUserSelect = {
  member: {
    select: {
      userId: true,
      user: { select: { name: true, postnom: true, prenom: true } },
    },
  },
} as const;

const teacherInclude = {
  branchMember: { select: memberUserSelect },
} as const;

const personnelInclude = {
  branchMember: { select: memberUserSelect },
} as const;

async function getTeacherForUser(branchId: string, userId: string) {
  return prisma.teacher.findFirst({
    where: {
      isActive: true,
      branchMember: { branchId, member: { userId } },
    },
    select: {
      id: true,
      canRequestSalaryAdvance: true,
      branchMemberId: true,
    },
  });
}

async function getPersonnelForUser(branchId: string, userId: string) {
  return prisma.personnel.findFirst({
    where: {
      isActive: true,
      branchMember: { branchId, member: { userId } },
    },
    select: {
      id: true,
      canRequestSalaryAdvance: true,
      branchMemberId: true,
    },
  });
}

async function ensureSelectedRate(organizationId: string) {
  const selected = await prisma.exchangeRate.findFirst({
    where: { organizationId, isSelected: true, isActive: true },
    select: { id: true },
  });
  if (selected) return;

  const preferred = await prisma.exchangeRate.findFirst({
    where: { organizationId, isActive: true },
    orderBy: [{ fromCurrency: "asc" }, { toCurrency: "asc" }],
  });
  if (!preferred) return;

  await prisma.exchangeRate.updateMany({
    where: { organizationId, isSelected: true },
    data: { isSelected: false },
  });
  await prisma.exchangeRate.update({
    where: { id: preferred.id },
    data: { isSelected: true },
  });
}

async function resolveBaseCurrency(organizationId: string, userId?: string) {
  const existing = await prisma.exchangeRate.count({
    where: { organizationId },
  });
  if (existing === 0) {
    await prisma.exchangeRate.createMany({
      data: DEFAULT_EXCHANGE_PAIRS.map((pair) => ({
        organizationId,
        fromCurrency: pair.fromCurrency,
        toCurrency: pair.toCurrency,
        rate: pair.rate,
        isActive: true,
        isSelected: pair.isSelected === true,
        createdBy: userId ?? null,
      })),
      skipDuplicates: true,
    });
  }
  await ensureSelectedRate(organizationId);

  const rates = await prisma.exchangeRate.findMany({
    where: { organizationId, isActive: true },
    select: {
      fromCurrency: true,
      toCurrency: true,
      rate: true,
      isActive: true,
      isSelected: true,
    },
  });
  return getBaseCurrency(rates);
}

function revalidateAdvancePages(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/paie-enseignants`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/paie-enseignants/credits`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/paiement`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/transactions`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/ma-presence`,
  );
}

async function refreshDraftPayslip(params: {
  branchId: string;
  organizationId: string;
  teacherId?: string | null;
  personnelId?: string | null;
  year: number;
  month: number;
}) {
  const existing = await prisma.teacherPayslip.findFirst({
    where: {
      branchId: params.branchId,
      year: params.year,
      month: params.month,
      status: "DRAFT",
      OR: [
        ...(params.teacherId ? [{ teacherId: params.teacherId }] : []),
        ...(params.personnelId ? [{ personnelId: params.personnelId }] : []),
      ],
    },
    select: {
      schoolYearId: true,
      branchMemberId: true,
      lines: { select: { sessionId: true, detail: true } },
    },
  });
  if (!existing) return false;

  const agents = await listPayrollAgents(params.branchId, {
    branchMemberIds: [existing.branchMemberId],
  });
  const agent = agents[0];
  if (!agent) return false;

  await calculateAndPersistStaffPayroll({
    branchId: params.branchId,
    organizationId: params.organizationId,
    period: {
      year: params.year,
      month: params.month,
      schoolYearId: existing.schoolYearId,
    },
    agent,
    waivedSessionIds: waivedSessionIdsFromLines(existing.lines),
  });
  return true;
}

function serializeAdvance(row: {
  id: string;
  amount: number;
  installmentCount: number;
  currency: string;
  reason: string | null;
  status: string;
  firstYear: number;
  firstMonth: number;
  expenseRef: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  teacherId?: string | null;
  personnelId?: string | null;
  teacher: {
    id: string;
    branchMember?: {
      member?: { user?: PersonUser | null } | null;
    } | null;
  } | null;
  personnel?: {
    id: string;
    branchMember?: {
      member?: { user?: PersonUser | null } | null;
    } | null;
  } | null;
  requestedBy: PersonUser;
  reviewedBy: PersonUser | null;
  installments: Array<{
    id: string;
    sequence: number;
    year: number;
    month: number;
    amount: number;
    status: string;
    deductedAt: Date | null;
  }>;
}) {
  const name =
    formatPersonName(row.teacher?.branchMember?.member?.user) ||
    formatPersonName(row.personnel?.branchMember?.member?.user);
  return {
    id: row.id,
    teacherId: row.teacher?.id ?? row.teacherId ?? "",
    personnelId: row.personnel?.id ?? row.personnelId ?? null,
    teacherName: name || "Agent",
    kind: row.teacher?.id && row.personnel?.id
      ? "both"
      : row.personnel?.id && !row.teacher?.id
        ? "personnel"
        : "teacher",
    amount: row.amount,
    installmentCount: row.installmentCount,
    currency: row.currency,
    reason: row.reason,
    status: row.status,
    firstYear: row.firstYear,
    firstMonth: row.firstMonth,
    expenseRef: row.expenseRef,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    requestedByName: formatPersonName(row.requestedBy),
    reviewedByName: formatPersonName(row.reviewedBy),
    installments: row.installments
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((item) => ({
        id: item.id,
        sequence: item.sequence,
        year: item.year,
        month: item.month,
        amount: item.amount,
        status: item.status,
        deductedAt: item.deductedAt?.toISOString() ?? null,
      })),
  };
}

const advanceListInclude = {
  teacher: { select: { id: true, ...teacherInclude } },
  personnel: { select: { id: true, ...personnelInclude } },
  requestedBy: { select: { name: true, postnom: true, prenom: true } },
  reviewedBy: { select: { name: true, postnom: true, prenom: true } },
  installments: true,
} as const;

async function approveAdvanceInTx(params: {
  advanceId: string;
  branchId: string;
  organizationId: string;
  userId: string;
  installmentCount: number;
  firstYear: number;
  firstMonth: number;
  teacherName: string;
}) {
  const advance = await prisma.salaryAdvance.findFirst({
    where: {
      id: params.advanceId,
      branchId: params.branchId,
      status: "PENDING",
    },
  });
  if (!advance) throw new Error("Demande d'avance introuvable");

  const plans = planAdvanceInstallments({
    total: advance.amount,
    count: params.installmentCount,
    currency: advance.currency,
    firstYear: params.firstYear,
    firstMonth: params.firstMonth,
  });

  await prisma.$transaction(async (tx) => {
    const expense = await recordSalaryAdvanceExpense(tx, {
      branchId: params.branchId,
      userId: params.userId,
      advanceId: advance.id,
      amount: advance.amount,
      teacherName: params.teacherName,
      installmentCount: params.installmentCount,
    });

    await tx.salaryAdvance.update({
      where: { id: advance.id },
      data: {
        status: "APPROVED",
        installmentCount: params.installmentCount,
        firstYear: params.firstYear,
        firstMonth: params.firstMonth,
        expenseRef: expense.transactionRef,
        reviewedById: params.userId,
        reviewedAt: new Date(),
        reviewNote: null,
      },
    });

    await tx.salaryAdvanceInstallment.createMany({
      data: plans.map((plan) => ({
        advanceId: advance.id,
        sequence: plan.sequence,
        year: plan.year,
        month: plan.month,
        amount: plan.amount,
      })),
    });
  });

  const draftAppliedList = await Promise.all(
    plans.map((plan) =>
      refreshDraftPayslip({
        branchId: params.branchId,
        organizationId: params.organizationId,
        teacherId: advance.teacherId,
        personnelId: advance.personnelId,
        year: plan.year,
        month: plan.month,
      }),
    ),
  );
  const draftApplied = draftAppliedList.some(Boolean);

  return { advance, draftApplied };
}

export const getSalaryAdvanceTeachersAction = action.handler(async () => {
  const context = await requirePayrollOwner();
  const [teachers, personnels] = await Promise.all([
    prisma.teacher.findMany({
      where: {
        isActive: true,
        branchMember: { branchId: context.branchId },
      },
      select: {
        id: true,
        branchMemberId: true,
        canRequestSalaryAdvance: true,
        ...teacherInclude,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.personnel.findMany({
      where: {
        isActive: true,
        branchMember: { branchId: context.branchId },
      },
      select: {
        id: true,
        branchMemberId: true,
        canRequestSalaryAdvance: true,
        ...personnelInclude,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const byMember = new Map<
    string,
    {
      id: string;
      teacherId: string | null;
      personnelId: string | null;
      name: string;
      kind: "teacher" | "personnel" | "both";
      canRequest: boolean;
    }
  >();

  for (const teacher of teachers) {
    const key = teacher.branchMemberId ?? `teacher:${teacher.id}`;
    const name =
      formatPersonName(teacher.branchMember?.member?.user) || "Enseignant";
    byMember.set(key, {
      id: `teacher:${teacher.id}`,
      teacherId: teacher.id,
      personnelId: null,
      name,
      kind: "teacher",
      canRequest: teacher.canRequestSalaryAdvance,
    });
  }

  for (const personnel of personnels) {
    const key = personnel.branchMemberId ?? `personnel:${personnel.id}`;
    const existing = byMember.get(key);
    const name =
      formatPersonName(personnel.branchMember?.member?.user) || "Personnel";
    if (existing) {
      existing.personnelId = personnel.id;
      existing.kind = "both";
      existing.canRequest =
        existing.canRequest || personnel.canRequestSalaryAdvance;
      existing.id = `both:${existing.teacherId}:${personnel.id}`;
      continue;
    }
    byMember.set(key, {
      id: `personnel:${personnel.id}`,
      teacherId: null,
      personnelId: personnel.id,
      name,
      kind: "personnel",
      canRequest: personnel.canRequestSalaryAdvance,
    });
  }

  return [...byMember.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );
});

export const getSalaryAdvancesAction = action.handler(async () => {
  const context = await requirePayrollOwner();
  const [rows, currency] = await Promise.all([
    prisma.salaryAdvance.findMany({
      where: { branchId: context.branchId },
      include: advanceListInclude,
      orderBy: { createdAt: "desc" },
    }),
    resolveBaseCurrency(context.organizationId, context.userId),
  ]);
  return {
    currency,
    advances: rows.map(serializeAdvance),
  };
});

export const getMySalaryAdvanceAccessAction = action.handler(async () => {
  const context = await getContext();
  const [teacher, personnel, currency] = await Promise.all([
    getTeacherForUser(context.branchId, context.userId),
    getPersonnelForUser(context.branchId, context.userId),
    resolveBaseCurrency(context.organizationId, context.userId),
  ]);
  const hasProfile = Boolean(teacher || personnel);
  if (!hasProfile) {
    return {
      canRequest: false,
      hasProfile: false,
      currency,
      advances: [],
    };
  }
  const rows = await prisma.salaryAdvance.findMany({
    where: {
      branchId: context.branchId,
      OR: [
        ...(teacher ? [{ teacherId: teacher.id }] : []),
        ...(personnel ? [{ personnelId: personnel.id }] : []),
      ],
    },
    include: advanceListInclude,
    orderBy: { createdAt: "desc" },
  });
  return {
    canRequest: Boolean(
      teacher?.canRequestSalaryAdvance || personnel?.canRequestSalaryAdvance,
    ),
    hasProfile: true,
    currency,
    advances: rows.map(serializeAdvance),
  };
});

export const toggleTeacherAdvanceRequestAction = action
  .input(
    z.object({
      teacherId: z.string().min(1).optional(),
      personnelId: z.string().min(1).optional(),
      allowed: z.boolean(),
    }),
  )
  .handler(async ({ input }) => {
    const context = await requirePayrollOwner();
    if (!input.teacherId && !input.personnelId) {
      throw new Error("Choisissez un agent");
    }
    if (input.teacherId) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: input.teacherId,
          branchMember: { branchId: context.branchId },
        },
        select: { id: true },
      });
      if (!teacher) throw new Error("Enseignant introuvable");
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { canRequestSalaryAdvance: input.allowed },
      });
    }
    if (input.personnelId) {
      const personnel = await prisma.personnel.findFirst({
        where: {
          id: input.personnelId,
          branchMember: { branchId: context.branchId },
        },
        select: { id: true },
      });
      if (!personnel) throw new Error("Personnel introuvable");
      await prisma.personnel.update({
        where: { id: personnel.id },
        data: { canRequestSalaryAdvance: input.allowed },
      });
    }
    revalidateAdvancePages(context.organizationId, context.branchId);
    return { ok: true };
  });

async function resolveAgentInBranch(
  branchId: string,
  input: { teacherId?: string; personnelId?: string },
) {
  const teacher = input.teacherId
    ? await prisma.teacher.findFirst({
        where: {
          id: input.teacherId,
          isActive: true,
          branchMember: { branchId },
        },
        select: { id: true, ...teacherInclude },
      })
    : null;
  const personnel = input.personnelId
    ? await prisma.personnel.findFirst({
        where: {
          id: input.personnelId,
          isActive: true,
          branchMember: { branchId },
        },
        select: { id: true, ...personnelInclude },
      })
    : null;
  if (!teacher && !personnel) {
    throw new Error("Agent introuvable dans cette branche");
  }
  const name =
    formatPersonName(teacher?.branchMember?.member?.user) ||
    formatPersonName(personnel?.branchMember?.member?.user) ||
    "Agent";
  return { teacher, personnel, name };
}

export const createSalaryAdvanceAction = action
  .input(requestSchema)
  .handler(async ({ input }) => {
    const context = await requirePayrollOwner();
    if (!input.teacherId && !input.personnelId) {
      throw new Error("Choisissez un enseignant ou un personnel");
    }
    const { teacher, personnel, name } = await resolveAgentInBranch(
      context.branchId,
      input,
    );
    const currency = await resolveBaseCurrency(
      context.organizationId,
      context.userId,
    );

    const created = await prisma.salaryAdvance.create({
      data: {
        branchId: context.branchId,
        teacherId: teacher?.id ?? null,
        personnelId: personnel?.id ?? null,
        amount: input.amount,
        installmentCount: input.installmentCount,
        currency,
        reason: input.reason || null,
        firstYear: input.firstYear,
        firstMonth: input.firstMonth,
        requestedById: context.userId,
      },
    });

    if (input.approveNow) {
      if (!canPayPayroll(context.session)) {
        throw new Error("Vous n'avez pas le droit d'accorder une avance");
      }
      const { draftApplied } = await approveAdvanceInTx({
        advanceId: created.id,
        branchId: context.branchId,
        organizationId: context.organizationId,
        userId: context.userId,
        installmentCount: input.installmentCount,
        firstYear: input.firstYear,
        firstMonth: input.firstMonth,
        teacherName: name,
      });
      revalidateAdvancePages(context.organizationId, context.branchId);
      return { ok: true, approved: true, draftApplied };
    }

    revalidateAdvancePages(context.organizationId, context.branchId);
    return { ok: true, approved: false, draftApplied: false };
  });

export const requestSalaryAdvanceAction = action
  .input(requestSchema.omit({ teacherId: true, personnelId: true, approveNow: true }))
  .handler(async ({ input }) => {
    const context = await getContext();
    const [teacher, personnel] = await Promise.all([
      getTeacherForUser(context.branchId, context.userId),
      getPersonnelForUser(context.branchId, context.userId),
    ]);
    const canRequest = Boolean(
      teacher?.canRequestSalaryAdvance || personnel?.canRequestSalaryAdvance,
    );
    if (!canRequest) {
      throw new Error(
        "Vous n'êtes pas autorisé à demander une avance sur salaire",
      );
    }
    const currency = await resolveBaseCurrency(
      context.organizationId,
      context.userId,
    );
    const created = await prisma.salaryAdvance.create({
      data: {
        branchId: context.branchId,
        teacherId: teacher?.id ?? null,
        personnelId: personnel?.id ?? null,
        amount: input.amount,
        installmentCount: input.installmentCount,
        currency,
        reason: input.reason || null,
        firstYear: input.firstYear,
        firstMonth: input.firstMonth,
        requestedById: context.userId,
      },
    });

    const owners = await getBranchPayrollOwners({
      branchId: context.branchId,
      organizationId: context.organizationId,
    });
    const href = `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants?tab=credit`;
    await prisma.appNotification.createMany({
      data: owners
        .filter((owner) => owner.userId !== context.userId)
        .map((owner) => ({
          branchId: context.branchId,
          organizationId: context.organizationId,
          userId: owner.userId,
          type: "PAYROLL" as const,
          title: "Demande d'avance sur salaire",
          body: `Une demande de ${input.amount} ${currency} a été déposée (${input.installmentCount} séance${input.installmentCount > 1 ? "s" : ""}).`,
          href,
        })),
    });

    revalidateAdvancePages(context.organizationId, context.branchId);
    return { ok: true, id: created.id };
  });

export const approveSalaryAdvanceAction = action
  .input(
    z.object({
      advanceId: z.string().min(1),
      installmentCount: z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_SALARY_ADVANCE_INSTALLMENTS)
        .optional(),
      ...periodPart,
    }),
  )
  .handler(async ({ input }) => {
    const context = await requirePayrollOwner();
    if (!canPayPayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit d'accorder une avance");
    }
    const row = await prisma.salaryAdvance.findFirst({
      where: {
        id: input.advanceId,
        branchId: context.branchId,
        status: "PENDING",
      },
      include: {
        teacher: { select: teacherInclude },
        personnel: { select: personnelInclude },
      },
    });
    if (!row) throw new Error("Demande d'avance introuvable");

    const teacherName =
      formatPersonName(row.teacher?.branchMember?.member?.user) ||
      formatPersonName(row.personnel?.branchMember?.member?.user) ||
      "Agent";

    const { draftApplied } = await approveAdvanceInTx({
      advanceId: row.id,
      branchId: context.branchId,
      organizationId: context.organizationId,
      userId: context.userId,
      installmentCount: input.installmentCount ?? row.installmentCount,
      firstYear: input.firstYear,
      firstMonth: input.firstMonth,
      teacherName,
    });

    const userId =
      row.teacher?.branchMember?.member?.userId ??
      row.personnel?.branchMember?.member?.userId;
    if (userId) {
      await prisma.appNotification.create({
        data: {
          branchId: context.branchId,
          organizationId: context.organizationId,
          userId,
          type: "PAYROLL",
          title: "Avance sur salaire acceptée",
          body: `Votre avance de ${row.amount} ${row.currency} est accordée. Le remboursement se fera sur ${input.installmentCount ?? row.installmentCount} séance(s).`,
          href: `/admin/organizations/${context.organizationId}/branches/${context.branchId}/ma-presence`,
        },
      });
    }

    revalidateAdvancePages(context.organizationId, context.branchId);
    return { ok: true, draftApplied };
  });

export const rejectSalaryAdvanceAction = action
  .input(
    z.object({
      advanceId: z.string().min(1),
      reviewNote: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const context = await requirePayrollOwner();
    const row = await prisma.salaryAdvance.findFirst({
      where: {
        id: input.advanceId,
        branchId: context.branchId,
        status: "PENDING",
      },
      select: {
        id: true,
        teacherId: true,
        personnelId: true,
        teacher: {
          select: {
            branchMember: { select: { member: { select: { userId: true } } } },
          },
        },
        personnel: {
          select: {
            branchMember: { select: { member: { select: { userId: true } } } },
          },
        },
      },
    });
    if (!row) throw new Error("Demande d'avance introuvable");
    await prisma.salaryAdvance.update({
      where: { id: row.id },
      data: {
        status: "REJECTED",
        reviewedById: context.userId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote || null,
      },
    });
    const userId =
      row.teacher?.branchMember?.member?.userId ??
      row.personnel?.branchMember?.member?.userId;
    if (userId) {
      await prisma.appNotification.create({
        data: {
          branchId: context.branchId,
          organizationId: context.organizationId,
          userId,
          type: "PAYROLL",
          title: "Avance sur salaire refusée",
          body: input.reviewNote?.trim() || "Votre demande d'avance a été refusée.",
          href: `/admin/organizations/${context.organizationId}/branches/${context.branchId}/ma-presence`,
        },
      });
    }
    revalidateAdvancePages(context.organizationId, context.branchId);
    return { ok: true };
  });

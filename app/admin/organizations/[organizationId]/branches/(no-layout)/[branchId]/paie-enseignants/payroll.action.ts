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
  calculateTeacherPayroll,
  persistTeacherPayroll,
} from "@/lib/payroll/teacher-payroll";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import { StatusPaiement } from "@/src/interfaces/Paiement";
import { getBaseCurrency } from "@/lib/exchange-rate";

const CYCLE_SORT_ORDER: Record<string, number> = {
  MATERNELLE: 0,
  PRIMAIRE: 1,
  SECONDAIRE: 2,
  ATELIER: 3,
  CENTRE_FORMATION: 4,
  UNIVERSITE: 5,
  MIXTE: 6,
  AUTRE: 7,
};

const CYCLE_LABELS: Record<string, string> = {
  MATERNELLE: "Maternelle",
  PRIMAIRE: "Primaire",
  SECONDAIRE: "Secondaire",
  ATELIER: "Atelier",
  CENTRE_FORMATION: "Centre de formation",
  UNIVERSITE: "Université",
  MIXTE: "Mixte",
  AUTRE: "Autre",
};

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
  month: z.coerce.number().int().min(1).max(12),
  schoolYearId: z.string().min(1).optional(),
});

const recalculateSchema = periodSchema.extend({
  teacherIds: z.array(z.string().min(1)).optional(),
});

const deletePayslipsSchema = periodSchema.extend({
  payslipIds: z.array(z.string().min(1)).optional(),
});

const payslipSchema = z.object({ payslipId: z.string().min(1) });
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

function resolveCycleGroup(cycles: string[]): string {
  if (cycles.length === 0) return "AUTRE";
  if (cycles.length === 1) return cycles[0]!;
  return "MIXTE";
}

function toListItem(row: {
  id: string;
  teacherId: string;
  year: number;
  month: number;
  currency: string;
  gross: number;
  deductions: number;
  net: number;
  status: string;
  createdAt: Date;
  branch?: { name: string } | null;
  teacher: {
    employmentKind: string;
    branchMember?: {
      member?: {
        user?: {
          name?: string | null;
          postnom?: string | null;
          prenom?: string | null;
        } | null;
      } | null;
    } | null;
  };
  lines: Array<{
    sessions: number;
    label: string;
    detail: unknown;
    cycle: string | null;
    minutes: number;
    kind: string;
  }>;
}) {
  const user = row.teacher.branchMember?.member?.user;
  const classes = extractClassNames(row.lines);
  const cycles = extractCycles(row.lines);
  const cycleGroup = resolveCycleGroup(cycles);
  const lostMinutes = row.lines
    .filter((line) =>
      line.kind === "ABSENCE" || line.kind === "LATE" || line.kind === "EARLY_EXIT",
    )
    .reduce((sum, line) => sum + Number(line.minutes || 0), 0);
  return {
    id: row.id,
    teacherId: row.teacherId,
    teacherName: [user?.name, user?.postnom, user?.prenom]
      .filter(Boolean)
      .join(" "),
    employmentKind: row.teacher.employmentKind,
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
      cycles.length === 0
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
                  select: { user: { select: { name: true, postnom: true, prenom: true } } },
                },
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
    const teacherFilter =
      input.teacherIds && input.teacherIds.length > 0
        ? { id: { in: input.teacherIds } }
        : {};
    const teachers = await prisma.teacher.findMany({
      where: {
        branchMember: { branchId: context.branchId },
        isActive: true,
        ...teacherFilter,
      },
      select: { id: true },
    });
    if (input.teacherIds?.length && teachers.length === 0) {
      throw new Error("Aucun enseignant sélectionné introuvable");
    }

    const results = [];
    let missingExchangeRate = false;
    let skippedPaid = 0;
    for (const teacher of teachers) {
      const paid = await prisma.teacherPayslip.findFirst({
        where: {
          branchId: context.branchId,
          teacherId: teacher.id,
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

      // Remplace brouillons et validés pour permettre une régénération propre.
      await prisma.teacherPayslip.deleteMany({
        where: {
          branchId: context.branchId,
          teacherId: teacher.id,
          year: input.year,
          month: input.month,
          status: { in: [...DELETABLE_STATUSES] },
        },
      });

      const result = await calculateTeacherPayroll({
        branchId: context.branchId,
        organizationId: context.organizationId,
        teacherId: teacher.id,
        period: { ...input, schoolYearId },
      });
      missingExchangeRate ||= result.missingExchangeRate;
      const payslip = await persistTeacherPayroll(
        {
          branchId: context.branchId,
          organizationId: context.organizationId,
          teacherId: teacher.id,
          period: { ...input, schoolYearId },
        },
        result,
      );
      results.push(payslip.id);
    }

    if (results.length > 0) {
      await prisma.appNotification.create({
        data: {
          branchId: context.branchId,
          organizationId: context.organizationId,
          userId: context.userId,
          type: "PAYROLL",
          title: "Paie enseignants générée",
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
                where: { teacherId: row.teacherId },
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
    revalidatePath(
      `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants`,
    );
    return { ok: true };
  });

export const payTeacherPayslipAction = action
  .input(payslipSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canPayPayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de marquer la paie payée");
    }
    const row = await prisma.teacherPayslip.findFirst({
      where: { id: input.payslipId, branchId: context.branchId, status: "VALIDATED" },
      include: {
        teacher: {
          select: {
            branchMember: {
              select: { member: { select: { userId: true } } },
            },
          },
        },
      },
    });
    if (!row) throw new Error("Bulletin validé introuvable");
    await prisma.teacherPayslip.update({
      where: { id: row.id },
      data: { status: "PAID", paidAt: new Date(), paidById: context.userId },
    });
    const teacherUserId = row.teacher.branchMember?.member?.userId;
    if (teacherUserId) {
      await prisma.appNotification.create({
        data: {
          branchId: context.branchId,
          organizationId: context.organizationId,
          userId: teacherUserId,
          type: "PAYROLL",
          title: "Bulletin de paie payé",
          body: `Votre bulletin de ${row.month}/${row.year} est payé. Net : ${row.net} ${row.currency}.`,
          href: `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants/${row.id}`,
        },
      });
    }
    revalidatePath(
      `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants`,
    );
    return { ok: true };
  });

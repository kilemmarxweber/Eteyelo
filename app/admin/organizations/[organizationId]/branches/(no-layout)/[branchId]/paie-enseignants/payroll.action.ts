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

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200),
  month: z.coerce.number().int().min(1).max(12),
  schoolYearId: z.string().min(1).optional(),
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

function toListItem(row: any) {
  const user = row.teacher.branchMember?.member?.user;
  return {
    id: row.id,
    teacherId: row.teacherId,
    teacherName: [user?.name, user?.postnom, user?.prenom]
      .filter(Boolean)
      .join(" "),
    employmentKind: row.teacher.employmentKind,
    year: row.year,
    month: row.month,
    currency: row.currency,
    gross: row.gross,
    deductions: row.deductions,
    net: row.net,
    status: row.status,
    sessions: row.lines.reduce((sum: number, line: any) => sum + line.sessions, 0),
    createdAt: row.createdAt,
  };
}

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
        lines: { select: { sessions: true } },
      },
    });
    return rows.map(toListItem);
  });

export const recalculateTeacherPayslipsAction = action
  .input(periodSchema)
  .handler(async ({ input }) => {
    const context = await getContext();
    if (!canComputePayroll(context.session)) {
      throw new Error("Vous n'avez pas le droit de recalculer la paie");
    }

    const schoolYearId = await resolveSchoolYearId(
      context.branchId,
      input.schoolYearId,
    );
    const teachers = await prisma.teacher.findMany({
      where: {
        branchMember: { branchId: context.branchId },
        isActive: true,
      },
      select: { id: true },
    });
    const results = [];
    let missingExchangeRate = false;
    for (const teacher of teachers) {
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
    revalidatePath(
      `/admin/organizations/${context.organizationId}/branches/${context.branchId}/paie-enseignants`,
    );
    return { count: results.length, missingExchangeRate };
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
      },
    });
    if (!row) throw new Error("Bulletin introuvable");
    return row;
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

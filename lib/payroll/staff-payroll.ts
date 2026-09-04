import "server-only";

import { splitSessionRoles } from "@/lib/auth/session-roles";
import { PERSONNEL_ORG_ROLE_OPTIONS } from "@/lib/dual-staff-profile-shared";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { calculatePersonnelPayroll } from "@/lib/payroll/personnel-payroll";
import { resolvePersonnelPay } from "@/lib/payroll/personnel-scales";
import {
  calculateTeacherPayroll,
  getBranchPayrollContext,
  persistTeacherPayroll,
  type PayrollPeriod,
  type TeacherPayrollResult,
} from "@/lib/payroll/teacher-payroll";
import { prisma } from "@/lib/prisma";

export type PayrollAgentKind = "TEACHER" | "PERSONNEL" | "BOTH";

export type PayrollAgent = {
  branchMemberId: string;
  teacherId: string | null;
  personnelId: string | null;
  monthlyForfait: number | null;
  orgRole: string | null;
  name: string;
};

function agentDisplayName(user?: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  return [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ") || "Agent";
}

function personnelRoleLabel(orgRole: string | null | undefined) {
  const roles = splitSessionRoles(orgRole);
  const slug =
    roles.find((role) =>
      (PERSONNEL_ORG_ROLE_OPTIONS as readonly string[]).includes(role),
    ) ?? roles[0];
  return slug ? orgRoleLabel(slug) : null;
}

export async function listPayrollAgents(
  branchId: string,
  filter?: { branchMemberIds?: string[]; teacherIds?: string[] },
): Promise<PayrollAgent[]> {
  const memberFilter =
    filter?.branchMemberIds && filter.branchMemberIds.length > 0
      ? { id: { in: filter.branchMemberIds } }
      : {};
  const teacherIdFilter =
    filter?.teacherIds && filter.teacherIds.length > 0
      ? { id: { in: filter.teacherIds } }
      : {};

  const [teachers, personnels] = await Promise.all([
    prisma.teacher.findMany({
      where: {
        isActive: true,
        branchMemberId: { not: null },
        ...teacherIdFilter,
        branchMember: { branchId, isActive: true, ...memberFilter },
      },
      select: {
        id: true,
        branchMemberId: true,
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
    }),
    prisma.personnel.findMany({
      where: {
        isActive: true,
        branchMember: { branchId, isActive: true, ...memberFilter },
      },
      select: {
        id: true,
        branchMemberId: true,
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
    }),
  ]);

  const byMember = new Map<string, PayrollAgent>();
  for (const teacher of teachers) {
    if (!teacher.branchMemberId) continue;
    byMember.set(teacher.branchMemberId, {
      branchMemberId: teacher.branchMemberId,
      teacherId: teacher.id,
      personnelId: null,
      monthlyForfait: null,
      orgRole: teacher.branchMember?.member?.role ?? null,
      name: agentDisplayName(teacher.branchMember?.member?.user),
    });
  }
  for (const personnel of personnels) {
    const current = byMember.get(personnel.branchMemberId);
    if (current) {
      current.personnelId = personnel.id;
      current.monthlyForfait = personnel.monthlyForfait;
      current.orgRole = current.orgRole ?? personnel.branchMember?.member?.role ?? null;
      continue;
    }
    if (filter?.teacherIds?.length) continue;
    byMember.set(personnel.branchMemberId, {
      branchMemberId: personnel.branchMemberId,
      teacherId: null,
      personnelId: personnel.id,
      monthlyForfait: personnel.monthlyForfait,
      orgRole: personnel.branchMember?.member?.role ?? null,
      name: agentDisplayName(personnel.branchMember?.member?.user),
    });
  }
  return [...byMember.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function emptyTeacherResult(input: {
  name: string;
  branchMemberId: string;
  period: PayrollPeriod;
  context: Awaited<ReturnType<typeof getBranchPayrollContext>>;
}): TeacherPayrollResult {
  return {
    teacherId: "",
    branchMemberId: input.branchMemberId,
    teacherName: input.name,
    employmentKind: "NON_MATRICULE",
    matriculeEtat: null,
    year: input.period.year,
    month: input.period.month,
    schoolYearId: input.period.schoolYearId ?? null,
    currency: input.context.currency,
    quoteCurrency: input.context.quoteCurrency,
    rateSnapshot: input.context.rateSnapshot,
    exchangeRateId: input.context.exchangeRateId,
    missingExchangeRate: input.context.missingExchangeRate,
    policy: input.context.policy,
    gross: 0,
    deductions: 0,
    net: 0,
    sessions: 0,
    heldSessions: 0,
    lateSessions: 0,
    justifiedAbsences: 0,
    unjustifiedAbsences: 0,
    plannedMinutes: 0,
    lostMinutes: 0,
    weeklyPlannedMinutes: 0,
    weeklySessions: 0,
    secondaryWeeklyPlannedMinutes: 0,
    secondaryWeeklySessions: 0,
    maternelleWeeklyPlannedMinutes: 0,
    maternelleWeeklySessions: 0,
    ratePerMinute: 0,
    ratePerSession: 0,
    details: [],
  };
}

export async function calculateAndPersistStaffPayroll(input: {
  branchId: string;
  organizationId: string;
  period: PayrollPeriod;
  agent: PayrollAgent;
  waivedSessionIds?: string[];
}) {
  const context = await getBranchPayrollContext(input.branchId, input.organizationId);
  const pay = resolvePersonnelPay({
    ficheForfait: input.agent.monthlyForfait,
    orgRole: input.agent.orgRole,
    scales: context.policy.personnelScales,
  });
  const personnelTotal = pay.total;
  if (!input.agent.teacherId && personnelTotal <= 0) {
    return { skipped: "NO_FORFAIT" as const, payslipId: null, missingExchangeRate: false };
  }

  let teacherResult: TeacherPayrollResult | null = null;
  if (input.agent.teacherId) {
    teacherResult = await calculateTeacherPayroll({
      branchId: input.branchId,
      organizationId: input.organizationId,
      teacherId: input.agent.teacherId,
      period: input.period,
    });
  }

  const currency = teacherResult?.currency ?? context.currency;
  const policy = teacherResult?.policy ?? context.policy;
  const roleLabel = personnelRoleLabel(input.agent.orgRole) ?? pay.role;
  const personnelPayroll =
    input.agent.personnelId && personnelTotal > 0
      ? await calculatePersonnelPayroll({
          branchId: input.branchId,
          personnelId: input.agent.personnelId,
          period: input.period,
          pay,
          policy: {
            lateGraceMinutes: policy.lateGraceMinutes,
            personnelDayMinutes: policy.personnelDayMinutes,
          },
          currency,
          roleLabel,
        })
      : null;

  const result =
    teacherResult ??
    emptyTeacherResult({
      name: input.agent.name,
      branchMemberId: input.agent.branchMemberId,
      period: input.period,
      context,
    });

  const agentKind: PayrollAgentKind =
    input.agent.teacherId && personnelPayroll && personnelTotal > 0
      ? "BOTH"
      : input.agent.teacherId
        ? "TEACHER"
        : "PERSONNEL";

  const payslip = await persistTeacherPayroll(
    {
      branchId: input.branchId,
      organizationId: input.organizationId,
      period: input.period,
      branchMemberId: input.agent.branchMemberId,
      teacherId: input.agent.teacherId,
      personnelId: input.agent.personnelId,
      agentKind,
      personnelPayroll,
      personnelRoleLabel: roleLabel,
      waivedSessionIds: input.waivedSessionIds,
    },
    result,
  );

  return {
    skipped: null,
    payslipId: payslip.id,
    missingExchangeRate: result.missingExchangeRate,
  };
}

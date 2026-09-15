import { prisma } from "@/lib/prisma";
import { getBaseCurrency } from "@/lib/exchange-rate";
import { formatPayrollAmount } from "@/lib/reports/format-amount";
import { isBranchClosedOn } from "@/lib/branch-closed-days";
import {
  dayRangeInAppTimezone,
  getAppWeekday,
} from "@/lib/timezone";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";

export type OwnerDailyBranchFinance = {
  branchId: string;
  branchName: string;
  income: number;
  expenses: number;
  /** Caisse réelle = soldes antérieurs + entrées − sorties du jour. */
  cashBalance: number;
  newEnrollments: number;
  currency: string;
};

export type OwnerDailyFinanceSummary = {
  organizationId: string;
  organizationName: string;
  dateKey: string;
  dateLabel: string;
  currency: string;
  branches: OwnerDailyBranchFinance[];
  totalIncome: number;
  totalExpenses: number;
  totalCashBalance: number;
  totalNewEnrollments: number;
};

export type OwnerDailyFinanceRecipient = {
  userId: string;
  email: string | null;
  telephone: string | null;
  name: string;
};

/**
 * Destinataires du rapport — paires acceptées :
 * - owner / propriétaire
 * - admin / gestionnaire
 * - admin / propriétaire
 */
const FINANCE_REPORT_MEMBER_ROLES = new Set([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
  "proprietaire",
  "owner",
  "gestionnaire",
  "admin",
]);

const FINANCE_REPORT_APP_ROLES = new Set<string>([
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
]);

function normalizeMemberRoleSlug(role: string) {
  return role
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function memberHasFinanceReportRole(memberRole: string) {
  return memberRole
    .split(",")
    .map(normalizeMemberRoleSlug)
    .some((role) => FINANCE_REPORT_MEMBER_ROLES.has(role));
}

function userHasFinanceReportAppRole(userRole: string | null | undefined) {
  if (!userRole?.trim()) return false;
  return FINANCE_REPORT_APP_ROLES.has(normalizeMemberRoleSlug(userRole));
}

/** Dimanche (fuseau établissement) : aucun envoi. */
export function isOwnerDailyFinanceSunday(date: Date = new Date()) {
  return getAppWeekday(date) === 0;
}

/**
 * Jour sans rapport : dimanche, ou aucune branche ouverte
 * (toutes fermées pour jour férié calendrier).
 */
export async function shouldSkipOwnerDailyFinanceReport(params: {
  organizationId: string;
  now?: Date;
  branchIds?: string[];
}): Promise<{ skip: boolean; reason: "sunday" | "holiday" | null }> {
  const now = params.now ?? new Date();
  if (isOwnerDailyFinanceSunday(now)) {
    return { skip: true, reason: "sunday" };
  }

  const branchIds =
    params.branchIds ??
    (
      await prisma.branch.findMany({
        where: { organizationId: params.organizationId, isActive: true },
        select: { id: true },
      })
    ).map((row) => row.id);

  if (branchIds.length === 0) {
    return { skip: true, reason: "holiday" };
  }

  const closedFlags = await Promise.all(
    branchIds.map((branchId) => isBranchClosedOn(branchId, now)),
  );
  if (closedFlags.every(Boolean)) {
    return { skip: true, reason: "holiday" };
  }

  return { skip: false, reason: null };
}

function hasBranchDayActivity(row: OwnerDailyBranchFinance) {
  return row.income !== 0 || row.expenses !== 0 || row.newEnrollments > 0;
}

/** Activité du jour (mouvements / inscriptions) — sans ça on n’envoie rien. */
export function hasOwnerDailyFinanceActivity(
  summary: OwnerDailyFinanceSummary | null | undefined,
) {
  if (!summary?.branches.length) return false;
  return summary.branches.some(hasBranchDayActivity);
}

export function formatOwnerDailyFinanceMoney(
  value: number,
  currency: string,
) {
  return formatPayrollAmount(value, currency);
}

export function formatOwnerDailyFinanceText(
  summary: OwnerDailyFinanceSummary,
): string {
  const lines: string[] = [
    `Situation financière du jour — ${summary.dateLabel}`,
    summary.organizationName,
    "",
  ];

  for (const branch of summary.branches) {
    lines.push(`Établissement ${branch.branchName} :`);
    lines.push(
      `• Entrées : ${formatOwnerDailyFinanceMoney(branch.income, branch.currency)}`,
    );
    lines.push(
      `• Sorties : ${formatOwnerDailyFinanceMoney(branch.expenses, branch.currency)}`,
    );
    lines.push(
      `• Caisse réelle : ${formatOwnerDailyFinanceMoney(branch.cashBalance, branch.currency)}`,
    );
    lines.push(
      `• Nouveaux inscrits : ${branch.newEnrollments} élève${branch.newEnrollments === 1 ? "" : "s"}`,
    );
    lines.push("");
  }

  lines.push(
    `Total : Caisse ${formatOwnerDailyFinanceMoney(summary.totalCashBalance, summary.currency)} · ${summary.totalNewEnrollments} élève${summary.totalNewEnrollments === 1 ? "" : "s"}`,
  );
  lines.push(
    `Entrées ${formatOwnerDailyFinanceMoney(summary.totalIncome, summary.currency)} · Sorties ${formatOwnerDailyFinanceMoney(summary.totalExpenses, summary.currency)}`,
  );

  return lines.join("\n").trim();
}

/** Ligne compacte WhatsApp (une ligne par établissement). */
export function formatOwnerDailyFinanceWhatsAppLines(
  summary: OwnerDailyFinanceSummary,
): string[] {
  const lines = summary.branches.map((branch) => {
    const cash = formatOwnerDailyFinanceMoney(
      branch.cashBalance,
      branch.currency,
    );
    return `Établissement ${branch.branchName} : ${cash}, Nouveau inscrit ${branch.newEnrollments} élève${branch.newEnrollments === 1 ? "" : "s"}`;
  });
  lines.push(
    `Total ${formatOwnerDailyFinanceMoney(summary.totalCashBalance, summary.currency)} et ${summary.totalNewEnrollments} élève${summary.totalNewEnrollments === 1 ? "" : "s"}`,
  );
  return lines;
}

/**
 * Destinataires : paires **owner/propriétaire**, **admin/gestionnaire**,
 * **admin/propriétaire** (rôle membre ou rôle app) — pas préfet, directeur, etc.
 */
export async function getOrganizationOwnerRecipients(
  organizationId: string,
): Promise<OwnerDailyFinanceRecipient[]> {
  const members = await prisma.member.findMany({
    where: {
      organizationId,
      isArchived: false,
    },
    select: {
      role: true,
      user: {
        select: {
          id: true,
          role: true,
          email: true,
          telephone: true,
          name: true,
          prenom: true,
          postnom: true,
        },
      },
    },
  });

  const byUserId = new Map<string, OwnerDailyFinanceRecipient>();
  for (const row of members) {
    if (
      !memberHasFinanceReportRole(row.role) &&
      !userHasFinanceReportAppRole(row.user.role)
    ) {
      continue;
    }
    if (byUserId.has(row.user.id)) continue;
    const name = [row.user.prenom, row.user.name, row.user.postnom]
      .filter(Boolean)
      .join(" ")
      .trim();
    byUserId.set(row.user.id, {
      userId: row.user.id,
      email: row.user.email?.trim().toLowerCase() || null,
      telephone: row.user.telephone,
      name: name || row.user.name,
    });
  }
  return [...byUserId.values()];
}

async function loadBranchDayFinance(params: {
  branchId: string;
  branchName: string;
  organizationId: string;
  start: Date;
  end: Date;
  currency: string;
}): Promise<OwnerDailyBranchFinance> {
  const currentYear = await prisma.schoolYear.findFirst({
    where: { branchId: params.branchId, isCurrentYear: true, isArchived: false },
    select: { id: true },
  });

  const [
    todayIncomeAgg,
    todayExpenseAgg,
    openingIncomeAgg,
    openingExpenseAgg,
    enrollmentGroups,
  ] = await Promise.all([
    prisma.familyPayment.aggregate({
      _sum: { amount: true },
      where: {
        branchId: params.branchId,
        status: "VALIDE",
        isArchived: false,
        createdAt: { gte: params.start, lt: params.end },
      },
    }),
    prisma.cashierExpense.aggregate({
      _sum: { amount: true },
      where: {
        branchId: params.branchId,
        isArchived: false,
        createdAt: { gte: params.start, lt: params.end },
      },
    }),
    prisma.familyPayment.aggregate({
      _sum: { amount: true },
      where: {
        branchId: params.branchId,
        status: "VALIDE",
        isArchived: false,
        createdAt: { lt: params.start },
      },
    }),
    prisma.cashierExpense.aggregate({
      _sum: { amount: true },
      where: {
        branchId: params.branchId,
        isArchived: false,
        createdAt: { lt: params.start },
      },
    }),
    currentYear
      ? prisma.classEnrollment.groupBy({
          by: ["studentId"],
          where: {
            branchId: params.branchId,
            schoolYearId: currentYear.id,
            statusEnrollment: true,
            createdAt: { gte: params.start, lt: params.end },
          },
        })
      : Promise.resolve([]),
  ]);

  const income = Number(todayIncomeAgg._sum.amount ?? 0);
  const expenses = Number(todayExpenseAgg._sum.amount ?? 0);
  const opening =
    Number(openingIncomeAgg._sum.amount ?? 0) -
    Number(openingExpenseAgg._sum.amount ?? 0);

  return {
    branchId: params.branchId,
    branchName: params.branchName,
    income,
    expenses,
    cashBalance: opening + income - expenses,
    newEnrollments: enrollmentGroups.length,
    currency: params.currency,
  };
}

export async function buildOwnerDailyFinanceSummary(params: {
  organizationId: string;
  now?: Date;
}): Promise<OwnerDailyFinanceSummary | null> {
  const now = params.now ?? new Date();
  const { start, end, dateKey } = dayRangeInAppTimezone(now);

  const organization = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: {
      id: true,
      name: true,
      branches: {
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!organization || organization.branches.length === 0) return null;

  const openBranches: typeof organization.branches = [];
  for (const branch of organization.branches) {
    if (await isBranchClosedOn(branch.id, now)) continue;
    openBranches.push(branch);
  }
  if (openBranches.length === 0) return null;

  const [selectedExchangeRate, exchangeRates] = await Promise.all([
    prisma.exchangeRate.findFirst({
      where: { organizationId: params.organizationId, isSelected: true },
      select: { fromCurrency: true },
    }),
    prisma.exchangeRate.findMany({
      where: { organizationId: params.organizationId, isActive: true },
      select: {
        fromCurrency: true,
        toCurrency: true,
        rate: true,
        isActive: true,
        isSelected: true,
      },
    }),
  ]);
  const currency =
    selectedExchangeRate?.fromCurrency ?? getBaseCurrency(exchangeRates);

  const branchesRaw = await Promise.all(
    openBranches.map((branch) =>
      loadBranchDayFinance({
        branchId: branch.id,
        branchName: branch.name,
        organizationId: organization.id,
        start,
        end,
        currency,
      }),
    ),
  );

  const branches = branchesRaw.filter(hasBranchDayActivity);
  if (branches.length === 0) {
    return null;
  }

  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone: process.env.APP_TIMEZONE ?? "Africa/Kinshasa",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    dateKey,
    dateLabel,
    currency,
    branches,
    totalIncome: branches.reduce((sum, row) => sum + row.income, 0),
    totalExpenses: branches.reduce((sum, row) => sum + row.expenses, 0),
    totalCashBalance: branches.reduce((sum, row) => sum + row.cashBalance, 0),
    totalNewEnrollments: branches.reduce(
      (sum, row) => sum + row.newEnrollments,
      0,
    ),
  };
}

export async function listOrganizationsForOwnerDailyFinance() {
  return prisma.organization.findMany({
    where: {
      branches: { some: { isActive: true } },
    },
    select: { id: true, name: true },
  });
}

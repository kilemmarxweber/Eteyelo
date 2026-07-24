import { prisma } from "@/lib/prisma";
import {
  buildBranchIdFilter,
  monthKey,
  monthLabelFr,
  pct,
  type BranchScopeInput,
} from "./scope";

export type FinanceMonthRow = {
  month: string;
  label: string;
  recoltes: number;
  depenses: number;
};

export type FinanceNamedAmount = { name: string; value: number };

export type FinanceReport = {
  budgetAnnuel: number;
  /** Source du budget : factures ou frais×inscriptions. */
  budgetSource: "invoices" | "frais";
  recoltes: number;
  reste: number;
  depenses: number;
  solde: number;
  tauxRecouvrement: number;
  unpaidAmount: number;
  partialAmount: number;
  paidAmount: number;
  byMonth: FinanceMonthRow[];
  byMethod: FinanceNamedAmount[];
  byStatus: FinanceNamedAmount[];
  byBranch: Array<{
    branchId: string;
    branchName: string;
    budget: number;
    recoltes: number;
    reste: number;
    depenses: number;
  }>;
};

/**
 * Budget attendu = somme des frais actifs par classe × nb d'inscriptions
 * (même logique que le rapport impayés caisse).
 */
async function computeBudgetFromFrais(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
  branchIds: string[];
}): Promise<{
  total: number;
  byBranch: Map<string, number>;
}> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const yearFilter =
    params.schoolYearIds.length > 0
      ? { schoolYearId: { in: params.schoolYearIds } }
      : {};

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      ...branchFilter,
      ...yearFilter,
      OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
    },
    select: {
      id: true,
      classeId: true,
      branchId: true,
    },
  });

  if (enrollments.length === 0) {
    return { total: 0, byBranch: new Map() };
  }

  const classeIds = Array.from(new Set(enrollments.map((e) => e.classeId)));

  const fraisList = await prisma.frais.findMany({
    where: {
      ...branchFilter,
      statusFrais: true,
      classeId: { in: classeIds },
      ...(params.schoolYearIds.length > 0
        ? {
            OR: [
              { schoolYearId: { in: params.schoolYearIds } },
              { schoolYearId: null },
            ],
          }
        : {}),
    },
    select: {
      classeId: true,
      branchId: true,
      montantFrais: true,
    },
  });

  const dueByClasseBranch = new Map<string, number>();
  for (const frais of fraisList) {
    const key = `${frais.branchId}:${frais.classeId}`;
    dueByClasseBranch.set(
      key,
      (dueByClasseBranch.get(key) ?? 0) + Number(frais.montantFrais),
    );
  }

  const byBranch = new Map<string, number>();
  let total = 0;
  for (const enrollment of enrollments) {
    const due =
      dueByClasseBranch.get(`${enrollment.branchId}:${enrollment.classeId}`) ??
      0;
    total += due;
    byBranch.set(
      enrollment.branchId,
      (byBranch.get(enrollment.branchId) ?? 0) + due,
    );
  }

  // Ensure all requested branches appear
  for (const id of params.branchIds) {
    if (!byBranch.has(id)) byBranch.set(id, 0);
  }

  return { total, byBranch };
}

export async function getFinanceReport(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
}): Promise<FinanceReport> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const yearFilter =
    params.schoolYearIds.length > 0
      ? { YearId: { in: params.schoolYearIds } }
      : {};

  const enrollmentYearFilter =
    params.schoolYearIds.length > 0
      ? { classEnrollment: { schoolYearId: { in: params.schoolYearIds } } }
      : {};

  const branches = await prisma.branch.findMany({
    where:
      params.scope.scope === "branch" && params.scope.branchId
        ? { id: params.scope.branchId }
        : { organizationId: params.scope.organizationId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const branchIds = branches.map((b) => b.id);

  const [invoices, payments, expenses, fraisBudget] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...branchFilter, ...yearFilter },
      select: {
        totalAmount: true,
        finalAmount: true,
        paidAmount: true,
        status: true,
        branchId: true,
      },
    }),
    prisma.familyPayment.findMany({
      where: {
        ...branchFilter,
        status: "VALIDE",
        ...enrollmentYearFilter,
      },
      select: {
        amount: true,
        method: true,
        createdAt: true,
        branchId: true,
      },
    }),
    prisma.cashierExpense.findMany({
      where: branchFilter,
      select: { amount: true, createdAt: true, branchId: true },
    }),
    computeBudgetFromFrais({
      scope: params.scope,
      schoolYearIds: params.schoolYearIds,
      branchIds,
    }),
  ]);

  const budgetFromInvoices = invoices.reduce(
    (sum, inv) => sum + Number(inv.finalAmount ?? inv.totalAmount ?? 0),
    0,
  );
  const paidAmountFromInvoices = invoices.reduce(
    (sum, inv) => sum + Number(inv.paidAmount ?? 0),
    0,
  );

  // Prefer invoices when they exist; otherwise frais × inscriptions (cas fréquent).
  const useInvoices = budgetFromInvoices > 0;
  const budgetAnnuel = useInvoices ? budgetFromInvoices : fraisBudget.total;
  const budgetSource: "invoices" | "frais" = useInvoices
    ? "invoices"
    : "frais";

  const unpaidAmount = invoices
    .filter((inv) => inv.status === "UNPAID")
    .reduce(
      (sum, inv) =>
        sum +
        Math.max(
          0,
          Number(inv.finalAmount ?? inv.totalAmount ?? 0) -
            Number(inv.paidAmount ?? 0),
        ),
      0,
    );
  const partialAmount = invoices
    .filter((inv) => inv.status === "PARTIAL")
    .reduce(
      (sum, inv) =>
        sum +
        Math.max(
          0,
          Number(inv.finalAmount ?? inv.totalAmount ?? 0) -
            Number(inv.paidAmount ?? 0),
        ),
      0,
    );

  const recoltes = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const depenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Recouvrement : factures si présentes, sinon paiements validés vs budget frais.
  const paidBasis = useInvoices ? paidAmountFromInvoices : recoltes;
  const reste = Math.max(0, budgetAnnuel - paidBasis);
  const tauxRecouvrement = pct(paidBasis, budgetAnnuel);

  const monthMap = new Map<string, FinanceMonthRow & { sort: string }>();
  for (const p of payments) {
    const key = monthKey(p.createdAt);
    const row = monthMap.get(key) ?? {
      month: key,
      label: monthLabelFr(p.createdAt),
      recoltes: 0,
      depenses: 0,
      sort: key,
    };
    row.recoltes += Number(p.amount);
    monthMap.set(key, row);
  }
  for (const e of expenses) {
    const key = monthKey(e.createdAt);
    const row = monthMap.get(key) ?? {
      month: key,
      label: monthLabelFr(e.createdAt),
      recoltes: 0,
      depenses: 0,
      sort: key,
    };
    row.depenses += Number(e.amount);
    monthMap.set(key, row);
  }

  const methodMap = new Map<string, number>();
  for (const p of payments) {
    methodMap.set(p.method, (methodMap.get(p.method) ?? 0) + Number(p.amount));
  }

  const byBranch = branches.map((b) => {
    const bInvoices = invoices.filter((i) => i.branchId === b.id);
    const invoiceBudget = bInvoices.reduce(
      (sum, inv) => sum + Number(inv.finalAmount ?? inv.totalAmount ?? 0),
      0,
    );
    const budget =
      invoiceBudget > 0
        ? invoiceBudget
        : (fraisBudget.byBranch.get(b.id) ?? 0);
    const paid = bInvoices.reduce(
      (sum, inv) => sum + Number(inv.paidAmount ?? 0),
      0,
    );
    const bRecoltes = payments
      .filter((p) => p.branchId === b.id)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const bDepenses = expenses
      .filter((e) => e.branchId === b.id)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const paidBranch = invoiceBudget > 0 ? paid : bRecoltes;
    return {
      branchId: b.id,
      branchName: b.name,
      budget,
      recoltes: bRecoltes,
      reste: Math.max(0, budget - paidBranch),
      depenses: bDepenses,
    };
  });

  return {
    budgetAnnuel,
    budgetSource,
    recoltes,
    reste,
    depenses,
    solde: recoltes - depenses,
    tauxRecouvrement,
    unpaidAmount: useInvoices
      ? unpaidAmount
      : Math.max(0, budgetAnnuel - recoltes),
    partialAmount: useInvoices ? partialAmount : 0,
    paidAmount: paidBasis,
    byMonth: Array.from(monthMap.values())
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .map(({ sort: _s, ...rest }) => rest),
    byMethod: Array.from(methodMap.entries()).map(([name, value]) => ({
      name,
      value,
    })),
    byStatus: [
      { name: "Payé", value: paidBasis },
      {
        name: "Impayé / reste",
        value: useInvoices
          ? unpaidAmount + partialAmount
          : Math.max(0, budgetAnnuel - recoltes),
      },
    ],
    byBranch,
  };
}

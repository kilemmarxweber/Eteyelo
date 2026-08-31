import { branchDocumentName } from "@/lib/branch-document-name";
import { prisma } from "@/lib/prisma";
import {
  computeScopedDiscountAmount,
  EMPTY_DISCOUNT,
  getBestDiscountInfo,
} from "@/lib/payment-discount";
import { isFraisChargedOnAccount } from "@/lib/optional-frais";
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

export type FinanceFeeLine = {
  fraisId: string;
  nameFrais: string;
  due: number;
  paid: number;
  reste: number;
};

export type FinanceStudentDetail = {
  studentId: string;
  enrollmentId: string;
  matricule: string;
  nom: string;
  postnom: string;
  prenom: string;
  classeCode: string;
  classeName: string;
  branche: string;
  annee: string;
  fees: FinanceFeeLine[];
  totalDue: number;
  totalPaid: number;
  totalReste: number;
  remise: number;
};

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
  /** Détail par élève : dû / payé / reste + libellés de frais. */
  studentDetails: FinanceStudentDetail[];
  totalsStudents: {
    due: number;
    paid: number;
    reste: number;
    count: number;
  };
};

/**
 * Budget attendu = somme des frais actifs par classe × nb d'inscriptions
 * (même logique que le rapport impayés caisse).
 */
async function computeBudgetFromFrais(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
  branchIds: string[];
  classeKey?: string;
}): Promise<{
  total: number;
  byBranch: Map<string, number>;
}> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const yearFilter =
    params.schoolYearIds.length > 0
      ? { schoolYearId: { in: params.schoolYearIds } }
      : {};
  const classeFilter =
    params.classeKey && params.classeKey !== "all"
      ? { classe: { codeClasse: params.classeKey } }
      : {};

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      ...branchFilter,
      ...yearFilter,
      ...classeFilter,
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
      isOptional: true,
    },
  });

  const dueByClasseBranch = new Map<string, number>();
  for (const frais of fraisList) {
    if (frais.isOptional) continue;
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

async function loadFinanceStudentDetails(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
  classeKey?: string;
}): Promise<{
  studentDetails: FinanceStudentDetail[];
  totalsStudents: FinanceReport["totalsStudents"];
}> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const yearFilter =
    params.schoolYearIds.length > 0
      ? { schoolYearId: { in: params.schoolYearIds } }
      : {};
  const classeFilter =
    params.classeKey && params.classeKey !== "all"
      ? { classe: { codeClasse: params.classeKey } }
      : {};

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      ...branchFilter,
      ...yearFilter,
      ...classeFilter,
      OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
    },
    select: {
      id: true,
      studentId: true,
      classeId: true,
      branchId: true,
      schoolYearId: true,
      schoolYear: { select: { nameYear: true } },
      classe: {
        select: { codeClasse: true, nameClasse: true },
      },
      branch: { select: { name: true } },
      student: {
        select: {
          parentId: true,
          branchMember: {
            select: {
              member: {
                select: {
                  user: {
                    select: {
                      username: true,
                      name: true,
                      postnom: true,
                      prenom: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { classe: { codeClasse: "asc" } },
      { createdAt: "asc" },
    ],
  });

  if (enrollments.length === 0) {
    return {
      studentDetails: [],
      totalsStudents: { due: 0, paid: 0, reste: 0, count: 0 },
    };
  }

  const classeIds = Array.from(new Set(enrollments.map((e) => e.classeId)));
  const enrollmentIds = enrollments.map((e) => e.id);

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
      id: true,
      nameFrais: true,
      montantFrais: true,
      typeFraisId: true,
      classeId: true,
      priority: true,
      isOptional: true,
    },
    orderBy: [{ priority: "asc" }, { nameFrais: "asc" }],
  });

  const fraisByClasse = new Map<string, typeof fraisList>();
  for (const f of fraisList) {
    const list = fraisByClasse.get(f.classeId) ?? [];
    list.push(f);
    fraisByClasse.set(f.classeId, list);
  }

  const fraisIds = fraisList.map((f) => f.id);
  const paidByEnrollmentFrais = new Map<string, number>();

  if (enrollmentIds.length > 0 && fraisIds.length > 0) {
    const aggregates = await prisma.familyPayment.groupBy({
      by: ["classEnrollmentId", "fraisId"],
      where: {
        ...branchFilter,
        classEnrollmentId: { in: enrollmentIds },
        fraisId: { in: fraisIds },
        status: "VALIDE",
      },
      _sum: { amount: true },
    });
    for (const row of aggregates) {
      paidByEnrollmentFrais.set(
        `${row.classEnrollmentId}:${row.fraisId}`,
        Number(row._sum.amount ?? 0),
      );
    }
  }

  const parentBranchPairs = new Map<string, { parentId: string; branchId: string }>();
  for (const e of enrollments) {
    const parentId = e.student?.parentId;
    if (!parentId) continue;
    parentBranchPairs.set(`${parentId}:${e.branchId}`, {
      parentId,
      branchId: e.branchId,
    });
  }

  const discountByKey = new Map<string, Awaited<ReturnType<typeof getBestDiscountInfo>>>();
  await Promise.all(
    Array.from(parentBranchPairs.values()).map(async ({ parentId, branchId }) => {
      discountByKey.set(
        `${parentId}:${branchId}`,
        await getBestDiscountInfo(prisma, parentId, branchId),
      );
    }),
  );

  const studentDetails: FinanceStudentDetail[] = enrollments.map((enrollment) => {
    const user = enrollment.student?.branchMember?.member?.user;
    const classFrais = (fraisByClasse.get(enrollment.classeId) ?? []).filter(
      (f) =>
        isFraisChargedOnAccount(
          Boolean(f.isOptional),
          paidByEnrollmentFrais.get(`${enrollment.id}:${f.id}`) ?? 0,
        ),
    );
    const parentId = enrollment.student?.parentId ?? null;
    const discount = parentId
      ? (discountByKey.get(`${parentId}:${enrollment.branchId}`) ?? EMPTY_DISCOUNT)
      : EMPTY_DISCOUNT;

    const remiseTotal = computeScopedDiscountAmount(
      classFrais.map((f) => ({
        base: Number(f.montantFrais),
        typeFraisId: f.typeFraisId,
      })),
      discount,
    );

    const eligibleBases = classFrais.map((f) => {
      const base = Number(f.montantFrais);
      const eligible =
        discount.percentage > 0 &&
        (!discount.typeFraisId || discount.typeFraisId === f.typeFraisId);
      return eligible ? base : 0;
    });
    const eligibleSum = eligibleBases.reduce((s, v) => s + v, 0);

    let allocatedRemise = 0;
    const eligibleIndexes = classFrais
      .map((_, i) => i)
      .filter((i) => eligibleBases[i] > 0);
    const fees: FinanceFeeLine[] = classFrais.map((f, index) => {
      const dueBrut = Number(f.montantFrais);
      let share = 0;
      if (remiseTotal > 0 && eligibleSum > 0 && eligibleBases[index] > 0) {
        const pos = eligibleIndexes.indexOf(index);
        if (pos === eligibleIndexes.length - 1) {
          share = Math.max(0, remiseTotal - allocatedRemise);
        } else {
          share = (eligibleBases[index] / eligibleSum) * remiseTotal;
          allocatedRemise += share;
        }
      }
      const due = Math.max(0, dueBrut - share);
      const paid =
        paidByEnrollmentFrais.get(`${enrollment.id}:${f.id}`) ?? 0;
      const reste = Math.max(0, due - paid);
      return {
        fraisId: f.id,
        nameFrais: f.nameFrais,
        due,
        paid,
        reste,
      };
    });

    const totalDue = fees.reduce((s, f) => s + f.due, 0);
    const totalPaid = fees.reduce((s, f) => s + f.paid, 0);
    const totalReste = fees.reduce((s, f) => s + f.reste, 0);

    return {
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      matricule: user?.username?.trim() || "—",
      nom: user?.name?.trim() || "—",
      postnom: user?.postnom?.trim() || "—",
      prenom: user?.prenom?.trim() || "—",
      classeCode: enrollment.classe?.codeClasse ?? "—",
      classeName: enrollment.classe?.nameClasse ?? "—",
      branche: enrollment.branch?.name ?? "—",
      annee: enrollment.schoolYear?.nameYear ?? "—",
      fees,
      totalDue,
      totalPaid,
      totalReste,
      remise: remiseTotal,
    };
  });

  studentDetails.sort((a, b) => {
    const byClass = a.classeCode.localeCompare(b.classeCode, "fr");
    if (byClass !== 0) return byClass;
    return `${a.nom} ${a.postnom} ${a.prenom}`.localeCompare(
      `${b.nom} ${b.postnom} ${b.prenom}`,
      "fr",
    );
  });

  return {
    studentDetails,
    totalsStudents: {
      due: studentDetails.reduce((s, r) => s + r.totalDue, 0),
      paid: studentDetails.reduce((s, r) => s + r.totalPaid, 0),
      reste: studentDetails.reduce((s, r) => s + r.totalReste, 0),
      count: studentDetails.length,
    },
  };
}

export async function getFinanceReport(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
  classeKey?: string;
}): Promise<FinanceReport> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const classeKey = params.classeKey?.trim() || "all";
  const yearFilter =
    params.schoolYearIds.length > 0
      ? { YearId: { in: params.schoolYearIds } }
      : {};

  const enrollmentYearFilter =
    params.schoolYearIds.length > 0
      ? { schoolYearId: { in: params.schoolYearIds } }
      : {};
  const enrollmentClasseFilter =
    classeKey !== "all" ? { classe: { codeClasse: classeKey } } : {};

  const branches = await prisma.branch.findMany({
    where:
      params.scope.scope === "branch" && params.scope.branchId
        ? { id: params.scope.branchId }
        : { organizationId: params.scope.organizationId, isActive: true },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
  const branchIds = branches.map((b) => b.id);

  const [invoices, payments, expenses, fraisBudget, studentDetailBlock] =
    await Promise.all([
      prisma.invoice.findMany({
        where: {
          ...branchFilter,
          ...yearFilter,
          ...(classeKey !== "all"
            ? {
                enrollment: {
                  ...enrollmentYearFilter,
                  ...enrollmentClasseFilter,
                },
              }
            : {}),
        },
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
          classEnrollment: {
            ...enrollmentYearFilter,
            ...enrollmentClasseFilter,
          },
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
        classeKey,
      }),
      loadFinanceStudentDetails({
        scope: params.scope,
        schoolYearIds: params.schoolYearIds,
        classeKey,
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
      branchName: branchDocumentName(b),
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
    studentDetails: studentDetailBlock.studentDetails,
    totalsStudents: studentDetailBlock.totalsStudents,
  };
}

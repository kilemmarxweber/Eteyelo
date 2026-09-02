import "server-only";

import { Prisma } from "@/prisma/generated/prisma/client";

export const PAYROLL_SALARY_CATEGORY = "Paiement salaire";

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

type ExpenseDb = {
  transaction: {
    create: (args: {
      data: { reference: string; branchId: string };
    }) => Promise<unknown>;
  };
  cashierExpense: {
    findUnique: (args: {
      where: {
        branchId_transactionRef: { branchId: string; transactionRef: string };
      };
      select?: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: {
        amount: number;
        transactionRef: string;
        description: string;
        category: string;
        branchId: string;
        createdByUserId: string;
      };
      select?: { id: true };
    }) => Promise<{ id: string }>;
  };
};

export function payrollSalaryTransactionRef(payslipId: string) {
  return `SAL-${payslipId}`;
}

export function payrollSalaryExpenseDescription(params: {
  teacherName: string;
  month: number;
  year: number;
}) {
  const monthLabel = MONTHS_FR[params.month - 1] ?? String(params.month);
  const name = params.teacherName.trim() || "enseignant";
  return `Paiement salaire · ${name} · ${monthLabel} ${params.year}`;
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** Crée la dépense caisse du bulletin, ou la réutilise si elle existe déjà. */
export async function recordPayslipSalaryExpense(
  db: ExpenseDb,
  params: {
    branchId: string;
    userId: string;
    payslipId: string;
    amount: number;
    teacherName: string;
    year: number;
    month: number;
  },
): Promise<{ created: boolean; skipped: boolean; expenseId?: string }> {
  if (params.amount <= 0) {
    return { created: false, skipped: true };
  }

  const transactionRef = payrollSalaryTransactionRef(params.payslipId);
  const existing = await db.cashierExpense.findUnique({
    where: {
      branchId_transactionRef: {
        branchId: params.branchId,
        transactionRef,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { created: false, skipped: false, expenseId: existing.id };
  }

  try {
    await db.transaction.create({
      data: { reference: transactionRef, branchId: params.branchId },
    });
    const expense = await db.cashierExpense.create({
      data: {
        amount: params.amount,
        transactionRef,
        description: payrollSalaryExpenseDescription(params),
        category: PAYROLL_SALARY_CATEGORY,
        branchId: params.branchId,
        createdByUserId: params.userId,
      },
      select: { id: true },
    });
    return { created: true, skipped: false, expenseId: expense.id };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const conflict = await db.cashierExpense.findUnique({
      where: {
        branchId_transactionRef: {
          branchId: params.branchId,
          transactionRef,
        },
      },
      select: { id: true },
    });
    if (conflict) {
      return { created: false, skipped: false, expenseId: conflict.id };
    }
    throw error;
  }
}

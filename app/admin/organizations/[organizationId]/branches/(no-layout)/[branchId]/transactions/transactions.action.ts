"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";
import { requireFinanceBranchContext } from "@/lib/auth/require-branch-context";
import { getBaseCurrency } from "@/lib/exchange-rate";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";

function formatPersonName(user: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null | undefined) {
  if (!user) return "—";
  return [user.name, user.postnom, user.prenom].filter(Boolean).join(" ") || "—";
}

function revalidateTransactionPages(organizationId: string, branchId: string) {
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/transactions`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/paiement`,
  );
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}/paie-enseignants`,
  );
}

const transactionKindSchema = z.enum(["PAYMENT", "EXPENSE"]);
const periodModeSchema = z.enum(["day", "all", "period"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Jour civil YYYY-MM-DD → [start, endExclusive) pour scan d’index btree. */
function dayRange(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, day!));
  const endExclusive = new Date(Date.UTC(year!, month! - 1, day! + 1));
  return { gte: start, lt: endExclusive };
}

function periodRange(startDate: string, endDate: string) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(Date.UTC(sy!, sm! - 1, sd!));
  const endExclusive = new Date(Date.UTC(ey!, em! - 1, ed! + 1));
  return { gte: start, lt: endExclusive };
}

function toDateInputValue(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE ?? "Africa/Kinshasa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function looksLikeTransactionRef(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,}$/.test(value) && !/\s/.test(value);
}

export const getBranchTransactionsAction = action
  .input(
    z.object({
      includeArchived: z.boolean().optional(),
      search: z.string().trim().max(120).optional(),
      mode: periodModeSchema.optional().default("day"),
      day: z.string().regex(DATE_RE).optional(),
      startDate: z.string().regex(DATE_RE).optional(),
      endDate: z.string().regex(DATE_RE).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const context = await requireFinanceBranchContext();
    await assertBranchAreaAccess("payroll", context.session, {
      organizationId: context.organizationId,
      branchId: context.branchId,
    });

    const search = input.search?.trim();
    const mode = input.mode ?? "day";
    const day = input.day ?? toDateInputValue();

    let createdAt: { gte: Date; lt: Date } | undefined;
    if (mode === "day") {
      createdAt = dayRange(day);
    } else if (mode === "period") {
      if (!input.startDate || !input.endDate) {
        throw new Error("Indiquez une date de début et une date de fin");
      }
      if (input.startDate > input.endDate) {
        throw new Error("La date de début doit précéder la date de fin");
      }
      createdAt = periodRange(input.startDate, input.endDate);
    }

    // Ordre des prédicats = index (branchId, isArchived, createdAt) / (branchId, createdAt)
    const baseWhere = {
      branchId: context.branchId,
      ...(input.includeArchived ? {} : { isArchived: false as const }),
      ...(createdAt ? { createdAt } : {}),
    };

    const take = mode === "day" ? 300 : 500;
    const refSearch = search && looksLikeTransactionRef(search);

    const paymentSearch = search
      ? refSearch
        ? {
            OR: [
              {
                transactionRef: {
                  equals: search,
                  mode: "insensitive" as const,
                },
              },
              {
                transactionRef: {
                  startsWith: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {
            OR: [
              {
                transactionRef: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                classEnrollment: {
                  student: {
                    branchMember: {
                      member: {
                        user: {
                          OR: [
                            { name: { contains: search, mode: "insensitive" as const } },
                            { postnom: { contains: search, mode: "insensitive" as const } },
                            { prenom: { contains: search, mode: "insensitive" as const } },
                          ],
                        },
                      },
                    },
                  },
                },
              },
              {
                parent: {
                  branchMember: {
                    member: {
                      user: {
                        OR: [
                          { name: { contains: search, mode: "insensitive" as const } },
                          { postnom: { contains: search, mode: "insensitive" as const } },
                          { prenom: { contains: search, mode: "insensitive" as const } },
                        ],
                      },
                    },
                  },
                },
              },
              {
                classEnrollment: {
                  classe: {
                    OR: [
                      { nameClasse: { contains: search, mode: "insensitive" as const } },
                      { codeClasse: { contains: search, mode: "insensitive" as const } },
                    ],
                  },
                },
              },
            ],
          }
      : {};

    const expenseSearch = search
      ? refSearch
        ? {
            OR: [
              {
                transactionRef: {
                  equals: search,
                  mode: "insensitive" as const,
                },
              },
              {
                transactionRef: {
                  startsWith: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {
            OR: [
              {
                transactionRef: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              { description: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
            ],
          }
      : {};

    const [payments, expenses, rates] = await Promise.all([
      prisma.familyPayment.findMany({
        where: {
          ...baseWhere,
          ...paymentSearch,
        },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          amount: true,
          receivedCurrency: true,
          receivedAmount: true,
          method: true,
          transactionRef: true,
          status: true,
          isArchived: true,
          archivedAt: true,
          createdAt: true,
          parent: {
            select: {
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
            },
          },
          classEnrollment: {
            select: {
              classe: {
                select: { nameClasse: true, codeClasse: true, cycle: true },
              },
              student: {
                select: {
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
                },
              },
            },
          },
        },
      }),
      prisma.cashierExpense.findMany({
        where: {
          ...baseWhere,
          ...expenseSearch,
        },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          amount: true,
          transactionRef: true,
          description: true,
          category: true,
          isArchived: true,
          archivedAt: true,
          createdAt: true,
          createdByUser: {
            select: { name: true, postnom: true, prenom: true },
          },
        },
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
    ]);

    const paymentRows = payments.map((row) => ({
      id: row.id,
      kind: "PAYMENT" as const,
      transactionRef: row.transactionRef,
      amount: row.amount,
      receivedCurrency: row.receivedCurrency,
      receivedAmount: row.receivedAmount,
      method: row.method,
      status: row.status,
      isArchived: row.isArchived,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      studentName: formatPersonName(
        row.classEnrollment?.student?.branchMember?.member?.user,
      ),
      parentName: formatPersonName(row.parent?.branchMember?.member?.user),
      className:
        row.classEnrollment?.classe?.nameClasse ||
        row.classEnrollment?.classe?.codeClasse ||
        "—",
      cycle: row.classEnrollment?.classe?.cycle ?? null,
      description: null as string | null,
      category: null as string | null,
      cashierName: null as string | null,
    }));

    const expenseRows = expenses.map((row) => ({
      id: row.id,
      kind: "EXPENSE" as const,
      transactionRef: row.transactionRef,
      amount: row.amount,
      receivedCurrency: null as string | null,
      receivedAmount: null as number | null,
      method: null as string | null,
      status: "DEPENSE",
      isArchived: row.isArchived,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      studentName: "—",
      parentName: "—",
      className: "—",
      cycle: null as string | null,
      description: row.description,
      category: row.category,
      cashierName: formatPersonName(row.createdByUser),
    }));

    const rows = [...paymentRows, ...expenseRows]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 500);

    return {
      currency: getBaseCurrency(rates),
      canDelete: isOrganizationOwnerSession(context.session),
      mode,
      day: mode === "day" ? (input.day ?? toDateInputValue()) : null,
      startDate: mode === "period" ? input.startDate ?? null : null,
      endDate: mode === "period" ? input.endDate ?? null : null,
      rows,
    };
  });

export const archiveBranchTransactionAction = action
  .input(
    z.object({
      id: z.string().min(1),
      kind: transactionKindSchema,
    }),
  )
  .handler(async ({ input }) => {
    const context = await requireFinanceBranchContext();
    await assertBranchAreaAccess("payroll", context.session, {
      organizationId: context.organizationId,
      branchId: context.branchId,
    });

    if (input.kind === "PAYMENT") {
      const row = await prisma.familyPayment.findFirst({
        where: {
          id: input.id,
          branchId: context.branchId,
          isArchived: false,
        },
        select: { id: true },
      });
      if (!row) throw new Error("Transaction introuvable");
      await prisma.familyPayment.update({
        where: { id: row.id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          archivedById: context.userId,
        },
      });
    } else {
      const row = await prisma.cashierExpense.findFirst({
        where: {
          id: input.id,
          branchId: context.branchId,
          isArchived: false,
        },
        select: { id: true },
      });
      if (!row) throw new Error("Dépense introuvable");
      await prisma.cashierExpense.update({
        where: { id: row.id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          archivedById: context.userId,
        },
      });
    }

    revalidateTransactionPages(context.organizationId, context.branchId);
    return { ok: true };
  });

export const unarchiveBranchTransactionAction = action
  .input(
    z.object({
      id: z.string().min(1),
      kind: transactionKindSchema,
    }),
  )
  .handler(async ({ input }) => {
    const context = await requireFinanceBranchContext();
    await assertBranchAreaAccess("payroll", context.session, {
      organizationId: context.organizationId,
      branchId: context.branchId,
    });

    if (input.kind === "PAYMENT") {
      const row = await prisma.familyPayment.findFirst({
        where: {
          id: input.id,
          branchId: context.branchId,
          isArchived: true,
        },
        select: { id: true },
      });
      if (!row) throw new Error("Transaction archivée introuvable");
      await prisma.familyPayment.update({
        where: { id: row.id },
        data: {
          isArchived: false,
          archivedAt: null,
          archivedById: null,
        },
      });
    } else {
      const row = await prisma.cashierExpense.findFirst({
        where: {
          id: input.id,
          branchId: context.branchId,
          isArchived: true,
        },
        select: { id: true },
      });
      if (!row) throw new Error("Dépense archivée introuvable");
      await prisma.cashierExpense.update({
        where: { id: row.id },
        data: {
          isArchived: false,
          archivedAt: null,
          archivedById: null,
        },
      });
    }

    revalidateTransactionPages(context.organizationId, context.branchId);
    return { ok: true };
  });

export const deleteBranchTransactionAction = action
  .input(
    z.object({
      id: z.string().min(1),
      kind: transactionKindSchema,
    }),
  )
  .handler(async ({ input }) => {
    const context = await requireFinanceBranchContext();
    await assertBranchAreaAccess("payroll", context.session, {
      organizationId: context.organizationId,
      branchId: context.branchId,
    });
    if (!isOrganizationOwnerSession(context.session)) {
      throw new Error(
        "Seul le propriétaire peut supprimer définitivement une transaction.",
      );
    }

    if (input.kind === "PAYMENT") {
      const existing = await prisma.familyPayment.findFirst({
        where: { id: input.id, branchId: context.branchId },
        select: { id: true, batchId: true },
      });
      if (!existing) throw new Error("Transaction introuvable");

      await prisma.$transaction(async (tx) => {
        await tx.paymentAllocation.deleteMany({
          where: { familyPaymentId: existing.id, branchId: context.branchId },
        });
        await tx.paymentEvent.deleteMany({
          where: { paymentId: existing.id, branchId: context.branchId },
        });
        await tx.mobileMoneyTransaction.deleteMany({
          where: { paymentId: existing.id, branchId: context.branchId },
        });
        await tx.familyPayment.delete({ where: { id: existing.id } });
        if (existing.batchId != null) {
          const remaining = await tx.familyPayment.count({
            where: { batchId: existing.batchId, branchId: context.branchId },
          });
          if (remaining === 0) {
            await tx.paymentBatch.deleteMany({
              where: { id: existing.batchId, branchId: context.branchId },
            });
          }
        }
      });
    } else {
      const existing = await prisma.cashierExpense.findFirst({
        where: { id: input.id, branchId: context.branchId },
        select: { id: true },
      });
      if (!existing) throw new Error("Dépense introuvable");
      await prisma.cashierExpense.delete({ where: { id: existing.id } });
    }

    revalidateTransactionPages(context.organizationId, context.branchId);
    return { ok: true };
  });

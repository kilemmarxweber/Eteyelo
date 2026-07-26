"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import z from "zod";
import { paiementSchema, StatusPaiement } from "@/src/interfaces/Paiement";
import { requireFinanceBranchContext } from "@/lib/auth/require-branch-context";
import { randomUUID } from "node:crypto";
import { Prisma, CurrencyCode } from "@/prisma/generated/prisma/client";
import {
  buildSchoolReportContext,
  schoolReportBranchSelect,
} from "@/lib/reports/resolve-school-branding";
import {
  convertAmount,
  getBaseCurrency,
  getQuoteCurrency,
  getRateUsed,
  getSelectedRate,
  roundCurrency,
  type ExchangeRatePair,
} from "@/lib/exchange-rate";
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import { getSchoolYearForBranch } from "@/lib/school-year";
import {
  computeScopedDiscountAmount,
  EMPTY_DISCOUNT,
  getBestDiscountInfo,
  type DiscountInfo,
} from "@/lib/payment-discount";

async function loadOrgExchangeRates(organizationId: string): Promise<{
  rates: ExchangeRatePair[];
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode | null;
  selectedRate: number | null;
}> {
  const rows = await prisma.exchangeRate.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ fromCurrency: "asc" }, { toCurrency: "asc" }],
  });
  const rates: ExchangeRatePair[] = rows.map((row) => ({
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
    isActive: row.isActive,
    isSelected: row.isSelected,
  }));
  const selected = getSelectedRate(rates);
  return {
    rates,
    baseCurrency: getBaseCurrency(rates),
    quoteCurrency: getQuoteCurrency(rates),
    selectedRate: selected?.rate ?? null,
  };
}

function resolveUsdCdfRate(rates: ExchangeRatePair[]): number {
  const direct = getRateUsed(CurrencyCode.USD, CurrencyCode.CDF, rates);
  if (direct != null) return direct;
  const inverse = getRateUsed(CurrencyCode.CDF, CurrencyCode.USD, rates);
  if (inverse != null && inverse !== 0) return 1 / inverse;
  return DEFAULT_EXCHANGE_RATE_USD_CDF;
}

const linkedUserInclude = {
  branchMember: {
    include: {
      member: {
        include: {
          user: true,
        },
      },
    },
  },
};

function getLinkedUser(record: any) {
  return record?.branchMember?.member?.user ?? null;
}

function revalidatePaiementPages(organizationId: string, branchId: string) {
  revalidatePath(`/admin/organizations/${organizationId}/branches/${branchId}/paiement`);
}

/**
 * Solde d'ouverture automatique = solde net cumule juste avant `before`
 * (encaissements VALIDES - depenses). Equivalent au solde net de la veille
 * lorsque `before` est le debut du jour affiche.
 */
async function getAutomaticOpeningBalance(branchId: string, before: Date) {
  const [incomeBefore, expenseBefore] = await Promise.all([
    prisma.familyPayment.aggregate({
      where: {
        branchId,
        status: StatusPaiement.VALIDE,
        createdAt: { lt: before },
      },
      _sum: { amount: true },
    }),
    prisma.cashierExpense.aggregate({
      where: {
        branchId,
        createdAt: { lt: before },
      },
      _sum: { amount: true },
    }),
  ]);

  return (
    Number(incomeBefore._sum.amount ?? 0) -
    Number(expenseBefore._sum.amount ?? 0)
  );
}

function buildFamilyPaymentRef(baseRef: string, lineIndex: number) {
  return `${baseRef}-${String(lineIndex + 1).padStart(2, "0")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function buildUniqueReference(prefix: string) {
  const now = new Date();
  const date = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `${prefix}-${date}-${randomUUID().slice(0, 12).toUpperCase()}`;
}

type ReceiptPayload = {
  invoiceNumber: string;
  sender: {
    name: string;
    address: string;
  };
  recipient: {
    name: string;
    class?: string;
    sexe?: string;
  };
  items: {
    description: string;
    price: number;
    mode: string;
    montant: number;
    receivedAmount?: number;
    classe?: string;
    codeClasse?: string;
  }[];
  logoUrl: string;
  exchangeRateUsdCdf: number;
  issuedPlace?: string;
  receivedCurrency?: "USD" | "CDF" | "AOA";
  baseCurrency?: "USD" | "CDF" | "AOA";
  quoteCurrency?: "USD" | "CDF" | "AOA" | null;
  selectedRate?: number | null;
};

/* ======================================================
   TYPES SAFE
====================================================== */
/* ======================================================
   GET FRAIS WITH BALANCE (SAFE)
====================================================== */

export async function getFraisWithBalance(
  classEnrollIds: string[],
  fraisIds: string[],
  parentId?: string,
) {
  const { branchId: activeBranchId } = await requireFinanceBranchContext();
  const discount = parentId
    ? await getBestDiscountInfo(prisma, parentId, activeBranchId)
    : EMPTY_DISCOUNT;

  const fraisList = await prisma.frais.findMany({
    where: { id: { in: fraisIds }, branchId: activeBranchId },
    include: {
      typeFrais: {
        select: { id: true, nameType: true },
      },
    },
  });

  const results = [];

  for (const classEnrollmentId of classEnrollIds) {
    for (const frais of fraisList) {
      const paid = await prisma.familyPayment.aggregate({
        where: {
          branchId: activeBranchId,
          classEnrollmentId,
          fraisId: frais.id,
          status: StatusPaiement.VALIDE,
        },
        _sum: { amount: true },
      });

      const alreadyPaid = Number(paid._sum.amount ?? 0);
      const total = Number(frais.montantFrais);

      results.push({
        fraisId: frais.id,
        classEnrollmentId,
        priority: frais.priority ?? 99,
        typeFraisId: frais.typeFraisId,
        typeFraisName: frais.typeFrais?.nameType ?? null,
        total,
        alreadyPaid,
        remaining: total - alreadyPaid, // ⚠️ ne PAS clamp ici
      });
    }
  }

  return {
    items: results,
    discount: discount.percentage,
    discountTypeFraisId: discount.typeFraisId,
    discountTypeFraisName: discount.typeFraisName,
  };
}

/* ======================================================
   CREATE PAYMENT (FULL FIXED ENGINE)
====================================================== */
export const createPaiementAction = action
  .input(paiementSchema)
  .handler(async ({ input }) => {
    const {
      amount,
      modePaiement,
      status,
      parentId,
      notes,
      classEnrollIds,
      fraisIds,
      receivedCurrency: rawReceivedCurrency,
      receivedAmount: rawReceivedAmount,
      exchangeRateUsed: rawExchangeRateUsed,
    } = input;

    if (!classEnrollIds.length) throw new Error("❌ Aucun élève sélectionné");
    if (!fraisIds.length) throw new Error("❌ Aucun frais sélectionné");
    if (amount === 0 || amount === undefined || amount === null) {
      throw new Error("❌ Montant invalide");
    }

    const { branchId, organizationId } = await requireFinanceBranchContext();
    const {
      rates: exchangeRates,
      baseCurrency,
      quoteCurrency,
      selectedRate,
    } = await loadOrgExchangeRates(organizationId);
    const usdCdfRate = resolveUsdCdfRate(exchangeRates);

    const receivedCurrency =
      (rawReceivedCurrency as CurrencyCode | undefined) ?? baseCurrency;
    const totalBaseTarget = Number(amount);

    let totalReceivedTarget =
      rawReceivedAmount != null && Number.isFinite(Number(rawReceivedAmount))
        ? Number(rawReceivedAmount)
        : null;
    let exchangeRateUsed =
      rawExchangeRateUsed != null && Number.isFinite(Number(rawExchangeRateUsed))
        ? Number(rawExchangeRateUsed)
        : null;

    if (receivedCurrency === baseCurrency) {
      totalReceivedTarget = totalBaseTarget;
      exchangeRateUsed = 1;
    } else {
      try {
        const serverReceived = convertAmount(
          totalBaseTarget,
          baseCurrency,
          receivedCurrency,
          exchangeRates,
          baseCurrency,
        );
        totalReceivedTarget = serverReceived;
        exchangeRateUsed =
          getRateUsed(receivedCurrency, baseCurrency, exchangeRates) ??
          (serverReceived !== 0 ? totalBaseTarget / serverReceived : null);
      } catch {
        // keep client values if conversion pair missing; validated below
      }
    }

    if (receivedCurrency !== baseCurrency) {
      if (totalReceivedTarget == null || totalReceivedTarget <= 0) {
        throw new Error("❌ Montant perçu invalide pour la devise sélectionnée");
      }
      if (exchangeRateUsed == null || exchangeRateUsed <= 0) {
        throw new Error("❌ Taux de change manquant pour ce paiement");
      }
    }

    let allocatedReceived = 0;

    const buildCurrencyFields = (
      baseLineAmount: number,
      totalBasePaid: number,
      totalReceivedPaid: number,
      isLastLine: boolean,
    ) => {
      if (
        receivedCurrency === baseCurrency ||
        totalReceivedPaid <= 0 ||
        totalBasePaid <= 0
      ) {
        return {
          receivedCurrency: baseCurrency,
          receivedAmount: baseLineAmount,
          exchangeRateUsed: exchangeRateUsed ?? 1,
        };
      }

      let receivedLine: number;
      if (isLastLine) {
        receivedLine = roundCurrency(
          Math.max(totalReceivedPaid - allocatedReceived, 0),
          receivedCurrency,
        );
      } else {
        receivedLine = roundCurrency(
          (baseLineAmount / totalBasePaid) * totalReceivedPaid,
          receivedCurrency,
        );
        allocatedReceived += receivedLine;
      }

      return {
        receivedCurrency,
        receivedAmount: receivedLine,
        exchangeRateUsed,
      };
    };

    const uniqueClassEnrollIds = Array.from(new Set(classEnrollIds));
    const uniqueFraisIds = Array.from(new Set(fraisIds));

    const result = await prisma.$transaction(async (tx) => {
      /* Référence UUID : sûre entre requêtes concurrentes et données historiques. */
      const reference = buildUniqueReference("TRNS");
      const transaction = await tx.transaction.create({
        data: { reference, branchId },
      });

      /* ======================================================
         PARENT + DISCOUNT RULE
      ====================================================== */
      const parent = await tx.parent.findFirst({
        where: {
          id: parentId,
          branchMember: { branchId },
        },
        include: {
          students: {
            where: {
              branchMember: { branchId },
            },
          },
        },
      });

      if (!parent) throw new Error("Parent introuvable");

      const studentCount = uniqueClassEnrollIds.length;

      const hasOrphan = parent.students.some(
        (s: any) => s.category === "ORPHAN",
      );

      const parentRule = await tx.discountRule.findFirst({
        where: { branchId, scope: "PARENT", parentId },
        include: { typeFrais: { select: { id: true, nameType: true } } },
      });

      const groupRule = await tx.discountRule.findFirst({
        where: {
          branchId,
          scope: "GROUP",
          minChildren: { lte: studentCount },
        },
        include: { typeFrais: { select: { id: true, nameType: true } } },
        orderBy: { minChildren: "desc" },
      });

      const orphanRule = hasOrphan
        ? await tx.discountRule.findFirst({
            where: { branchId, scope: "ORPHAN" },
            include: { typeFrais: { select: { id: true, nameType: true } } },
          })
        : null;

      const discountCandidates = [parentRule, groupRule, orphanRule].filter(
        (rule): rule is NonNullable<typeof parentRule> =>
          Boolean(rule && (rule.percentage ?? 0) > 0),
      );
      const bestDiscountRule = discountCandidates.reduce<
        (typeof discountCandidates)[number] | null
      >((best, rule) => {
        if (!best || rule.percentage > best.percentage) return rule;
        return best;
      }, null);

      const discountInfo: DiscountInfo = bestDiscountRule
        ? {
            percentage: bestDiscountRule.percentage,
            typeFraisId: bestDiscountRule.typeFraisId ?? null,
            typeFraisName: bestDiscountRule.typeFrais?.nameType ?? null,
          }
        : EMPTY_DISCOUNT;

      const discountPercent = discountInfo.percentage;

      /* ======================================================
         BALANCES
      ====================================================== */
      const { items: balances } = await getFraisWithBalance(
        uniqueClassEnrollIds,
        uniqueFraisIds,
        parentId,
      );

      type FlatItem = {
        studentId: string;
        fraisId: string;
        priority: number;
        total: number;
        remaining: number;
        typeFraisId: string | null;
      };

      const flatItems: FlatItem[] = balances
        .map((b) => ({
          studentId: b.classEnrollmentId,
          fraisId: b.fraisId,
          priority: b.priority,
          total: Math.max(Number(b.total) || 0, 0),
          remaining: Math.max(b.remaining, 0),
          typeFraisId: b.typeFraisId ?? null,
        }))
        .filter((b) => b.remaining > 0);

      /* ======================================================
         🔥 DISCOUNT SCOPED TO TYPE FRAIS (sur montant brut)
      ====================================================== */
      const totalGlobal = flatItems.reduce(
        (sum, item) => sum + item.remaining,
        0,
      );

      const discountAmount = computeScopedDiscountAmount(
        flatItems.map((item) => ({
          base: item.total,
          typeFraisId: item.typeFraisId,
        })),
        discountInfo,
      );

      const netToPay = Math.max(totalGlobal - discountAmount, 0);
      /* ======================================================
   🏦 BANK MODE: STRICT CHECKS
====================================================== */

      // 🏦 CHECK 1: Nothing to pay = already paid
      if (netToPay <= 0) {
        return {
          success: true,
          message:
            "❌ Impossible: Ce dossier est déjà entièrement soldé. Aucun paiement n'est nécessaire.",
          reference: null,
          transactionId: null,
          batchId: null,
          totalPaid: 0,
          totalGlobal,
          discountPercent,
          discountAmount,
          netToPay: 0,
          remainingBudget: 0,
          isSolded: true,
          checkSum: {
            totalDue: totalGlobal,
            alreadyPaid: totalGlobal,
            discount: discountAmount,
            remaining: 0,
          },
        };
      }

      // 🏦 CHECK 2: Amount cap validation
      if (amount > netToPay) {
        console.warn(
          `⚠️ Amount ${amount} exceeds netToPay ${netToPay}, will be capped`,
        );
      }

      // 🏦 CHECK 3: Double-check amount (should not reach here due to line 78)
      if (!amount || amount <= 0) {
        throw new Error("❌ Montant invalide: doit être strictement positif");
      }

      // 🔥 CAP automatique (comportement bancaire)
      /* budget réel disponible */
      let globalBudget = Math.min(amount, netToPay);

      /* ======================================================
         GROUP BY PRIORITY
      ====================================================== */
      const priorityMap = new Map<number, FlatItem[]>();

      for (const item of flatItems) {
        if (!priorityMap.has(item.priority)) {
          priorityMap.set(item.priority, []);
        }
        priorityMap.get(item.priority)!.push(item);
      }

      const sortedPriorities = Array.from(priorityMap.keys()).sort(
        (a, b) => a - b,
      );

      /* ======================================================
         DISTRIBUTION ENGINE
      ====================================================== */
      type PlannedLine = {
        amount: number;
        fraisId: string;
        studentId: string;
      };
      const planned: PlannedLine[] = [];

      for (const priority of sortedPriorities) {
        if (globalBudget <= 0) break;

        const items = priorityMap.get(priority)!;

        const totalNeeded = items.reduce((s, i) => s + i.remaining, 0);

        /* ===============================
           FULL PAYMENT FOR LEVEL
        =============================== */
        if (globalBudget >= totalNeeded) {
          for (const item of items) {
            planned.push({
              amount: item.remaining,
              fraisId: item.fraisId,
              studentId: item.studentId,
            });
          }

          globalBudget -= totalNeeded;
          continue;
        }

        /* ===============================
           PARTIAL DISTRIBUTION
        =============================== */
        let distributed = 0;

        const temp: {
          item: FlatItem;
          share: number;
        }[] = [];

        for (const item of items) {
          const raw = (item.remaining / totalNeeded) * globalBudget;
          const share = Math.floor(raw);

          temp.push({ item, share });
          distributed += share;
        }

        let remainder = globalBudget - distributed;

        for (const t of temp) {
          if (remainder <= 0) break;
          t.share += 1;
          remainder -= 1;
        }

        for (const t of temp) {
          if (t.share <= 0) continue;
          planned.push({
            amount: t.share,
            fraisId: t.item.fraisId,
            studentId: t.item.studentId,
          });
        }

        globalBudget = 0;
        break;
      }

      const totalBasePaid = planned.reduce((sum, line) => sum + line.amount, 0);
      const totalReceivedPaid =
        receivedCurrency === baseCurrency
          ? totalBasePaid
          : totalReceivedTarget != null && totalBaseTarget > 0
            ? roundCurrency(
                (totalBasePaid / totalBaseTarget) * totalReceivedTarget,
                receivedCurrency,
              )
            : totalBasePaid;

      const results: any[] = [];
      let paymentLineIndex = 0;

      for (let i = 0; i < planned.length; i += 1) {
        const line = planned[i];
        const currencyFields = buildCurrencyFields(
          line.amount,
          totalBasePaid,
          totalReceivedPaid,
          i === planned.length - 1,
        );

        const payment = await tx.familyPayment.create({
          data: {
            amount: line.amount,
            method: modePaiement,
            status,
            parentId,
            fraisId: line.fraisId,
            classEnrollmentId: line.studentId,
            transactionRef: buildFamilyPaymentRef(reference, paymentLineIndex),
            notes,
            branchId,
            ...currencyFields,
          },
        });

        paymentLineIndex += 1;
        results.push(payment);
      }

      /* ======================================================
         BATCH
      ====================================================== */
      let batch = null;

      if (uniqueClassEnrollIds.length > 1) {
        batch = await tx.paymentBatch.create({
          data: {
            parentId,
            totalAmount: results.reduce((s, p) => s + Number(p.amount), 0),
            status: "VALIDE",
            branchId,
          },
        });

        await tx.familyPayment.updateMany({
          where: { id: { in: results.map((r) => r.id) }, branchId },
          data: { batchId: batch.id },
        });
      }
      const wasCapped = amount > netToPay;
      const totalPaidThisTime = results.reduce(
        (s, p) => s + Number(p.amount),
        0,
      );
      const refundAmount = Math.max(amount - totalPaidThisTime, 0);
      const createdPaymentIds = results.map((payment) => payment.id);
      const receiptPayments = createdPaymentIds.length
        ? await tx.familyPayment.findMany({
            where: {
              id: { in: createdPaymentIds },
              branchId,
            },
            include: {
              frais: {
                include: {
                  classe: true,
                  schoolYear: true,
                },
              },
              classEnrollment: {
                include: {
                  student: {
                    include: {
                      ...linkedUserInclude,
                      parent: {
                        include: linkedUserInclude,
                      },
                    },
                  },
                  classe: true,
                  schoolYear: true,
                },
              },
            },
          })
        : [];

      const parentUser = getLinkedUser(
        receiptPayments[0]?.classEnrollment?.student?.parent,
      );
      const parentFullName = [
        parentUser?.prenom,
        parentUser?.name,
        parentUser?.postnom,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const branchRecord = await tx.branch.findUnique({
        where: { id: branchId },
        select: schoolReportBranchSelect,
      });

      if (!branchRecord) {
        throw new Error("Branche introuvable pour le reçu.");
      }

      const branding = buildSchoolReportContext(branchRecord, {
        exchangeRateUsdCdf: usdCdfRate,
        baseCurrency,
        quoteCurrency: quoteCurrency ?? undefined,
      });

      const receiptCurrency =
        (receiptPayments[0]?.receivedCurrency as
          | "USD"
          | "CDF"
          | "AOA"
          | undefined) ?? baseCurrency;

      const receipt: ReceiptPayload = {
        invoiceNumber: reference,
        sender: {
          name:
            branding.branchName || branding.schoolName || "Établissement",
          address: branding.address ?? "",
        },
        recipient: {
          name: parentFullName || "Parent",
        },
        items: receiptPayments.map((payment) => ({
          description: payment.frais?.nameFrais ?? "Frais scolaire",
          price: Number(payment.frais?.montantFrais ?? payment.amount),
          mode: payment.method ?? "ESPECES",
          montant: Number(payment.amount),
          receivedAmount:
            payment.receivedAmount != null
              ? Number(payment.receivedAmount)
              : Number(payment.amount),
          classe:
            payment.classEnrollment?.classe?.nameClasse ??
            payment.frais?.classe?.nameClasse ??
            "",
          codeClasse:
            payment.classEnrollment?.classe?.codeClasse ??
            payment.frais?.classe?.codeClasse ??
            "",
        })),
        logoUrl: branding.logoUrl,
        exchangeRateUsdCdf:
          branding.exchangeRateUsdCdf ?? usdCdfRate,
        issuedPlace: branding.city,
        receivedCurrency: receiptCurrency,
        baseCurrency,
        quoteCurrency,
        selectedRate,
      };

      /* ======================================================
         RETURN
      ====================================================== */
      return {
        success: true,
        message:
          refundAmount > 0
            ? `✅ Paiement enregistré: ${totalPaidThisTime} (Remboursement: ${refundAmount})`
            : `✅ Paiement enregistré: ${totalPaidThisTime} (Solde restant: ${netToPay - totalPaidThisTime})`,
        reference,
        transactionId: transaction.id,
        batchId: batch?.id ?? null,
        totalPaid: totalPaidThisTime,
        amountSubmitted: amount,
        amountDue: netToPay,
        refundAmount,

        totalGlobal,
        discountPercent,
        discountAmount,
        netToPay,
        remainingBudget: globalBudget,
        isSolded: false,
        checkSum: {
          totalDue: totalGlobal,
          alreadyPaid: totalGlobal - netToPay,
          discount: discountAmount,
          remaining: netToPay - totalPaidThisTime,
        },

        // 🔥 BONUS
        wasCapped,
        receipt,
      };
    }).catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          "Une référence de paiement existe déjà. Aucun montant n'a été enregistré ; veuillez réessayer.",
        );
      }
      throw error;
    });

    if (result.success) {
      revalidatePaiementPages(organizationId, branchId);
    }
    return result;
  });

const getDayRange = (date?: Date) => {
  const start = date ? new Date(date) : new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return { start, end };
};

export const createCashierExpenseAction = action
  .input(
    z.object({
      amount: z.coerce.number().min(0.01),
      description: z.string().optional(),
      category: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { amount, description, category } = input;
    const { branchId, organizationId } = await requireFinanceBranchContext();

    const result = await prisma.$transaction(async (tx) => {
      const reference = buildUniqueReference("EXP");

      await tx.transaction.create({
        data: { reference, branchId },
      });

      const expense = await tx.cashierExpense.create({
        data: {
          amount,
          transactionRef: reference,
          description,
          category,
          branchId,
        },
      });

      return {
        success: true,
        message: "✅ Dépense enregistrée",
        expense: {
          id: expense.id,
          amount: Number(expense.amount),
          transactionRef: expense.transactionRef,
          description: expense.description ?? null,
          category: expense.category ?? null,
          createdAt: expense.createdAt.toISOString(),
          updatedAt: expense.updatedAt.toISOString(),
        },
      };
    });

    revalidatePaiementPages(organizationId, branchId);
    return result;
  });

export const getCashierReportAction = action
  .input(
    z.object({
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
      modePaiement: z.string().optional(),
      fraisId: z.string().optional(),
      classeId: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId } = await requireFinanceBranchContext();
    
    const start = input.startDate ? new Date(input.startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const end = input.endDate ? new Date(input.endDate) : new Date(start);
    if (!input.endDate) {
      end.setDate(start.getDate() + 1);
    } else {
      end.setHours(23, 59, 59, 999);
    }

    const paymentWhere: any = {
      branchId,
      createdAt: { gte: start, lte: end },
      status: StatusPaiement.VALIDE,
    };

    if (input.modePaiement) paymentWhere.method = input.modePaiement;
    if (input.fraisId) paymentWhere.fraisId = input.fraisId;
    if (input.classeId) paymentWhere.classEnrollment = { classeId: input.classeId };

    const payments = await prisma.familyPayment.findMany({
      where: paymentWhere,
      include: {
        frais: {
          include: { classe: true, typeFrais: true },
        },
        classEnrollment: {
          include: {
            student: {
              include: {
                ...linkedUserInclude,
                parent: {
                  include: linkedUserInclude,
                },
              },
            },
            schoolYear: true,
            classe: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const skipExpenses = Boolean(input.classeId || input.fraisId || input.modePaiement);
    
    const expenses = skipExpenses 
      ? [] 
      : await prisma.cashierExpense.findMany({
          where: { branchId, createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: "desc" },
        });

    const openingBalance = await getAutomaticOpeningBalance(branchId, start);
    const previousDay = new Date(start);
    previousDay.setDate(previousDay.getDate() - 1);

    const incomeTotal = payments.reduce(
      (sum: number, item) => sum + Number(item.amount),
      0,
    );
    const outflowTotal = expenses.reduce(
      (sum: number, item) => sum + Number(item.amount),
      0,
    );

    return {
      date: start.toISOString(),
      endDate: end.toISOString(),
      openingBalance,
      hasOpeningBalance: true,
      openingSource: "previous_net" as const,
      openingLabel: `Solde net du ${previousDay.toLocaleDateString("fr-FR")}`,
      openingNote: null,
      incomeTotal,
      outflowTotal,
      periodBalance: incomeTotal - outflowTotal,
      balance: openingBalance + incomeTotal - outflowTotal,
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        method: payment.method,
        transactionRef: payment.transactionRef,
        notes: payment.notes,
        createdAt: payment.createdAt.toISOString(),
        frais: payment.frais
          ? {
              id: payment.frais.id,
              nameFrais: payment.frais.nameFrais,
              montantFrais: Number(payment.frais.montantFrais),
            }
          : null,
        studentName: (() => {
          const studentUser = getLinkedUser(payment.classEnrollment?.student);
          return studentUser
            ? `${studentUser.prenom ?? ""} ${studentUser.name ?? ""}`.trim()
            : "";
        })(),
      })),
      expenses: expenses.map((expense) => ({
        id: expense.id,
        amount: Number(expense.amount),
        transactionRef: expense.transactionRef,
        description: expense.description ?? null,
        category: expense.category ?? null,
        createdAt: expense.createdAt.toISOString(),
      })),
    };
  });

export const getCashierReportContextAction = action.handler(async () => {
  const { branchId, organizationId } = await requireFinanceBranchContext();

  const [branch, { rates, baseCurrency, quoteCurrency, selectedRate }] =
    await Promise.all([
      prisma.branch.findFirst({
        where: { id: branchId, organizationId },
        select: schoolReportBranchSelect,
      }),
      loadOrgExchangeRates(organizationId),
    ]);

  if (!branch) {
    throw new Error("Contexte introuvable.");
  }

  return {
    ...buildSchoolReportContext(branch, {
      exchangeRateUsdCdf: resolveUsdCdfRate(rates),
      baseCurrency,
      quoteCurrency: quoteCurrency ?? undefined,
    }),
    selectedRate,
  };
});

/** Branding reçu / aperçu HTML — même source que le PDF post-paiement. */
export const getPaymentReportContextAction = action.handler(async () => {
  const { branchId, organizationId } = await requireFinanceBranchContext();

  const [branch, { rates, baseCurrency, quoteCurrency, selectedRate }] =
    await Promise.all([
      prisma.branch.findFirst({
        where: { id: branchId, organizationId },
        select: schoolReportBranchSelect,
      }),
      loadOrgExchangeRates(organizationId),
    ]);

  if (!branch) {
    throw new Error("Branche active introuvable");
  }

  return {
    ...buildSchoolReportContext(branch, {
      exchangeRateUsdCdf: resolveUsdCdfRate(rates),
      baseCurrency,
      quoteCurrency: quoteCurrency ?? undefined,
    }),
    selectedRate,
  };
});

/* ======================================================
   GET ALL PAYMENTS
====================================================== */
export const getAllPaiementAction = action.handler(async () => {
  const { branchId } = await requireFinanceBranchContext();
  const paiements = await prisma.familyPayment.findMany({
    where: { branchId },
    include: {
      frais: {
        include: { classe: true, typeFrais: true },
      },
      classEnrollment: {
        include: {
          student: {
            include: {
              ...linkedUserInclude,
              parent: {
                include: linkedUserInclude,
              },
            },
          },
          schoolYear: true,
          classe: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return paiements.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    receivedCurrency: p.receivedCurrency,
    receivedAmount:
      p.receivedAmount != null ? Number(p.receivedAmount) : Number(p.amount),
    exchangeRateUsed:
      p.exchangeRateUsed != null ? Number(p.exchangeRateUsed) : null,
    method: p.method,
    status: p.status,
    transactionRef: p.transactionRef,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),

    frais: p.frais
      ? {
          id: p.frais.id,
          nameFrais: p.frais.nameFrais,
          montantFrais: Number(p.frais.montantFrais),
        }
      : null,

    classEnrollment: p.classEnrollment
      ? {
          id: p.classEnrollment.id,
          nom: getLinkedUser(p.classEnrollment.student)?.name ?? "",
          prenom: getLinkedUser(p.classEnrollment.student)?.prenom ?? "",
          sexe: getLinkedUser(p.classEnrollment.student)?.sexe ?? "",
          nameClasse: p.classEnrollment.classe?.nameClasse ?? "",
          codeClasse: p.classEnrollment.classe?.codeClasse ?? "",
          nameYear: p.classEnrollment.schoolYear?.nameYear ?? "",
          // ✅ PARENT
          parentId: p.classEnrollment.student?.parent?.id ?? "",
          parentNom: getLinkedUser(p.classEnrollment.student?.parent)?.name ?? "",
          parentPrenom:
            getLinkedUser(p.classEnrollment.student?.parent)?.prenom ?? "",
          parentPostnom:
            getLinkedUser(p.classEnrollment.student?.parent)?.postnom ?? "",
        }
      : null,
  }));
});

/* ======================================================
   UPDATE STATUS
====================================================== */
export const statusPaiementAction = action
  .input(
    z.object({
      id: z.string(),
      statusPaiement: z.nativeEnum(StatusPaiement),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();
    const existing = await prisma.familyPayment.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });

    if (!existing) throw new Error("Paiement non trouvÃ©");

    const updated = await prisma.familyPayment.update({
      where: { id: input.id },
      data: { status: input.statusPaiement },
    });
    revalidatePaiementPages(organizationId, branchId);
    return updated;
  });

/* ======================================================
   UPDATE PAYMENT
====================================================== */
export const updatePaiementAction = action
  .input(
    paiementSchema.extend({
      id: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();
    const { id, amount, modePaiement, status } = input;

    const existing = await prisma.familyPayment.findFirst({
      where: { id, branchId },
      include: { frais: true },
    });

    if (!existing) throw new Error("Paiement non trouvé");

    const updated = await prisma.familyPayment.update({
      where: { id },
      data: {
        amount: amount,
        method: modePaiement,
        status: status,
      },
      include: {
        frais: true,
        classEnrollment: {
          include: {
            student: { include: linkedUserInclude },
            schoolYear: true,
          },
        },
      },
    });

    revalidatePaiementPages(organizationId, branchId);
    return {
      ...updated,
      amount: Number(updated.amount),
    };
  });

/* ======================================================
   DELETE (SOFT CANCEL)
====================================================== */
export const deletePaiementAction = action
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();
    const existing = await prisma.familyPayment.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });

    if (!existing) throw new Error("Paiement non trouvÃ©");

    const cancelled = await prisma.familyPayment.update({
      where: { id: input.id },
      data: { status: StatusPaiement.ANNULE },
    });
    revalidatePaiementPages(organizationId, branchId);
    return cancelled;
  });

/* ======================================================
   GET BY STUDENT
====================================================== */
export const getPaiementsByStudentAction = action
  .input(z.object({ studentId: z.string() }))
  .handler(async ({ input }) => {
    const { branchId } = await requireFinanceBranchContext();
    const paiements = await prisma.familyPayment.findMany({
      where: {
        branchId,
        classEnrollment: {
          studentId: input.studentId,
          branchId,
        },
      },
      include: {
        frais: { include: { classe: true, typeFrais: true } },
        classEnrollment: {
          include: {
            student: { include: linkedUserInclude },
            schoolYear: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return paiements.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));
  });

/* ======================================================
   UNPAID FEES
====================================================== */
export const getUnpaidFraisAction = action
  .input(z.object({ studentId: z.string() }))
  .handler(async ({ input }) => {
    const { branchId } = await requireFinanceBranchContext();
    const enrollments = await prisma.classEnrollment.findMany({
      where: { studentId: input.studentId, branchId },
      include: {
        classe: {
          include: { Frais: { where: { branchId } } },
        },
      },
    });

    const result = [];

    for (const enrollment of enrollments) {
      for (const frais of enrollment.classe?.Frais || []) {
        const paid = await prisma.familyPayment.aggregate({
          where: {
            branchId,
            fraisId: frais.id,
            classEnrollmentId: enrollment.id,
            status: StatusPaiement.VALIDE,
          },
          _sum: { amount: true },
        });

        const montantPaye = Number(paid._sum.amount || 0);
        const montantDu = Number(frais.montantFrais);

        if (montantDu - montantPaye > 0) {
          result.push({
            frais,
            classEnrollment: enrollment,
            montantDu,
            montantPaye,
            solde: montantDu - montantPaye,
          });
        }
      }
    }

    return result;
  });

/* ======================================================
   BALANCE
====================================================== */
export const calculateStudentBalanceAction = action
  .input(z.object({ studentId: z.string() }))
  .handler(async ({ input }) => {
    const { branchId } = await requireFinanceBranchContext();
    const enrollments = await prisma.classEnrollment.findMany({
      where: { studentId: input.studentId, branchId },
      include: {
        classe: { include: { Frais: { where: { branchId } } } },
        paiement: {
          where: { branchId, status: StatusPaiement.VALIDE },
        },
      },
    });

    let totalDu = 0;
    let totalPaye = 0;

    for (const e of enrollments) {
      totalDu +=
        e.classe?.Frais?.reduce((sum, f) => sum + Number(f.montantFrais), 0) ||
        0;

      totalPaye += e.paiement.reduce((sum, p) => sum + Number(p.amount), 0);
    }

    return {
      studentId: input.studentId,
      totalDu,
      totalPaye,
      soldeTotal: totalDu - totalPaye,
      estSolde: totalDu - totalPaye <= 0,
    };
  });

/* ======================================================
   RECEIPT
====================================================== */
export const generatePaymentReceiptAction = action
  .input(z.object({ paiementId: z.string() }))
  .handler(async ({ input }) => {
    const { branchId } = await requireFinanceBranchContext();
    const paiement = await prisma.familyPayment.findFirst({
      where: { id: input.paiementId, branchId },
      include: {
        frais: { include: { classe: true, typeFrais: true } },
        classEnrollment: {
          include: {
            student: { include: linkedUserInclude },
            schoolYear: true,
          },
        },
      },
    });

    if (!paiement) throw new Error("Paiement non trouvé");

    const studentUser = getLinkedUser(paiement.classEnrollment?.student);

    return {
      numeroRecu: paiement.id,
      datePaiement: paiement.createdAt,
      etudiant: {
        nom: studentUser?.name,
        prenom: studentUser?.prenom,
        postnom: studentUser?.postnom,
      },
      frais: {
        nom: paiement.frais?.nameFrais,
        type: paiement.frais?.typeFrais?.nameType,
        classe: paiement.frais?.classe?.nameClasse,
      },
      paiement: {
        montant: Number(paiement.amount),
        mode: paiement.method,
        statut: paiement.status,
      },
      anneeScolaire: paiement.classEnrollment?.schoolYear?.nameYear || "",
    };
  });

export type StudentItem = {
  id: string;
  prenom: string;
  nom: string;
  postnom?: string;
  classEnrollId: string;
  classeId: string; // ✅ IMPORTANT
  classeName: string; // ✅ pour affichage
  codeClasse: string;
  schoolYearId: string;
};

export type ParentItem = {
  id: string;
  nom: string;
  prenom: string;
};

export type Family = {
  parent: ParentItem;
  students: StudentItem[];
};

/* ======================================================
   ACTION
====================================================== */

export async function searchFamilyAction(query: string): Promise<Family[]> {
  if (!query || query.length < 2) return [];

  const { branchId } = await requireFinanceBranchContext();

  const matched = await prisma.student.findMany({
    where: {
      branchMember: { branchId },
      OR: [
        {
          branchMember: {
            member: {
              user: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { prenom: { contains: query, mode: "insensitive" } },
                  { postnom: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
        },
        {
          parent: {
            branchMember: {
              branchId,
              member: {
                user: {
                  OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { prenom: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        },
      ],
    },
    select: { parentId: true },
  });

  const parentIds = [...new Set(matched.map((m) => m.parentId))];

  if (!parentIds.length) return [];

  const students = await prisma.student.findMany({
    where: { parentId: { in: parentIds }, branchMember: { branchId } },
    include: {
      ...linkedUserInclude,
      parent: { include: linkedUserInclude },
      classEnrollment: {
        where: { branchId },
        include: { classe: true },
      },
    },
  });

  const map = new Map<string, Family>();

  for (const s of students) {
    if (!s.parent) continue;

    const pid = s.parent.id;
    const parentUser = getLinkedUser(s.parent);
    const studentUser = getLinkedUser(s);

    if (!map.has(pid)) {
      map.set(pid, {
        parent: {
          id: pid,
          nom: parentUser?.name ?? "",
          prenom: parentUser?.prenom ?? "",
        },
        students: [],
      });
    }

    const family = map.get(pid)!;

    for (const e of s.classEnrollment || []) {
      if (family.students.some((x) => x.classEnrollId === e.id)) continue;

      family.students.push({
        id: s.id,
        nom: studentUser?.name ?? "",
        prenom: studentUser?.prenom ?? "",
        postnom: studentUser?.postnom ?? "",
        classEnrollId: e.id,
        classeId: e.classeId,
        classeName: e.classe?.nameClasse ?? "",
        codeClasse: e.classe?.codeClasse ?? "",
        schoolYearId: e.schoolYearId,
      });
    }
  }

  return Array.from(map.values());
}
/** @deprecated Prefer getBestDiscountInfo */
async function getBestDiscount(tx: any, parentId: string, branchId: string) {
  const info = await getBestDiscountInfo(tx, parentId, branchId);
  return info.percentage;
}

/* ======================================================
   UNPAID / FINANCIAL SITUATION REPORT
====================================================== */

/** Aligné sur `calculateStudentBalanceAction` / soldes frais. */
export type UnpaidFinancialStatus = "A_JOUR" | "PARTIEL" | "EN_RETARD";

export type UnpaidReportRow = {
  studentId: string;
  studentName: string;
  classeId: string;
  classeName: string;
  /** Montant dû brut (somme des frais). */
  montantDuBrut: number;
  /** Remise appliquée (scopée au type de frais si défini). */
  remise: number;
  remisePercent: number;
  remiseTypeFraisName: string | null;
  /** Montant dû net après remise. */
  montantDu: number;
  montantPaye: number;
  reste: number;
  status: UnpaidFinancialStatus;
};

function resolveUnpaidFinancialStatus(
  montantDu: number,
  montantPaye: number,
): UnpaidFinancialStatus {
  const due = Math.max(0, montantDu);
  const paid = Math.max(0, montantPaye);
  const reste = due - paid;

  if (due <= 0 || reste <= 0) return "A_JOUR";
  if (paid <= 0) return "EN_RETARD";
  return "PARTIEL";
}

export const getUnpaidReportContextAction = action.handler(async () => {
  const { branchId, organizationId } = await requireFinanceBranchContext();

  const [branch, { rates, baseCurrency, quoteCurrency }] = await Promise.all([
    prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: schoolReportBranchSelect,
    }),
    loadOrgExchangeRates(organizationId),
  ]);

  if (!branch) {
    throw new Error("Contexte introuvable.");
  }

  return buildSchoolReportContext(branch, {
    exchangeRateUsdCdf: resolveUsdCdfRate(rates),
    baseCurrency,
    quoteCurrency: quoteCurrency ?? undefined,
  });
});

export const getUnpaidReportAction = action
  .input(
    z.object({
      classeId: z.string().optional().nullable(),
      schoolYearId: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceBranchContext();

    const classeId = input.classeId?.trim() || null;
    let schoolYearId = input.schoolYearId?.trim() || null;
    let schoolYearLabel: string | null = null;

    if (schoolYearId) {
      const year = await prisma.schoolYear.findFirst({
        where: { id: schoolYearId, branchId },
        select: { id: true, nameYear: true },
      });
      if (!year) {
        throw new Error("Année scolaire introuvable pour cette branche.");
      }
      schoolYearId = year.id;
      schoolYearLabel = year.nameYear;
    } else {
      const currentYear = await getSchoolYearForBranch(branchId);
      if (currentYear) {
        schoolYearId = currentYear.id;
        schoolYearLabel = currentYear.nameYear;
      }
    }

    if (classeId) {
      const classe = await prisma.classe.findFirst({
        where: {
          id: classeId,
          branchId,
          branch: { organizationId },
        },
        select: { id: true },
      });
      if (!classe) {
        throw new Error("Classe introuvable pour cette branche.");
      }
    }

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        branchId,
        ...(schoolYearId ? { schoolYearId } : {}),
        ...(classeId ? { classeId } : {}),
        OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
      },
      include: {
        student: {
          include: linkedUserInclude,
        },
        classe: { select: { id: true, nameClasse: true } },
      },
      orderBy: [{ classe: { nameClasse: "asc" } }, { createdAt: "asc" }],
    });

    const classeIds = Array.from(
      new Set(enrollments.map((e) => e.classeId).filter(Boolean)),
    );

    const fraisList =
      classeIds.length === 0
        ? []
        : await prisma.frais.findMany({
            where: {
              branchId,
              statusFrais: true,
              classeId: { in: classeIds },
              ...(schoolYearId
                ? {
                    OR: [{ schoolYearId }, { schoolYearId: null }],
                  }
                : {}),
            },
            select: {
              id: true,
              classeId: true,
              montantFrais: true,
              typeFraisId: true,
            },
          });

    const fraisByClasse = new Map<
      string,
      Array<{ id: string; montant: number; typeFraisId: string | null }>
    >();
    const fraisIds: string[] = [];
    for (const frais of fraisList) {
      fraisIds.push(frais.id);
      const list = fraisByClasse.get(frais.classeId) ?? [];
      list.push({
        id: frais.id,
        montant: Number(frais.montantFrais),
        typeFraisId: frais.typeFraisId,
      });
      fraisByClasse.set(frais.classeId, list);
    }

    const enrollmentIds = enrollments.map((e) => e.id);
    const paidByEnrollment = new Map<string, number>();

    if (enrollmentIds.length > 0 && fraisIds.length > 0) {
      const aggregates = await prisma.familyPayment.groupBy({
        by: ["classEnrollmentId"],
        where: {
          branchId,
          classEnrollmentId: { in: enrollmentIds },
          fraisId: { in: fraisIds },
          status: StatusPaiement.VALIDE,
        },
        _sum: { amount: true },
      });

      for (const row of aggregates) {
        paidByEnrollment.set(
          row.classEnrollmentId,
          Number(row._sum.amount ?? 0),
        );
      }
    }

    const parentIds = Array.from(
      new Set(
        enrollments
          .map((e) => e.student?.parentId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const discountByParentId = new Map<string, DiscountInfo>();
    await Promise.all(
      parentIds.map(async (parentId) => {
        discountByParentId.set(
          parentId,
          await getBestDiscountInfo(prisma, parentId, branchId),
        );
      }),
    );

    const rows: UnpaidReportRow[] = enrollments.map((enrollment) => {
      const studentUser = getLinkedUser(enrollment.student);
      const studentName =
        [studentUser?.prenom, studentUser?.postnom, studentUser?.name]
          .filter(Boolean)
          .join(" ")
          .trim() || "Élève";

      const classeFrais = fraisByClasse.get(enrollment.classeId) ?? [];
      const montantDuBrut = classeFrais.reduce((sum, f) => sum + f.montant, 0);

      const parentId = enrollment.student?.parentId ?? null;
      const discount = parentId
        ? (discountByParentId.get(parentId) ?? EMPTY_DISCOUNT)
        : EMPTY_DISCOUNT;

      const remise = computeScopedDiscountAmount(
        classeFrais.map((f) => ({
          base: f.montant,
          typeFraisId: f.typeFraisId,
        })),
        discount,
      );

      const montantDu = Math.max(0, montantDuBrut - remise);
      const montantPaye = paidByEnrollment.get(enrollment.id) ?? 0;
      const reste = Math.max(0, montantDu - montantPaye);

      return {
        studentId: enrollment.studentId,
        studentName,
        classeId: enrollment.classeId,
        classeName: enrollment.classe?.nameClasse ?? "-",
        montantDuBrut,
        remise,
        remisePercent: discount.percentage,
        remiseTypeFraisName: discount.typeFraisName,
        montantDu,
        montantPaye,
        reste,
        status: resolveUnpaidFinancialStatus(montantDu, montantPaye),
      };
    });

    rows.sort((a, b) => {
      const byClass = a.classeName.localeCompare(b.classeName, "fr");
      if (byClass !== 0) return byClass;
      return a.studentName.localeCompare(b.studentName, "fr");
    });

    const counts = {
      aJour: rows.filter((r) => r.status === "A_JOUR").length,
      partiel: rows.filter((r) => r.status === "PARTIEL").length,
      enRetard: rows.filter((r) => r.status === "EN_RETARD").length,
    };

    return {
      rows,
      schoolYearId,
      schoolYearLabel,
      classeId,
      counts,
      totalDu: rows.reduce((sum, r) => sum + r.montantDu, 0),
      totalPaye: rows.reduce((sum, r) => sum + r.montantPaye, 0),
      totalReste: rows.reduce((sum, r) => sum + r.reste, 0),
      totalRemise: rows.reduce((sum, r) => sum + r.remise, 0),
    };
  });

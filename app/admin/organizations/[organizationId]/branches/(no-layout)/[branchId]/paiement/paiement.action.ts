"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { action } from "@/lib/zsa";
import z from "zod";
import { paiementSchema, StatusPaiement } from "@/src/interfaces/Paiement";
import {
  requireFinanceBranchContext,
  requireFinanceCollectBranchContext,
  requireFinanceOversightBranchContext,
  requireFinanceReadBranchContext,
} from "@/lib/auth/require-branch-context";
import { resolveCashierSelfScope, isOrganizationOwnerSession } from "@/lib/auth/session-roles";
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
import { notifyParentOfPayment, notifyParentOfPaymentNow } from "@/lib/payments/notify-parent-payment";
import { resolveUserDisplayName } from "@/lib/user-display";
import {
  computeScopedDiscountAmount,
  EMPTY_DISCOUNT,
  getBestDiscountInfo,
  type DiscountInfo,
} from "@/lib/payment-discount";
import {
  resolveOverallReceiptSettlementStatus,
  resolveReceiptSettlementStatus,
} from "@/lib/reports/receipt-settlement";
import { formatReceiptStudentLabel } from "@/components/reports/receipt-format";
import {
  isFraisChargedOnAccount,
  resolveFraisPriority,
} from "@/lib/optional-frais";

async function loadPaidAmountsByEnrollmentAndFrais(
  branchId: string,
  classEnrollmentIds: string[],
  fraisIds: string[],
) {
  if (!classEnrollmentIds.length || !fraisIds.length) {
    return new Map<string, number>();
  }

  const paidGroups = await prisma.familyPayment.groupBy({
    by: ["classEnrollmentId", "fraisId"],
    where: {
      branchId,
      status: StatusPaiement.VALIDE,
      classEnrollmentId: { in: classEnrollmentIds },
      fraisId: { in: fraisIds },
    },
    _sum: { amount: true },
  });

  return new Map(
    paidGroups.map((row) => [
      `${row.classEnrollmentId}:${row.fraisId}`,
      Number(row._sum.amount ?? 0),
    ]),
  );
}

async function loadOrgExchangeRates(organizationId: string): Promise<{
  rates: ExchangeRatePair[];
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode | null;
  selectedRate: number | null;
  showReceiptConversion: boolean;
  notifyParentOnPayment: boolean;
  receiptPrintFormat: "A4" | "POS_80MM";
}> {
  const [rows, org] = await Promise.all([
    prisma.exchangeRate.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ fromCurrency: "asc" }, { toCurrency: "asc" }],
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        showReceiptConversion: true,
        notifyParentOnPayment: true,
        receiptPrintFormat: true,
      },
    }),
  ]);
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
    showReceiptConversion: org?.showReceiptConversion ?? true,
    notifyParentOnPayment: org?.notifyParentOnPayment ?? true,
    receiptPrintFormat: org?.receiptPrintFormat === "POS_80MM" ? "POS_80MM" : "A4",
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
 * Si `createdByUserId` est fourni, limite au caissier concerné.
 */
async function getAutomaticOpeningBalance(
  branchId: string,
  before: Date,
  createdByUserId?: string | null,
) {
  const cashierFilter = createdByUserId
    ? { createdByUserId }
    : {};

  const [incomeBefore, expenseBefore] = await Promise.all([
    prisma.familyPayment.aggregate({
      where: {
        branchId,
        status: StatusPaiement.VALIDE,
        isArchived: false,
        createdAt: { lt: before },
        ...cashierFilter,
      },
      _sum: { amount: true },
    }),
    prisma.cashierExpense.aggregate({
      where: {
        branchId,
        isArchived: false,
        createdAt: { lt: before },
        ...cashierFilter,
      },
      _sum: { amount: true },
    }),
  ]);

  return (
    Number(incomeBefore._sum.amount ?? 0) -
    Number(expenseBefore._sum.amount ?? 0)
  );
}

function shortRefToken(length = 8) {
  return randomUUID().replace(/-/g, "").slice(0, length).toUpperCase();
}

function buildFamilyPaymentRef(baseRef: string, lineIndex: number) {
  return `${baseRef}-${String(lineIndex + 1).padStart(2, "0")}`;
}

function buildUniqueReference(prefix: string) {
  const now = new Date();
  const date = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `${prefix}-${date}-${shortRefToken()}`;
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
    studentName?: string;
    price: number;
    mode: string;
    montant: number;
    receivedAmount?: number;
    classe?: string;
    codeClasse?: string;
    cycle?: string;
    section?: string;
    option?: string;
    tranche?: string;
    settlementStatus?: "SOLDE" | "ACOMPTE" | "COMPLEMENT";
  }[];
  settlementStatus?: "SOLDE" | "ACOMPTE" | "COMPLEMENT";
  logoUrl: string;
  exchangeRateUsdCdf: number;
  issuedPlace?: string;
  receivedCurrency?: "USD" | "CDF" | "AOA";
  baseCurrency?: "USD" | "CDF" | "AOA";
  quoteCurrency?: "USD" | "CDF" | "AOA" | null;
  selectedRate?: number | null;
  /** Si false, le PDF / aperçu n'affiche pas la 2e devise. */
  showConversion?: boolean;
  receiptPrintFormat?: "A4" | "POS_80MM";
};

/* ======================================================
   TYPES SAFE
====================================================== */

export type SelectableFraisItem = {
  fraisId: string;
  classEnrollmentId: string;
  priority: number;
  isOptional: boolean;
  typeFraisId: string | null;
  typeFraisName: string | null;
  nameFrais: string;
  classeId: string;
  montantFrais: number;
  total: number;
  alreadyPaid: number;
  remainingBrut: number;
  remaining: number;
  netRemaining: number;
  isSolded: boolean;
};

export type SelectableFraisAggregate = {
  id: string;
  nameFrais: string;
  montantFrais: number;
  classeId: string;
  typeFraisId: string | null;
  typeFraisName: string | null;
  priority: number;
  isOptional: boolean;
  schoolYearId: string | null;
  resteAffiche: number;
  discountAmount: number;
  dueEnrollmentCount: number;
  selectedEnrollmentCount: number;
  alreadyPaid: number;
  totalDue: number;
};

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

  if (!classEnrollIds.length || !fraisIds.length) {
    return {
      items: [] as Array<{
        fraisId: string;
        classEnrollmentId: string;
        priority: number;
        isOptional: boolean;
        typeFraisId: string | null;
        typeFraisName: string | null;
        total: number;
        alreadyPaid: number;
        remaining: number;
      }>,
      discount: discount.percentage,
      discountTypeFraisId: discount.typeFraisId,
      discountTypeFraisName: discount.typeFraisName,
    };
  }

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      id: { in: classEnrollIds },
      branchId: activeBranchId,
    },
    select: { id: true, classeId: true },
  });

  const fraisList = await prisma.frais.findMany({
    where: { id: { in: fraisIds }, branchId: activeBranchId },
    include: {
      typeFrais: {
        select: { id: true, nameType: true },
      },
    },
  });

  const paidMap = await loadPaidAmountsByEnrollmentAndFrais(
    activeBranchId,
    enrollments.map((e) => e.id),
    fraisList.map((f) => f.id),
  );

  const results = [];

  for (const enrollment of enrollments) {
    for (const frais of fraisList) {
      // Uniquement les frais de la classe de l'inscription
      if (frais.classeId !== enrollment.classeId) continue;

      const alreadyPaid =
        paidMap.get(`${enrollment.id}:${frais.id}`) ?? 0;
      const total = Number(frais.montantFrais);

      results.push({
        fraisId: frais.id,
        classEnrollmentId: enrollment.id,
        priority: resolveFraisPriority(
          Boolean(frais.isOptional),
          frais.priority,
        ),
        isOptional: Boolean(frais.isOptional),
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
   GET SELECTABLE FRAIS FOR ENROLLMENTS
   (non soldés, priorité, remise, épargner soldés du groupe)
====================================================== */

export async function getSelectableFraisForEnrollments(input: {
  classEnrollIds: string[];
  parentId?: string;
  schoolYearId?: string;
}): Promise<{
  frais: SelectableFraisAggregate[];
  items: SelectableFraisItem[];
  discount: number;
  discountTypeFraisId: string | null;
  discountTypeFraisName: string | null;
}> {
  const { classEnrollIds, parentId, schoolYearId } = input;
  const { branchId: activeBranchId } = await requireFinanceBranchContext();

  const discount = parentId
    ? await getBestDiscountInfo(prisma, parentId, activeBranchId)
    : EMPTY_DISCOUNT;

  const empty = {
    frais: [] as SelectableFraisAggregate[],
    items: [] as SelectableFraisItem[],
    discount: discount.percentage,
    discountTypeFraisId: discount.typeFraisId,
    discountTypeFraisName: discount.typeFraisName,
  };

  if (!classEnrollIds.length) return empty;

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      id: { in: Array.from(new Set(classEnrollIds)) },
      branchId: activeBranchId,
    },
    select: { id: true, classeId: true },
  });

  if (!enrollments.length) return empty;

  const classeIds = Array.from(
    new Set(enrollments.map((e) => e.classeId).filter(Boolean)),
  );

  const normalizedYear = schoolYearId?.trim() || "";

  const fraisList = await prisma.frais.findMany({
    where: {
      branchId: activeBranchId,
      statusFrais: true,
      classeId: { in: classeIds },
      ...(normalizedYear ? { schoolYearId: normalizedYear } : {}),
    },
    include: {
      typeFrais: {
        select: { id: true, nameType: true },
      },
    },
    orderBy: [{ priority: "asc" }, { nameFrais: "asc" }],
  });

  if (!fraisList.length) return empty;

  const paidMap = await loadPaidAmountsByEnrollmentAndFrais(
    activeBranchId,
    enrollments.map((e) => e.id),
    fraisList.map((f) => f.id),
  );

  const items: SelectableFraisItem[] = [];

  for (const enrollment of enrollments) {
    for (const frais of fraisList) {
      if (frais.classeId !== enrollment.classeId) continue;

      const total = Number(frais.montantFrais);
      const alreadyPaid =
        paidMap.get(`${enrollment.id}:${frais.id}`) ?? 0;
      const remainingBrut = Math.max(total - alreadyPaid, 0);
      const isSolded = remainingBrut <= 0;

      items.push({
        fraisId: frais.id,
        classEnrollmentId: enrollment.id,
        priority: resolveFraisPriority(
          Boolean(frais.isOptional),
          frais.priority,
        ),
        isOptional: Boolean(frais.isOptional),
        typeFraisId: frais.typeFraisId,
        typeFraisName: frais.typeFrais?.nameType ?? null,
        nameFrais: frais.nameFrais,
        classeId: frais.classeId,
        montantFrais: total,
        total,
        alreadyPaid,
        remainingBrut,
        remaining: remainingBrut,
        netRemaining: remainingBrut,
        isSolded,
      });
    }
  }

  const byFraisId = new Map<string, SelectableFraisItem[]>();
  for (const item of items) {
    const list = byFraisId.get(item.fraisId) ?? [];
    list.push(item);
    byFraisId.set(item.fraisId, list);
  }

  const frais: SelectableFraisAggregate[] = [];

  for (const fraisDef of fraisList) {
    const lines = byFraisId.get(fraisDef.id) ?? [];
    if (!lines.length) continue;

    // Épargner les élèves déjà soldés : seules les lignes actives comptent
    const activeLines = lines.filter((line) => line.remainingBrut > 0);
    const discountAmount = computeScopedDiscountAmount(
      activeLines.map((line) => ({
        base: line.total,
        typeFraisId: line.typeFraisId,
      })),
      discount,
    );
    const remainingBrutSum = activeLines.reduce(
      (sum, line) => sum + line.remainingBrut,
      0,
    );
    const resteAffiche = Math.max(remainingBrutSum - discountAmount, 0);

    // Soldé pour tous (après remise) → ne pas proposer
    if (resteAffiche <= 0) continue;

    // Répartir la remise sur les lignes actives pour netRemaining
    if (discountAmount > 0 && remainingBrutSum > 0) {
      let allocated = 0;
      activeLines.forEach((line, index) => {
        const share =
          index === activeLines.length - 1
            ? discountAmount - allocated
            : Math.floor(
                (line.remainingBrut / remainingBrutSum) * discountAmount,
              );
        allocated += share;
        line.netRemaining = Math.max(line.remainingBrut - share, 0);
      });
    }

    frais.push({
      id: fraisDef.id,
      nameFrais: fraisDef.nameFrais,
      montantFrais: Number(fraisDef.montantFrais),
      classeId: fraisDef.classeId,
      typeFraisId: fraisDef.typeFraisId,
      typeFraisName: fraisDef.typeFrais?.nameType ?? null,
      priority: resolveFraisPriority(
        Boolean(fraisDef.isOptional),
        fraisDef.priority,
      ),
      isOptional: Boolean(fraisDef.isOptional),
      schoolYearId: fraisDef.schoolYearId ?? null,
      resteAffiche,
      discountAmount,
      dueEnrollmentCount: activeLines.length,
      selectedEnrollmentCount: lines.length,
      alreadyPaid: lines.reduce((sum, line) => sum + line.alreadyPaid, 0),
      totalDue: lines.reduce((sum, line) => sum + line.total, 0),
    });
  }

  frais.sort(
    (a, b) =>
      Number(a.isOptional) - Number(b.isOptional) ||
      a.priority - b.priority ||
      a.nameFrais.localeCompare(b.nameFrais, "fr"),
  );

  return {
    frais,
    items,
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

    const { branchId, organizationId, userId } =
      await requireFinanceCollectBranchContext();
    const {
      rates: exchangeRates,
      baseCurrency,
      quoteCurrency,
      selectedRate,
      showReceiptConversion,
      receiptPrintFormat,
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

      // Aligné sur getBestDiscountInfo (GROUP = tous les enfants du parent)
      const discountInfo = await getBestDiscountInfo(tx, parentId, branchId);
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

      // Épargner les élèves déjà soldés pour un frais (remaining <= 0)
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
            createdByUserId: userId,
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
                  classe: {
                    include: {
                      option: { include: { section: true } },
                    },
                  },
                  schoolYear: true,
                  semester: true,
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
                  classe: {
                    include: {
                      option: { include: { section: true } },
                    },
                  },
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
        showConversion: showReceiptConversion,
        receiptPrintFormat,
      });

      const receiptCurrency =
        (receiptPayments[0]?.receivedCurrency as
          | "USD"
          | "CDF"
          | "AOA"
          | undefined) ?? baseCurrency;

      const receiptItems = receiptPayments.map((payment) => {
        const balance = balances.find(
          (item) =>
            item.fraisId === payment.fraisId &&
            item.classEnrollmentId === payment.classEnrollmentId,
        );
        const remainingBefore = Math.max(Number(balance?.remaining ?? payment.amount), 0);
        const alreadyPaidBefore = Math.max(Number(balance?.alreadyPaid ?? 0), 0);
        const settlementStatus = resolveReceiptSettlementStatus({
          remainingBefore,
          paidThisTime: Number(payment.amount),
          alreadyPaidBefore,
        });

        const studentUser = getLinkedUser(payment.classEnrollment?.student);

        return {
          description: payment.frais?.nameFrais ?? "Frais scolaire",
          studentName: formatReceiptStudentLabel(studentUser),
          price: Number(payment.frais?.montantFrais ?? payment.amount),
          mode: payment.method ?? "ESPECES",
          montant: Number(payment.amount),
          receivedAmount:
            payment.receivedAmount != null
              ? Number(payment.receivedAmount)
              : Number(payment.amount),
          classe:
            payment.classEnrollment?.classe?.codeClasse ??
            payment.frais?.classe?.codeClasse ??
            "",
          codeClasse:
            payment.classEnrollment?.classe?.codeClasse ??
            payment.frais?.classe?.codeClasse ??
            "",
          settlementStatus,
        };
      });

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
        items: receiptItems,
        settlementStatus: resolveOverallReceiptSettlementStatus(receiptItems),
        logoUrl: branding.logoUrl,
        exchangeRateUsdCdf:
          branding.exchangeRateUsdCdf ?? usdCdfRate,
        issuedPlace: branding.city,
        receivedCurrency: receiptCurrency,
        baseCurrency,
        quoteCurrency: showReceiptConversion ? quoteCurrency : undefined,
        selectedRate,
        showConversion: showReceiptConversion,
        receiptPrintFormat,
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
        createdPaymentIds,
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
      notifyParentOfPayment({
        organizationId,
        branchId,
        kind: "created",
        paymentIds: result.createdPaymentIds ?? [],
        currency: baseCurrency,
      });
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
    const { branchId, organizationId, userId } =
      await requireFinanceCollectBranchContext();

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
          createdByUserId: userId,
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
    const { branchId, userId, session } = await requireFinanceReadBranchContext();
    const cashierScope = resolveCashierSelfScope(session, userId);
    
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
      isArchived: false,
      ...(cashierScope ? { createdByUserId: cashierScope } : {}),
    };

    if (input.modePaiement) paymentWhere.method = input.modePaiement;
    if (input.fraisId) paymentWhere.fraisId = input.fraisId;
    if (input.classeId) paymentWhere.classEnrollment = { classeId: input.classeId };

    const payments = await prisma.familyPayment.findMany({
      where: paymentWhere,
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            prenom: true,
            email: true,
            username: true,
          },
        },
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
          where: {
            branchId,
            isArchived: false,
            createdAt: { gte: start, lte: end },
            ...(cashierScope ? { createdByUserId: cashierScope } : {}),
          },
          orderBy: { createdAt: "desc" },
        });

    const openingBalance = await getAutomaticOpeningBalance(
      branchId,
      start,
      cashierScope,
    );
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
      openingLabel: cashierScope
        ? `Votre solde net du ${previousDay.toLocaleDateString("fr-FR")}`
        : `Solde net du ${previousDay.toLocaleDateString("fr-FR")}`,
      openingNote: null,
      scopedToSelf: Boolean(cashierScope),
      incomeTotal,
      outflowTotal,
      periodBalance: incomeTotal - outflowTotal,
      balance: openingBalance + incomeTotal - outflowTotal,
      byCycle: (() => {
        const map = new Map<string, number>();
        for (const payment of payments) {
          const cycle =
            payment.classEnrollment?.classe?.cycle ??
            payment.frais?.classe?.cycle ??
            "AUTRE";
          map.set(cycle, (map.get(cycle) ?? 0) + Number(payment.amount));
        }
        return Array.from(map.entries()).map(([cycle, amount]) => ({
          cycle,
          amount,
        }));
      })(),
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        method: payment.method,
        transactionRef: payment.transactionRef,
        notes: payment.notes,
        createdAt: payment.createdAt.toISOString(),
        createdByUserId: payment.createdByUserId ?? null,
        cashierName: payment.createdByUser
          ? resolveUserDisplayName(payment.createdByUser)
          : "",
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
  const { branchId, organizationId } = await requireFinanceReadBranchContext();

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
  const { branchId, organizationId } = await requireFinanceReadBranchContext();

  const [branch, { rates, baseCurrency, quoteCurrency, selectedRate, showReceiptConversion, receiptPrintFormat }] =
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
      showConversion: showReceiptConversion,
      receiptPrintFormat,
    }),
    selectedRate,
    showConversion: showReceiptConversion,
    receiptPrintFormat,
  };
});

/* ======================================================
   GET ALL PAYMENTS
====================================================== */
export const getAllPaiementAction = action.handler(async () => {
  const { branchId, userId, session } = await requireFinanceBranchContext();
  const cashierScope = resolveCashierSelfScope(session, userId);
  const paiements = await prisma.familyPayment.findMany({
    where: {
      branchId,
      ...(cashierScope ? { createdByUserId: cashierScope } : {}),
    },
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

  const settlementById = new Map<string, "SOLDE" | "ACOMPTE" | "COMPLEMENT">();
  const paidBeforeByKey = new Map<string, number>();
  const chronological = [...paiements].sort((a, b) => {
    const byDate = a.createdAt.getTime() - b.createdAt.getTime();
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });

  for (const payment of chronological) {
    if (payment.status !== StatusPaiement.VALIDE) continue;
    const key = `${payment.classEnrollmentId ?? ""}:${payment.fraisId ?? ""}`;
    const alreadyPaidBefore = paidBeforeByKey.get(key) ?? 0;
    const due = Number(payment.frais?.montantFrais ?? payment.amount);
    const remainingBefore = Math.max(due - alreadyPaidBefore, 0);
    const amount = Number(payment.amount);
    settlementById.set(
      payment.id,
      resolveReceiptSettlementStatus({
        remainingBefore,
        paidThisTime: amount,
        alreadyPaidBefore,
      }),
    );
    paidBeforeByKey.set(key, alreadyPaidBefore + amount);
  }

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
    settlementStatus: settlementById.get(p.id) ?? null,

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
    const { branchId, organizationId } = await requireFinanceCollectBranchContext();
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
    const { branchId, organizationId } = await requireFinanceCollectBranchContext();
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
    notifyParentOfPayment({
      organizationId,
      branchId,
      kind: "updated",
      paymentIds: [id],
    });
    return {
      ...updated,
      amount: Number(updated.amount),
    };
  });

/* ======================================================
   DELETE (erreur de saisie)
====================================================== */
export const deletePaiementAction = action
  .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }))
  .handler(async ({ input }) => {
    const { branchId, organizationId, userId, session } =
      await requireFinanceBranchContext();
    if (!isOrganizationOwnerSession(session)) {
      throw new Error(
        "Seul le propriétaire peut supprimer un paiement.",
      );
    }
    const cashierScope = resolveCashierSelfScope(session, userId);
    const uniqueIds = Array.from(new Set(input.ids));

    const existing = await prisma.familyPayment.findMany({
      where: {
        id: { in: uniqueIds },
        branchId,
        ...(cashierScope ? { createdByUserId: cashierScope } : {}),
      },
      select: { id: true, batchId: true },
    });

    if (existing.length === 0) {
      throw new Error("Paiement introuvable");
    }
    if (existing.length !== uniqueIds.length) {
      throw new Error("Certains paiements n'ont pas pu être supprimés");
    }

    const paymentIds = existing.map((p) => p.id);
    const batchIds = Array.from(
      new Set(
        existing
          .map((p) => p.batchId)
          .filter((id): id is number => id != null),
      ),
    );

    await notifyParentOfPaymentNow({
      organizationId,
      branchId,
      kind: "deleted",
      paymentIds,
    });

    await prisma.$transaction(async (tx) => {
      await tx.paymentAllocation.deleteMany({
        where: { familyPaymentId: { in: paymentIds }, branchId },
      });
      await tx.paymentEvent.deleteMany({
        where: { paymentId: { in: paymentIds }, branchId },
      });
      await tx.mobileMoneyTransaction.deleteMany({
        where: { paymentId: { in: paymentIds }, branchId },
      });
      await tx.familyPayment.deleteMany({
        where: { id: { in: paymentIds }, branchId },
      });

      if (batchIds.length === 0) return;

      const remaining = await tx.familyPayment.findMany({
        where: { batchId: { in: batchIds }, branchId },
        select: { batchId: true },
      });
      const remainingBatchIds = new Set(
        remaining
          .map((row) => row.batchId)
          .filter((id): id is number => id != null),
      );
      const emptyBatchIds = batchIds.filter((id) => !remainingBatchIds.has(id));
      if (emptyBatchIds.length) {
        await tx.paymentBatch.deleteMany({
          where: { id: { in: emptyBatchIds }, branchId },
        });
      }
    });

    revalidatePaiementPages(organizationId, branchId);
    return { deleted: paymentIds.length };
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

    const fraisRows = enrollments.flatMap(
      (enrollment) => enrollment.classe?.Frais ?? [],
    );
    const paidMap = await loadPaidAmountsByEnrollmentAndFrais(
      branchId,
      enrollments.map((e) => e.id),
      fraisRows.map((f) => f.id),
    );

    const result = [];

    for (const enrollment of enrollments) {
      for (const frais of enrollment.classe?.Frais || []) {
        const montantPaye =
          paidMap.get(`${enrollment.id}:${frais.id}`) ?? 0;
        if (
          !isFraisChargedOnAccount(Boolean(frais.isOptional), montantPaye)
        ) {
          continue;
        }
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
      const paidByFrais = new Map<string, number>();
      for (const payment of e.paiement) {
        paidByFrais.set(
          payment.fraisId,
          (paidByFrais.get(payment.fraisId) ?? 0) + Number(payment.amount),
        );
      }

      for (const frais of e.classe?.Frais ?? []) {
        const paid = paidByFrais.get(frais.id) ?? 0;
        if (!isFraisChargedOnAccount(Boolean(frais.isOptional), paid)) {
          continue;
        }
        totalDu += Number(frais.montantFrais);
        totalPaye += paid;
      }
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
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  if (!tokens.length) return [];

  const { branchId } = await requireFinanceBranchContext();

  const tokenClause = (token: string) => ({
    OR: [
      {
        branchMember: {
          member: {
            user: {
              OR: [
                { name: { contains: token, mode: "insensitive" as const } },
                { prenom: { contains: token, mode: "insensitive" as const } },
                { postnom: { contains: token, mode: "insensitive" as const } },
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
                  { name: { contains: token, mode: "insensitive" as const } },
                  { prenom: { contains: token, mode: "insensitive" as const } },
                ],
              },
            },
          },
        },
      },
    ],
  });

  const matched = await prisma.student.findMany({
    where: {
      branchMember: { branchId },
      AND: tokens.map(tokenClause),
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
  cycle: string | null;
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
  const { branchId, organizationId } = await requireFinanceOversightBranchContext();

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
      cycle: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId, organizationId } = await requireFinanceOversightBranchContext();

    const classeId = input.classeId?.trim() || null;
    const cycleFilter = input.cycle?.trim() || null;
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
        ...(cycleFilter ? { classe: { cycle: cycleFilter as never } } : {}),
        OR: [{ statusEnrollment: true }, { statusEnrollment: null }],
      },
      include: {
        student: {
          include: linkedUserInclude,
        },
        classe: { select: { id: true, nameClasse: true, cycle: true } },
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
              isOptional: true,
            },
          });

    const fraisByClasse = new Map<
      string,
      Array<{
        id: string;
        montant: number;
        typeFraisId: string | null;
        isOptional: boolean;
      }>
    >();
    const fraisIds: string[] = [];
    for (const frais of fraisList) {
      fraisIds.push(frais.id);
      const list = fraisByClasse.get(frais.classeId) ?? [];
      list.push({
        id: frais.id,
        montant: Number(frais.montantFrais),
        typeFraisId: frais.typeFraisId,
        isOptional: Boolean(frais.isOptional),
      });
      fraisByClasse.set(frais.classeId, list);
    }

    const enrollmentIds = enrollments.map((e) => e.id);
    const paidByEnrollmentFrais = new Map<string, number>();

    if (enrollmentIds.length > 0 && fraisIds.length > 0) {
      const aggregates = await prisma.familyPayment.groupBy({
        by: ["classEnrollmentId", "fraisId"],
        where: {
          branchId,
          classEnrollmentId: { in: enrollmentIds },
          fraisId: { in: fraisIds },
          status: StatusPaiement.VALIDE,
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

      const classeFrais = (fraisByClasse.get(enrollment.classeId) ?? []).filter(
        (f) =>
          isFraisChargedOnAccount(
            f.isOptional,
            paidByEnrollmentFrais.get(`${enrollment.id}:${f.id}`) ?? 0,
          ),
      );
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
      const montantPaye = classeFrais.reduce(
        (sum, f) =>
          sum +
          (paidByEnrollmentFrais.get(`${enrollment.id}:${f.id}`) ?? 0),
        0,
      );
      const reste = Math.max(0, montantDu - montantPaye);

      return {
        studentId: enrollment.studentId,
        studentName,
        classeId: enrollment.classeId,
        classeName: enrollment.classe?.nameClasse ?? "-",
        cycle: enrollment.classe?.cycle ?? null,
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
      const byCycle = (a.cycle ?? "").localeCompare(b.cycle ?? "", "fr");
      if (byCycle !== 0) return byCycle;
      const byClass = a.classeName.localeCompare(b.classeName, "fr");
      if (byClass !== 0) return byClass;
      return a.studentName.localeCompare(b.studentName, "fr");
    });

    const byCycleMap = new Map<
      string,
      { cycle: string; totalDu: number; totalPaye: number; totalReste: number }
    >();
    for (const row of rows) {
      const key = row.cycle ?? "AUTRE";
      const current = byCycleMap.get(key) ?? {
        cycle: key,
        totalDu: 0,
        totalPaye: 0,
        totalReste: 0,
      };
      current.totalDu += row.montantDu;
      current.totalPaye += row.montantPaye;
      current.totalReste += row.reste;
      byCycleMap.set(key, current);
    }

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
      byCycle: Array.from(byCycleMap.values()),
    };
  });

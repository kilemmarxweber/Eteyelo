"use server";
import { prisma } from "@/lib/prisma";
import { action } from "@/lib/zsa";
import z from "zod";
import { paiementSchema, StatusPaiement } from "@/src/interfaces/Paiement";
import { requireBranchContext } from "@/lib/auth/require-branch-context";

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

type ReceiptPayload = {
  invoiceNumber: string;
  sender: {
    name: string;
    address: string;
  };
  recipient: {
    name: string;
    class: string;
    sexe: string;
  };
  items: {
    description: string;
    price: number;
    statut: string;
    montant: number;
  }[];
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
  branchId?: string,
) {
  const context = branchId ? { branchId } : await requireBranchContext();
  const activeBranchId = context.branchId;
  const discount = parentId
    ? await getBestDiscount(prisma, parentId, activeBranchId)
    : 0;

  const fraisList = await prisma.frais.findMany({
    where: { id: { in: fraisIds }, branchId: activeBranchId },
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
        total,
        alreadyPaid,
        remaining: total - alreadyPaid, // ⚠️ ne PAS clamp ici
      });
    }
  }

  return {
    items: results,
    discount,
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
    } = input;

    if (!classEnrollIds.length) throw new Error("❌ Aucun élève sélectionné");
    if (!fraisIds.length) throw new Error("❌ Aucun frais sélectionné");
    if (amount === 0 || amount === undefined || amount === null) {
      throw new Error("❌ Montant invalide");
    }

    const { branchId } = await requireBranchContext();

    return prisma.$transaction(async (tx) => {
      /* ======================================================
         REFERENCE WITH RETRY (Handle Race Condition)
         Use random component to break collisions from simultaneous requests
      ====================================================== */
      let transaction: any = null;
      let reference: string = "";
      let lastError: Error | null = null;

      for (let retryCount = 0; retryCount < 10; retryCount++) {
        try {
          const now = new Date();
          const year = now.getFullYear().toString().slice(-2);
          const day = now.getDate().toString().padStart(2, "0");

          const startDay = new Date(now);
          startDay.setHours(0, 0, 0, 0);

          const countToday = await tx.transaction.count({
            where: { branchId, createdAt: { gte: startDay } },
          });

          // Add random component (00-99) to break race condition collisions
          const randomPart = Math.floor(Math.random() * 100)
            .toString()
            .padStart(2, "0");
          const sequencePart = String(countToday + 1 + retryCount).padStart(
            3,
            "0",
          );
          reference = `TRNS-${year}-${day}-${sequencePart}-${randomPart}`;

          transaction = await tx.transaction.create({
            data: { reference, branchId },
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          // Check if it's a unique constraint error on reference field
          if (
            error.code === "P2002" &&
            error.meta?.target?.includes("reference")
          ) {
            // Race condition: retry with incremented suffix + new random
            if (retryCount < 9) continue;
          }
          // For other errors or max retries exceeded, throw
          throw error;
        }
      }

      if (!transaction) {
        throw lastError || new Error("❌ Impossible de créer la transaction");
      }

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

      const studentCount = classEnrollIds.length;

      const hasOrphan = parent.students.some(
        (s: any) => s.category === "ORPHAN",
      );

      const parentRule = await tx.discountRule.findFirst({
        where: { branchId, scope: "PARENT", parentId },
      });

      const groupRule = await tx.discountRule.findFirst({
        where: {
          branchId,
          scope: "GROUP",
          minChildren: { lte: studentCount },
        },
        orderBy: { minChildren: "desc" },
      });

      const orphanRule = hasOrphan
        ? await tx.discountRule.findFirst({
            where: { branchId, scope: "ORPHAN" },
          })
        : null;

      const discountPercent = Math.max(
        parentRule?.percentage ?? 0,
        groupRule?.percentage ?? 0,
        orphanRule?.percentage ?? 0,
      );

      /* ======================================================
         BALANCES
      ====================================================== */
      const { items: balances } = await getFraisWithBalance(
        classEnrollIds,
        fraisIds,
        parentId,
        branchId,
      );

      type FlatItem = {
        studentId: string;
        fraisId: string;
        priority: number;
        remaining: number;
      };

      const flatItems: FlatItem[] = balances
        .map((b) => ({
          studentId: b.classEnrollmentId,
          fraisId: b.fraisId,
          priority: b.priority,
          remaining: Math.max(b.remaining, 0),
        }))
        .filter((b) => b.remaining > 0);

      /* ======================================================
         🔥 GLOBAL DISCOUNT CALCULATION
      ====================================================== */
      const totalGlobal = flatItems.reduce(
        (sum, item) => sum + item.remaining,
        0,
      );

      const discountAmount = (totalGlobal * discountPercent) / 100;

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
      const results: any[] = [];

      for (const priority of sortedPriorities) {
        if (globalBudget <= 0) break;

        const items = priorityMap.get(priority)!;

        const totalNeeded = items.reduce((s, i) => s + i.remaining, 0);

        /* ===============================
           FULL PAYMENT FOR LEVEL
        =============================== */
        if (globalBudget >= totalNeeded) {
          for (const item of items) {
            const payment = await tx.familyPayment.create({
              data: {
                amount: item.remaining,
                method: modePaiement,
                status,
                parentId,
                fraisId: item.fraisId,
                classEnrollmentId: item.studentId,
                transactionRef: reference,
                notes,
                branchId,
              },
            });

            results.push(payment);
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

          const payment = await tx.familyPayment.create({
            data: {
              amount: t.share,
              method: modePaiement,
              status,
              parentId,
              fraisId: t.item.fraisId,
              classEnrollmentId: t.item.studentId,
              transactionRef: reference,
              notes,
              branchId,
            },
          });

          results.push(payment);
        }

        globalBudget = 0;
        break;
      }

      /* ======================================================
         BATCH
      ====================================================== */
      let batch = null;

      if (classEnrollIds.length > 1) {
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
                    include: linkedUserInclude,
                  },
                  classe: true,
                  schoolYear: true,
                },
              },
            },
          })
        : [];

      const studentNames = Array.from(
        new Set(
          receiptPayments
            .map((payment) => {
              const user = getLinkedUser(payment.classEnrollment?.student);
              return [user?.prenom, user?.name, user?.postnom]
                .filter(Boolean)
                .join(" ")
                .trim();
            })
            .filter(Boolean),
        ),
      );

      const classNames = Array.from(
        new Set(
          receiptPayments
            .map(
              (payment) =>
                payment.classEnrollment?.classe?.nameClasse ??
                payment.frais?.classe?.nameClasse ??
                "",
            )
            .filter(Boolean),
        ),
      );

      const sexes = Array.from(
        new Set(
          receiptPayments
            .map((payment) => {
              const user = getLinkedUser(payment.classEnrollment?.student);
              return user?.sexe ?? "";
            })
            .filter(Boolean),
        ),
      );

      const receipt: ReceiptPayload = {
        invoiceNumber: reference,
        sender: {
          name: "COMPLEXE SCOLAIRE MARGUERITE M",
          address: "Kinshasa",
        },
        recipient: {
          name: studentNames.join(", ") || "Eleve",
          class: classNames.join(", ") || "-",
          sexe: sexes.join(", ") || "-",
        },
        items: receiptPayments.map((payment) => ({
          description: payment.frais?.nameFrais ?? "Frais scolaire",
          price: Number(payment.frais?.montantFrais ?? payment.amount),
          statut: payment.status,
          montant: Number(payment.amount),
        })),
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
    });
  });

const getDayRange = (date?: Date) => {
  const start = date ? new Date(date) : new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return { start, end };
};

const buildReference = async (tx: any, prefix: string, branchId: string) => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const day = now.getDate().toString().padStart(2, "0");
  const startDay = new Date(now);
  startDay.setHours(0, 0, 0, 0);

  const countToday = await tx.transaction.count({
    where: { branchId, createdAt: { gte: startDay } },
  });

  return `${prefix}-${year}-${day}-${String(countToday + 1).padStart(3, "0")}`;
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
    const { branchId } = await requireBranchContext();

    return prisma.$transaction(async (tx) => {
      const reference = await buildReference(tx, "EXP", branchId);

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
  });

export const getCashierReportAction = action
  .input(
    z.object({
      startDate: z.coerce.date().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
    const { start, end } = getDayRange(input.startDate);

    const payments = await prisma.familyPayment.findMany({
      where: {
        branchId,
        createdAt: { gte: start, lt: end },
        status: StatusPaiement.VALIDE,
      },
      include: {
        frais: true,
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

    const expenses = await prisma.cashierExpense.findMany({
      where: { branchId, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
    });

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
      incomeTotal,
      outflowTotal,
      balance: incomeTotal - outflowTotal,
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
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

/* ======================================================
   GET ALL PAYMENTS
====================================================== */
export const getAllPaiementAction = action.handler(async () => {
  const { branchId } = await requireBranchContext();
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
          nameClasse: p.classEnrollment.classe?.nameClasse ?? "",
          nameYear: p.classEnrollment.schoolYear?.nameYear ?? "",
          // ✅ PARENT
          parentId: p.classEnrollment.student?.parent?.id ?? "",
          parentNom: getLinkedUser(p.classEnrollment.student?.parent)?.name ?? "",
          parentPrenom:
            getLinkedUser(p.classEnrollment.student?.parent)?.prenom ?? "",
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
    const { branchId } = await requireBranchContext();
    const existing = await prisma.familyPayment.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });

    if (!existing) throw new Error("Paiement non trouvÃ©");

    return prisma.familyPayment.update({
      where: { id: input.id },
      data: { status: input.statusPaiement },
    });
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
    const { branchId } = await requireBranchContext();
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
    const { branchId } = await requireBranchContext();
    const existing = await prisma.familyPayment.findFirst({
      where: { id: input.id, branchId },
      select: { id: true },
    });

    if (!existing) throw new Error("Paiement non trouvÃ©");

    return prisma.familyPayment.update({
      where: { id: input.id },
      data: { status: StatusPaiement.ANNULE },
    });
  });

/* ======================================================
   GET BY STUDENT
====================================================== */
export const getPaiementsByStudentAction = action
  .input(z.object({ studentId: z.string() }))
  .handler(async ({ input }) => {
    const { branchId } = await requireBranchContext();
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
    const { branchId } = await requireBranchContext();
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
    const { branchId } = await requireBranchContext();
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
    const { branchId } = await requireBranchContext();
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

  const { branchId } = await requireBranchContext();

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
type StudentWithCategory = {
  category: string | null;
};

async function getBestDiscount(tx: any, parentId: string, branchId: string) {
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

  if (!parent) return 0;

  const studentCount = parent.students.length;

  // 🔥 RULE 1: Parent-specific rule
  const parentRule = await tx.discountRule.findFirst({
    where: {
      branchId,
      scope: "PARENT",
      parentId,
    },
  });

  // 🔥 RULE 2: Group rule (based on number of children)
  const groupRule = await tx.discountRule.findFirst({
    where: {
      branchId,
      scope: "GROUP",
      minChildren: {
        lte: studentCount,
      },
    },
    orderBy: {
      minChildren: "desc", // prend la règle la plus haute applicable
    },
  });

  // 🔥 CHECK IF ANY STUDENT IS ORPHAN
  const hasOrphan = parent.students.some(
    (student: any) => student.category === "ORPHAN",
  );

  // 🔥 RULE 3: Orphan rule (ONLY if applicable)
  let categoryRule = null;

  if (hasOrphan) {
    categoryRule = await tx.discountRule.findFirst({
      where: {
        branchId,
        scope: "ORPHAN",
      },
    });
  }

  // // 📊 DEBUG
  // console.log("📊 DISCOUNT RULE DEBUG");
  // console.log("studentCount:", studentCount);
  // console.log("hasOrphan:", hasOrphan);
  // console.log("parentRule:", parentRule);
  // console.log("groupRule:", groupRule);
  // console.log("categoryRule:", categoryRule);

  // 🔥 FINAL CALCULATION (safe fallback)
  return Math.max(
    parentRule?.percentage ?? 0,
    groupRule?.percentage ?? 0,
    categoryRule?.percentage ?? 0,
  );
}

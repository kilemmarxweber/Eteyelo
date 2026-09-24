import {
  isAtelierBranch,
  usesPaymentDiscountsForBranch,
} from "@/lib/branch-capabilities";

export type DiscountInfo = {
  percentage: number;
  typeFraisId: string | null;
  typeFraisName: string | null;
};

export const EMPTY_DISCOUNT: DiscountInfo = {
  percentage: 0,
  typeFraisId: null,
  typeFraisName: null,
};

/** Élèves natifs, importés (lien) ou inscrits dans la branche (ex. atelier). */
export function studentAccessibleInBranchWhere(branchId: string) {
  return {
    OR: [
      { branchMember: { branchId } },
      {
        branchLinks: {
          some: { targetBranchId: branchId, isActive: true },
        },
      },
      {
        classEnrollment: {
          some: { branchId, statusEnrollment: true },
        },
      },
    ],
  };
}

/** Parent membre de la branche, ou parent d'un élève accessible dans la branche. */
export function parentAccessibleInBranchWhere(
  parentId: string,
  branchId: string,
) {
  return {
    id: parentId,
    OR: [
      { branchMember: { branchId } },
      {
        students: {
          some: studentAccessibleInBranchWhere(branchId),
        },
      },
    ],
  };
}

/**
 * Remise % sur le montant brut des frais éligibles (pas sur le reste à payer).
 * Sinon, après un paiement partiel, 10 % de 50 000 devient 500 au lieu de 5 000.
 *
 * Safe côté client (pas d'import Prisma / Node).
 */
export function computeScopedDiscountAmount(
  items: Array<{ base: number; typeFraisId?: string | null }>,
  discount: DiscountInfo,
) {
  const percentage = Math.max(0, Number(discount.percentage) || 0);
  if (percentage <= 0) return 0;

  const eligibleBase = items.reduce((sum, item) => {
    const base = Math.max(Number(item.base) || 0, 0);
    if (!base) return sum;
    if (discount.typeFraisId) {
      return item.typeFraisId === discount.typeFraisId ? sum + base : sum;
    }
    return sum + base;
  }, 0);

  return (eligibleBase * percentage) / 100;
}

/**
 * Résolution serveur des remises. Passer `prisma` ou un client de transaction
 * qui expose `branch.findFirst` (pas d'import Prisma ici — bundle client safe).
 */
export async function getBestDiscountInfo(
  tx: {
    parent: { findFirst: (args?: any) => Promise<any> };
    discountRule: {
      findFirst: (args?: any) => Promise<any>;
    };
    branch: { findFirst: (args?: any) => Promise<any> };
  },
  parentId: string,
  branchId: string,
): Promise<DiscountInfo> {
  const branch = await tx.branch.findFirst({
    where: { id: branchId },
    select: { typebranch: true },
  });

  // Atelier : aucun mélange avec les remises scolaires ; frais isolés, 0 remise.
  if (
    !branch ||
    isAtelierBranch(branch.typebranch) ||
    !usesPaymentDiscountsForBranch(branch.typebranch)
  ) {
    return EMPTY_DISCOUNT;
  }

  const parent = await tx.parent.findFirst({
    where: parentAccessibleInBranchWhere(parentId, branchId),
    include: {
      students: {
        where: studentAccessibleInBranchWhere(branchId),
      },
    },
  });

  if (!parent) return EMPTY_DISCOUNT;

  const studentCount = parent.students.length;

  const parentRule = await tx.discountRule.findFirst({
    where: {
      branchId,
      scope: "PARENT",
      parentId,
    },
    include: { typeFrais: { select: { id: true, nameType: true } } },
  });

  const groupRule = await tx.discountRule.findFirst({
    where: {
      branchId,
      scope: "GROUP",
      minChildren: {
        lte: studentCount,
      },
    },
    include: { typeFrais: { select: { id: true, nameType: true } } },
    orderBy: {
      minChildren: "desc",
    },
  });

  const hasOrphan = parent.students.some(
    (student: { category: string | null }) => student.category === "ORPHAN",
  );

  let categoryRule = null;

  if (hasOrphan) {
    categoryRule = await tx.discountRule.findFirst({
      where: {
        branchId,
        scope: "ORPHAN",
      },
      include: { typeFrais: { select: { id: true, nameType: true } } },
    });
  }

  const candidates = [parentRule, groupRule, categoryRule].filter(
    (rule): rule is NonNullable<typeof parentRule> =>
      Boolean(rule && (rule.percentage ?? 0) > 0),
  );

  if (candidates.length === 0) return EMPTY_DISCOUNT;

  const best = candidates.reduce((current, rule) =>
    rule.percentage > current.percentage ? rule : current,
  );

  return {
    percentage: best.percentage,
    typeFraisId: best.typeFraisId ?? null,
    typeFraisName: best.typeFrais?.nameType ?? null,
  };
}

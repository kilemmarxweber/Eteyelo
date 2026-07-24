import { prisma } from "@/lib/prisma";
import { SATISFACTION_POSITIVE_MIN } from "./definitions";
import { buildBranchIdFilter, pct, type BranchScopeInput } from "./scope";

export type SatisfactionReport = {
  averageRating: number;
  totalFeedbacks: number;
  positiveRate: number;
  responseRate: number;
  parentsCount: number;
  byRating: Array<{ name: string; value: number }>;
  byMonth: Array<{ month: number; label: string; average: number; count: number }>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    average: number;
    positiveRate: number;
    count: number;
  }>;
};

const MONTH_LABELS = [
  "",
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

export async function getSatisfactionReport(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
}): Promise<SatisfactionReport> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const yearFilter =
    params.schoolYearIds.length > 0
      ? { schoolYearId: { in: params.schoolYearIds } }
      : {};

  const [feedbacks, parentsCount, branches] = await Promise.all([
    prisma.parentFeedback.findMany({
      where: { ...branchFilter, ...yearFilter },
      select: { rating: true, month: true, branchId: true },
    }),
    prisma.parent.count({
      where: { branchMember: branchFilter },
    }),
    prisma.branch.findMany({
      where:
        params.scope.scope === "branch" && params.scope.branchId
          ? { id: params.scope.branchId }
          : { organizationId: params.scope.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalFeedbacks = feedbacks.length;
  const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
  const averageRating =
    totalFeedbacks > 0 ? Math.round((sum / totalFeedbacks) * 10) / 10 : 0;
  const positiveCount = feedbacks.filter(
    (f) => f.rating >= SATISFACTION_POSITIVE_MIN,
  ).length;

  const ratingMap = new Map<number, number>();
  for (let i = 1; i <= 5; i++) ratingMap.set(i, 0);
  for (const f of feedbacks) {
    ratingMap.set(f.rating, (ratingMap.get(f.rating) ?? 0) + 1);
  }

  const monthAgg = new Map<number, { sum: number; count: number }>();
  for (const f of feedbacks) {
    const cur = monthAgg.get(f.month) ?? { sum: 0, count: 0 };
    cur.sum += f.rating;
    cur.count += 1;
    monthAgg.set(f.month, cur);
  }

  const byBranch = branches.map((b) => {
    const rows = feedbacks.filter((f) => f.branchId === b.id);
    const count = rows.length;
    const avg =
      count > 0
        ? Math.round(
            (rows.reduce((acc, f) => acc + f.rating, 0) / count) * 10,
          ) / 10
        : 0;
    const positive = rows.filter(
      (f) => f.rating >= SATISFACTION_POSITIVE_MIN,
    ).length;
    return {
      branchId: b.id,
      branchName: b.name,
      average: avg,
      positiveRate: pct(positive, count),
      count,
    };
  });

  return {
    averageRating,
    totalFeedbacks,
    positiveRate: pct(positiveCount, totalFeedbacks),
    responseRate: pct(totalFeedbacks, parentsCount),
    parentsCount,
    byRating: Array.from(ratingMap.entries()).map(([rating, value]) => ({
      name: `${rating}★`,
      value,
    })),
    byMonth: Array.from(monthAgg.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([month, agg]) => ({
        month,
        label: MONTH_LABELS[month] ?? String(month),
        average: Math.round((agg.sum / agg.count) * 10) / 10,
        count: agg.count,
      })),
    byBranch,
  };
}

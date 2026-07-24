import { prisma } from "@/lib/prisma";
import { buildBranchIdFilter, monthKey, monthLabelFr, pct, type BranchScopeInput } from "./scope";

export type HiringReport = {
  total: number;
  accepted: number;
  rejected: number;
  hired: number;
  pending: number;
  acceptanceRate: number;
  hireRate: number;
  byStatus: Array<{ name: string; value: number; key: string }>;
  byType: Array<{ name: string; value: number }>;
  byMonth: Array<{ month: string; label: string; total: number; hired: number }>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    total: number;
    hired: number;
    rejected: number;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  REVIEWED: "Examinées",
  ACCEPTED: "Acceptées",
  REJECTED: "Refusées",
  HIRED: "Embauchées",
  CANCELLED: "Annulées",
};

export async function getHiringReport(params: {
  scope: BranchScopeInput;
}): Promise<HiringReport> {
  const branchFilter = buildBranchIdFilter(params.scope);

  const [apps, branches] = await Promise.all([
    prisma.jobApplication.findMany({
      where: {
        organizationId: params.scope.organizationId,
        ...branchFilter,
      },
      select: {
        status: true,
        applicationType: true,
        createdAt: true,
        branchId: true,
      },
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

  const statusCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const monthMap = new Map<
    string,
    { month: string; label: string; total: number; hired: number; sort: string }
  >();

  for (const app of apps) {
    statusCounts.set(app.status, (statusCounts.get(app.status) ?? 0) + 1);
    typeCounts.set(
      app.applicationType,
      (typeCounts.get(app.applicationType) ?? 0) + 1,
    );
    const key = monthKey(app.createdAt);
    const row = monthMap.get(key) ?? {
      month: key,
      label: monthLabelFr(app.createdAt),
      total: 0,
      hired: 0,
      sort: key,
    };
    row.total += 1;
    if (app.status === "HIRED") row.hired += 1;
    monthMap.set(key, row);
  }

  const total = apps.length;
  const accepted = statusCounts.get("ACCEPTED") ?? 0;
  const rejected = statusCounts.get("REJECTED") ?? 0;
  const hired = statusCounts.get("HIRED") ?? 0;
  const pending =
    (statusCounts.get("PENDING") ?? 0) + (statusCounts.get("REVIEWED") ?? 0);

  const byBranch = branches.map((b) => {
    const rows = apps.filter((a) => a.branchId === b.id);
    return {
      branchId: b.id,
      branchName: b.name,
      total: rows.length,
      hired: rows.filter((r) => r.status === "HIRED").length,
      rejected: rows.filter((r) => r.status === "REJECTED").length,
    };
  });

  return {
    total,
    accepted,
    rejected,
    hired,
    pending,
    acceptanceRate: pct(accepted + hired, total),
    hireRate: pct(hired, total),
    byStatus: Object.keys(STATUS_LABELS).map((key) => ({
      key,
      name: STATUS_LABELS[key],
      value: statusCounts.get(key) ?? 0,
    })),
    byType: Array.from(typeCounts.entries()).map(([name, value]) => ({
      name: name === "TEACHER" ? "Enseignant" : "Personnel",
      value,
    })),
    byMonth: Array.from(monthMap.values())
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .map(({ sort: _s, ...rest }) => rest),
    byBranch,
  };
}

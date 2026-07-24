import { prisma } from "@/lib/prisma";
import { buildBranchIdFilter, monthKey, monthLabelFr, pct, type BranchScopeInput } from "./scope";

export type RegistrationReport = {
  total: number;
  registered: number;
  rejected: number;
  pending: number;
  conversionRate: number;
  byStatus: Array<{ name: string; value: number; key: string }>;
  byMonth: Array<{
    month: string;
    label: string;
    total: number;
    registered: number;
  }>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    total: number;
    registered: number;
    rejected: number;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmées",
  REJECTED: "Refusées",
  CANCELLED: "Annulées",
  REGISTERED: "Inscrites",
  ARCHIVED: "Archivées",
};

export async function getRegistrationReport(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
}): Promise<RegistrationReport> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const yearFilter =
    params.schoolYearIds.length > 0
      ? { schoolYearId: { in: params.schoolYearIds } }
      : {};

  const [rows, branches] = await Promise.all([
    prisma.registrationRequest.findMany({
      where: {
        organizationId: params.scope.organizationId,
        ...branchFilter,
        ...yearFilter,
      },
      select: { status: true, createdAt: true, branchId: true },
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
  const monthMap = new Map<
    string,
    {
      month: string;
      label: string;
      total: number;
      registered: number;
      sort: string;
    }
  >();

  for (const row of rows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    const key = monthKey(row.createdAt);
    const cur = monthMap.get(key) ?? {
      month: key,
      label: monthLabelFr(row.createdAt),
      total: 0,
      registered: 0,
      sort: key,
    };
    cur.total += 1;
    if (row.status === "REGISTERED") cur.registered += 1;
    monthMap.set(key, cur);
  }

  const total = rows.length;
  const registered = statusCounts.get("REGISTERED") ?? 0;
  const rejected = statusCounts.get("REJECTED") ?? 0;
  const pending =
    (statusCounts.get("PENDING") ?? 0) + (statusCounts.get("CONFIRMED") ?? 0);

  return {
    total,
    registered,
    rejected,
    pending,
    conversionRate: pct(registered, total),
    byStatus: Object.keys(STATUS_LABELS).map((key) => ({
      key,
      name: STATUS_LABELS[key],
      value: statusCounts.get(key) ?? 0,
    })),
    byMonth: Array.from(monthMap.values())
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .map(({ sort: _s, ...rest }) => rest),
    byBranch: branches.map((b) => {
      const list = rows.filter((r) => r.branchId === b.id);
      return {
        branchId: b.id,
        branchName: b.name,
        total: list.length,
        registered: list.filter((r) => r.status === "REGISTERED").length,
        rejected: list.filter((r) => r.status === "REJECTED").length,
      };
    }),
  };
}

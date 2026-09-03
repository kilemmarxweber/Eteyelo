import { branchDocumentName } from "@/lib/branch-document-name";
import { prisma } from "@/lib/prisma";
import {
  buildBranchIdFilter,
  buildBranchRecordWhere,
  loadSchoolYearBounds,
  monthKey,
  monthLabelFr,
  periodLabelFr,
  type BranchScopeInput,
} from "./scope";

export type CreditsNamedAmount = { name: string; value: number; key?: string };

export type CreditAdvanceRow = {
  id: string;
  agentName: string;
  kindLabel: string;
  branchName: string;
  amount: number;
  installmentCount: number;
  deductedCount: number;
  outstanding: number;
  status: string;
  statusLabel: string;
  period: string;
  reason: string;
  requestedByName: string;
  createdAt: string;
};

export type CreditsReport = {
  count: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  settledCount: number;
  requestedAmount: number;
  approvedAmount: number;
  outstandingAmount: number;
  deductedAmount: number;
  byStatus: CreditsNamedAmount[];
  byKind: CreditsNamedAmount[];
  byMonth: Array<{
    month: string;
    label: string;
    count: number;
    amount: number;
  }>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    count: number;
    requested: number;
    approved: number;
    outstanding: number;
  }>;
  advances: CreditAdvanceRow[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Accordé",
  REJECTED: "Refusé",
  CANCELLED: "Annulé",
  SETTLED: "Soldé",
};

const KIND_LABELS: Record<string, string> = {
  teacher: "Enseignant",
  personnel: "Personnel",
  both: "Les deux",
};

function personName(user?: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  return [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ").trim();
}

export async function getCreditsReport(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
}): Promise<CreditsReport> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const bounds = await loadSchoolYearBounds(prisma, params.schoolYearIds);
  const dateFilter = bounds
    ? {
        OR: [
          { createdAt: { gte: bounds.minStart, lte: bounds.maxEnd } },
          ...bounds.months.map((m) => ({
            firstYear: m.year,
            firstMonth: m.month,
          })),
        ],
      }
    : {};

  const memberUserSelect = {
    member: {
      select: {
        user: { select: { name: true, postnom: true, prenom: true } },
      },
    },
  } as const;

  const [rows, branches] = await Promise.all([
    prisma.salaryAdvance.findMany({
      where: { ...branchFilter, ...dateFilter },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        installmentCount: true,
        status: true,
        reason: true,
        firstYear: true,
        firstMonth: true,
        createdAt: true,
        branchId: true,
        teacherId: true,
        personnelId: true,
        branch: { select: { name: true, description: true } },
        teacher: {
          select: { branchMember: { select: memberUserSelect } },
        },
        personnel: {
          select: { branchMember: { select: memberUserSelect } },
        },
        requestedBy: {
          select: { name: true, postnom: true, prenom: true },
        },
        installments: {
          select: { amount: true, status: true },
        },
      },
    }),
    prisma.branch.findMany({
      where: buildBranchRecordWhere(params.scope),
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const statusCounts = new Map<string, number>();
  const kindCounts = new Map<string, number>();
  const monthMap = new Map<
    string,
    { month: string; label: string; count: number; amount: number }
  >();
  const branchMap = new Map<
    string,
    {
      branchId: string;
      branchName: string;
      count: number;
      requested: number;
      approved: number;
      outstanding: number;
    }
  >();

  for (const branch of branches) {
    branchMap.set(branch.id, {
      branchId: branch.id,
      branchName: branchDocumentName(branch),
      count: 0,
      requested: 0,
      approved: 0,
      outstanding: 0,
    });
  }

  let requestedAmount = 0;
  let approvedAmount = 0;
  let outstandingAmount = 0;
  let deductedAmount = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let settledCount = 0;

  const advances: CreditAdvanceRow[] = [];

  for (const row of rows) {
    const amount = Number(row.amount || 0);
    const deducted = row.installments
      .filter((item) => item.status === "DEDUCTED")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const outstanding =
      row.status === "APPROVED" ? Math.max(0, amount - deducted) : 0;

    requestedAmount += amount;
    deductedAmount += deducted;
    outstandingAmount += outstanding;
    if (row.status === "APPROVED" || row.status === "SETTLED") {
      approvedAmount += amount;
    }

    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    if (row.status === "PENDING") pendingCount += 1;
    else if (row.status === "APPROVED") approvedCount += 1;
    else if (row.status === "REJECTED") rejectedCount += 1;
    else if (row.status === "SETTLED") settledCount += 1;

    const kind =
      row.teacherId && row.personnelId
        ? "both"
        : row.personnelId && !row.teacherId
          ? "personnel"
          : "teacher";
    kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);

    const createdKey = monthKey(row.createdAt);
    const monthRow = monthMap.get(createdKey) ?? {
      month: createdKey,
      label: monthLabelFr(row.createdAt),
      count: 0,
      amount: 0,
    };
    monthRow.count += 1;
    monthRow.amount += amount;
    monthMap.set(createdKey, monthRow);

    const branchName = branchDocumentName(row.branch);
    const branchRow = branchMap.get(row.branchId) ?? {
      branchId: row.branchId,
      branchName,
      count: 0,
      requested: 0,
      approved: 0,
      outstanding: 0,
    };
    branchRow.count += 1;
    branchRow.requested += amount;
    if (row.status === "APPROVED" || row.status === "SETTLED") {
      branchRow.approved += amount;
    }
    branchRow.outstanding += outstanding;
    branchMap.set(row.branchId, branchRow);

    const agentName =
      personName(row.teacher?.branchMember?.member?.user) ||
      personName(row.personnel?.branchMember?.member?.user) ||
      "Agent";

    advances.push({
      id: row.id,
      agentName,
      kindLabel: KIND_LABELS[kind] ?? kind,
      branchName,
      amount,
      installmentCount: row.installmentCount,
      deductedCount: row.installments.filter((item) => item.status === "DEDUCTED")
        .length,
      outstanding,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status] ?? row.status,
      period: periodLabelFr(row.firstYear, row.firstMonth),
      reason: row.reason?.trim() || "—",
      requestedByName: personName(row.requestedBy) || "—",
      createdAt: row.createdAt.toISOString(),
    });
  }

  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    count: rows.length,
    pendingCount,
    approvedCount,
    rejectedCount,
    settledCount,
    requestedAmount: round(requestedAmount),
    approvedAmount: round(approvedAmount),
    outstandingAmount: round(outstandingAmount),
    deductedAmount: round(deductedAmount),
    byStatus: ["PENDING", "APPROVED", "REJECTED", "SETTLED", "CANCELLED"].map(
      (key) => ({
        key,
        name: STATUS_LABELS[key] ?? key,
        value: statusCounts.get(key) ?? 0,
      }),
    ),
    byKind: ["teacher", "personnel", "both"].map((key) => ({
      key,
      name: KIND_LABELS[key] ?? key,
      value: kindCounts.get(key) ?? 0,
    })),
    byMonth: Array.from(monthMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    byBranch: Array.from(branchMap.values()),
    advances,
  };
}

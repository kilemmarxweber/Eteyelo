import { branchDocumentName } from "@/lib/branch-document-name";
import { prisma } from "@/lib/prisma";
import {
  buildBranchIdFilter,
  buildBranchRecordWhere,
  periodKey,
  periodLabelFr,
  type BranchScopeInput,
} from "./scope";

export type PayrollNamedAmount = { name: string; value: number; key?: string };

export type PayrollPayslipRow = {
  id: string;
  agentName: string;
  agentKind: string;
  agentKindLabel: string;
  branchName: string;
  period: string;
  year: number;
  month: number;
  status: string;
  statusLabel: string;
  gross: number;
  deductions: number;
  net: number;
};

export type PayrollReport = {
  count: number;
  paidCount: number;
  validatedCount: number;
  draftCount: number;
  cancelledCount: number;
  teacherCount: number;
  personnelCount: number;
  bothCount: number;
  gross: number;
  deductions: number;
  net: number;
  paidNet: number;
  byStatus: PayrollNamedAmount[];
  byKind: PayrollNamedAmount[];
  byMonth: Array<{
    month: string;
    label: string;
    count: number;
    gross: number;
    deductions: number;
    net: number;
  }>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    count: number;
    gross: number;
    deductions: number;
    net: number;
    paidNet: number;
  }>;
  payslips: PayrollPayslipRow[];
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validé",
  PAID: "Payé",
  CANCELLED: "Annulé",
};

const KIND_LABELS: Record<string, string> = {
  TEACHER: "Enseignant",
  PERSONNEL: "Personnel",
  BOTH: "Les deux",
};

function personName(user?: {
  name?: string | null;
  postnom?: string | null;
  prenom?: string | null;
} | null) {
  return [user?.name, user?.postnom, user?.prenom].filter(Boolean).join(" ").trim();
}

export async function getPayrollReport(params: {
  scope: BranchScopeInput;
  schoolYearIds: string[];
}): Promise<PayrollReport> {
  const branchFilter = buildBranchIdFilter(params.scope);
  const yearFilter =
    params.schoolYearIds.length > 0
      ? { schoolYearId: { in: params.schoolYearIds } }
      : {};

  const memberUserSelect = {
    member: {
      select: {
        user: { select: { name: true, postnom: true, prenom: true } },
      },
    },
  } as const;

  const [rows, branches] = await Promise.all([
    prisma.teacherPayslip.findMany({
      where: { ...branchFilter, ...yearFilter },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        id: true,
        year: true,
        month: true,
        status: true,
        gross: true,
        deductions: true,
        net: true,
        agentKind: true,
        branchId: true,
        branch: { select: { name: true, description: true } },
        teacher: {
          select: {
            branchMember: { select: memberUserSelect },
          },
        },
        personnel: {
          select: {
            branchMember: { select: memberUserSelect },
          },
        },
        branchMember: { select: memberUserSelect },
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
    {
      month: string;
      label: string;
      count: number;
      gross: number;
      deductions: number;
      net: number;
    }
  >();
  const branchMap = new Map<
    string,
    {
      branchId: string;
      branchName: string;
      count: number;
      gross: number;
      deductions: number;
      net: number;
      paidNet: number;
    }
  >();

  for (const branch of branches) {
    branchMap.set(branch.id, {
      branchId: branch.id,
      branchName: branchDocumentName(branch),
      count: 0,
      gross: 0,
      deductions: 0,
      net: 0,
      paidNet: 0,
    });
  }

  let gross = 0;
  let deductions = 0;
  let net = 0;
  let paidNet = 0;
  let paidCount = 0;
  let validatedCount = 0;
  let draftCount = 0;
  let cancelledCount = 0;
  let teacherCount = 0;
  let personnelCount = 0;
  let bothCount = 0;

  const payslips: PayrollPayslipRow[] = [];

  for (const row of rows) {
    const g = Number(row.gross || 0);
    const d = Number(row.deductions || 0);
    const n = Number(row.net || 0);
    gross += g;
    deductions += d;
    net += n;
    if (row.status === "PAID") {
      paidNet += n;
      paidCount += 1;
    } else if (row.status === "VALIDATED") {
      validatedCount += 1;
    } else if (row.status === "DRAFT") {
      draftCount += 1;
    } else if (row.status === "CANCELLED") {
      cancelledCount += 1;
    }

    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    kindCounts.set(row.agentKind, (kindCounts.get(row.agentKind) ?? 0) + 1);
    if (row.agentKind === "TEACHER") teacherCount += 1;
    else if (row.agentKind === "PERSONNEL") personnelCount += 1;
    else if (row.agentKind === "BOTH") bothCount += 1;

    const mKey = periodKey(row.year, row.month);
    const monthRow = monthMap.get(mKey) ?? {
      month: mKey,
      label: periodLabelFr(row.year, row.month),
      count: 0,
      gross: 0,
      deductions: 0,
      net: 0,
    };
    monthRow.count += 1;
    monthRow.gross += g;
    monthRow.deductions += d;
    monthRow.net += n;
    monthMap.set(mKey, monthRow);

    const branchName = branchDocumentName(row.branch);
    const branchRow = branchMap.get(row.branchId) ?? {
      branchId: row.branchId,
      branchName,
      count: 0,
      gross: 0,
      deductions: 0,
      net: 0,
      paidNet: 0,
    };
    branchRow.count += 1;
    branchRow.gross += g;
    branchRow.deductions += d;
    branchRow.net += n;
    if (row.status === "PAID") branchRow.paidNet += n;
    branchMap.set(row.branchId, branchRow);

    const agentName =
      personName(row.branchMember?.member?.user) ||
      personName(row.teacher?.branchMember?.member?.user) ||
      personName(row.personnel?.branchMember?.member?.user) ||
      "Agent";

    payslips.push({
      id: row.id,
      agentName,
      agentKind: row.agentKind,
      agentKindLabel: KIND_LABELS[row.agentKind] ?? row.agentKind,
      branchName,
      period: periodLabelFr(row.year, row.month),
      year: row.year,
      month: row.month,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status] ?? row.status,
      gross: g,
      deductions: d,
      net: n,
    });
  }

  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    count: rows.length,
    paidCount,
    validatedCount,
    draftCount,
    cancelledCount,
    teacherCount,
    personnelCount,
    bothCount,
    gross: round(gross),
    deductions: round(deductions),
    net: round(net),
    paidNet: round(paidNet),
    byStatus: ["DRAFT", "VALIDATED", "PAID", "CANCELLED"].map((key) => ({
      key,
      name: STATUS_LABELS[key] ?? key,
      value: statusCounts.get(key) ?? 0,
    })),
    byKind: ["TEACHER", "PERSONNEL", "BOTH"].map((key) => ({
      key,
      name: KIND_LABELS[key] ?? key,
      value: kindCounts.get(key) ?? 0,
    })),
    byMonth: Array.from(monthMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    byBranch: Array.from(branchMap.values()),
    payslips,
  };
}

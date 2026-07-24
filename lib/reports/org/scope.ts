import type { ReportScope } from "./definitions";

export type BranchScopeInput = {
  organizationId: string;
  scope: ReportScope;
  branchId?: string;
};

/** Filtre `{ branchId }` ou `{ branch: { organizationId, isActive } }` pour modèles avec `branchId`. */
export function buildBranchIdFilter(input: BranchScopeInput) {
  if (input.scope === "branch" && input.branchId) {
    return { branchId: input.branchId };
  }
  return {
    branch: { organizationId: input.organizationId, isActive: true },
  };
}

/** Liste d'IDs de branches dans la portée (pour queries qui ne supportent pas nested filter). */
export async function resolveBranchIds(
  prisma: {
    branch: {
      findMany: (args: {
        where: Record<string, unknown>;
        select: { id: true };
      }) => Promise<{ id: string }[]>;
    };
  },
  input: BranchScopeInput,
): Promise<string[]> {
  if (input.scope === "branch" && input.branchId) {
    return [input.branchId];
  }
  const branches = await prisma.branch.findMany({
    where: { organizationId: input.organizationId, isActive: true },
    select: { id: true },
  });
  return branches.map((b) => b.id);
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelFr(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "2-digit",
  }).format(date);
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format rapports (ex. `104.500 AOA`, `1,234.56 USD`). */
export { formatReportAmount, formatReportNumber } from "@/lib/reports/format-amount";
export { formatCurrencyAmount } from "@/lib/exchange-rate";

export function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

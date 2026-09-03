import type { ReportScope } from "./definitions";

export type BranchScopeInput = {
  organizationId: string;
  scope: ReportScope;
  /** Une branche (rétrocompat URL `branchId=id`). */
  branchId?: string;
  /** Plusieurs branches (URL `branchId=id1,id2`). */
  branchIds?: string[];
};

/** IDs explicitement sélectionnés (vide = toutes les branches actives). */
export function selectedBranchIds(input: BranchScopeInput): string[] {
  if (input.branchIds && input.branchIds.length > 0) {
    return [...new Set(input.branchIds.filter(Boolean))];
  }
  if (input.scope === "branch" && input.branchId) {
    return [input.branchId];
  }
  return [];
}

export function parseBranchIdsParam(value?: string | null): string[] {
  if (!value || value.trim() === "" || value === "all") return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0 && part !== "all"),
    ),
  ];
}

export function serializeBranchIdsParam(ids: string[]): string {
  return ids.length === 0 ? "all" : ids.join(",");
}

/** Filtre `{ branchId }` / `{ branchId: { in } }` ou org entière. */
export function buildBranchIdFilter(input: BranchScopeInput) {
  const ids = selectedBranchIds(input);
  if (ids.length === 1) {
    return { branchId: ids[0] };
  }
  if (ids.length > 1) {
    return { branchId: { in: ids } };
  }
  return {
    branch: { organizationId: input.organizationId, isActive: true },
  };
}

/** `where` Prisma sur le modèle `Branch`. */
export function buildBranchRecordWhere(input: BranchScopeInput) {
  const ids = selectedBranchIds(input);
  if (ids.length === 1) {
    return { id: ids[0] };
  }
  if (ids.length > 1) {
    return { id: { in: ids } };
  }
  return { organizationId: input.organizationId, isActive: true };
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
  const ids = selectedBranchIds(input);
  if (ids.length > 0) return ids;
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

const MONTH_SHORT_FR = [
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

export function periodLabelFr(year: number, month: number) {
  const label = MONTH_SHORT_FR[month - 1] ?? String(month);
  return `${label} ${String(year).slice(-2)}`;
}

export function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
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

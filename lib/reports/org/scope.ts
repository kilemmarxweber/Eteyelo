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

export type YearMonth = { year: number; month: number };

/** Mois inclus dans [start, end] (dates civiles). */
export function yearMonthsInRange(start: Date, end: Date): YearMonth[] {
  const out: YearMonth[] = [];
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    return out;
  }
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  let guard = 0;
  while (cursor <= last && guard < 120) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
    guard += 1;
  }
  return out;
}

export async function loadSchoolYearBounds(
  db: {
    schoolYear: {
      findMany: (args: {
        where: { id: { in: string[] } };
        select: { startYear: true; endYear: true };
      }) => Promise<{ startYear: Date; endYear: Date }[]>;
    };
  },
  schoolYearIds: string[],
): Promise<{ minStart: Date; maxEnd: Date; months: YearMonth[] } | null> {
  if (schoolYearIds.length === 0) return null;
  const years = await db.schoolYear.findMany({
    where: { id: { in: schoolYearIds } },
    select: { startYear: true, endYear: true },
  });
  if (years.length === 0) return null;
  const minStart = years.reduce(
    (min, y) => (y.startYear < min ? y.startYear : min),
    years[0]!.startYear,
  );
  const maxEnd = years.reduce(
    (max, y) => (y.endYear > max ? y.endYear : max),
    years[0]!.endYear,
  );
  return { minStart, maxEnd, months: yearMonthsInRange(minStart, maxEnd) };
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

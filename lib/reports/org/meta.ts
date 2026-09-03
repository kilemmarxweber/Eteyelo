import {
  CURRENCY_LABELS,
  getBaseCurrency,
  getQuoteCurrency,
  getSelectedRate,
  type ExchangeRatePair,
} from "@/lib/exchange-rate";
import { formatReportNumber } from "@/lib/reports/format-amount";
import { prisma } from "@/lib/prisma";
import type { CurrencyCode } from "@/prisma/generated/prisma/enums";
import type { ReportScope } from "./definitions";
import { buildBranchIdFilter, parseBranchIdsParam, type BranchScopeInput } from "./scope";

export type ReportBranchOption = { id: string; name: string };

export type ReportSchoolYearOption = {
  /** Clé stable = nameYear (partagée entre branches). */
  key: string;
  label: string;
  /** IDs SchoolYear correspondants dans la portée. */
  ids: string[];
  isCurrent: boolean;
};

export type ReportCurrencyMeta = {
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode | null;
  selectedRate: number | null;
  /** Ex. "1 USD = 2 850 CDF" */
  rateLabel: string | null;
  baseLabel: string;
};

export type ReportClassOption = {
  /** Clé = codeClasse (filtre URL). */
  key: string;
  /** Affichage : code — nom. */
  label: string;
  codeClasse: string;
  nameClasse: string;
};

export type ReportMeta = {
  branches: ReportBranchOption[];
  schoolYears: ReportSchoolYearOption[];
  classes: ReportClassOption[];
  scope: ReportScope;
  selectedBranchId: string | null;
  /** IDs sélectionnés ; vide = toutes les branches. */
  selectedBranchIds: string[];
  /** `all` ou codeClasse. */
  classeKey: string;
  schoolYearKey: string;
  schoolYearIds: string[];
  currency: ReportCurrencyMeta;
};

function buildCurrencyMeta(rates: ExchangeRatePair[]): ReportCurrencyMeta {
  const baseCurrency = getBaseCurrency(rates);
  const quoteCurrency = getQuoteCurrency(rates);
  const selected = getSelectedRate(rates);
  const selectedRate = selected?.rate ?? null;

  let rateLabel: string | null = null;
  if (selected && quoteCurrency) {
    const rateText =
      quoteCurrency === "USD" || selected.rate < 1
        ? selected.rate.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })
        : formatReportNumber(selected.rate, quoteCurrency);
    rateLabel = `1 ${baseCurrency} = ${rateText} ${quoteCurrency}`;
  }

  return {
    baseCurrency,
    quoteCurrency,
    selectedRate,
    rateLabel,
    baseLabel: CURRENCY_LABELS[baseCurrency] ?? baseCurrency,
  };
}

export async function getReportMeta(params: {
  organizationId: string;
  scope?: string;
  branchId?: string;
  schoolYearKey?: string;
  classeKey?: string;
}): Promise<ReportMeta> {
  const [branches, exchangeRows] = await Promise.all([
    prisma.branch.findMany({
      where: { organizationId: params.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.exchangeRate.findMany({
      where: { organizationId: params.organizationId, isActive: true },
      orderBy: [{ fromCurrency: "asc" }, { toCurrency: "asc" }],
      select: {
        fromCurrency: true,
        toCurrency: true,
        rate: true,
        isActive: true,
        isSelected: true,
      },
    }),
  ]);

  const currency = buildCurrencyMeta(
    exchangeRows.map((row) => ({
      fromCurrency: row.fromCurrency,
      toCurrency: row.toCurrency,
      rate: row.rate,
      isActive: row.isActive,
      isSelected: row.isSelected,
    })),
  );

  const knownIds = new Set(branches.map((b) => b.id));
  const requestedIds = parseBranchIdsParam(params.branchId).filter((id) =>
    knownIds.has(id),
  );
  const wantsAll = requestedIds.length === 0;

  const scope: ReportScope = wantsAll ? "all" : "branch";
  const selectedBranchIds = wantsAll ? [] : requestedIds;
  const selectedBranchId = selectedBranchIds[0] ?? null;

  const scopeInput: BranchScopeInput = {
    organizationId: params.organizationId,
    scope,
    branchId: selectedBranchId ?? undefined,
    branchIds: selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
  };

  const [years, classeRows] = await Promise.all([
    prisma.schoolYear.findMany({
      where: {
        ...buildBranchIdFilter(scopeInput),
        isArchived: false,
      },
      select: {
        id: true,
        nameYear: true,
        isCurrentYear: true,
        startYear: true,
      },
      orderBy: { startYear: "desc" },
    }),
    prisma.classe.findMany({
      where: {
        ...buildBranchIdFilter(scopeInput),
        OR: [{ statusClasse: true }, { statusClasse: null }],
      },
      select: {
        codeClasse: true,
        nameClasse: true,
      },
      orderBy: [{ codeClasse: "asc" }, { nameClasse: "asc" }],
    }),
  ]);

  const byName = new Map<string, ReportSchoolYearOption>();
  for (const y of years) {
    const existing = byName.get(y.nameYear);
    if (existing) {
      existing.ids.push(y.id);
      existing.isCurrent = existing.isCurrent || y.isCurrentYear;
    } else {
      byName.set(y.nameYear, {
        key: y.nameYear,
        label: y.nameYear,
        ids: [y.id],
        isCurrent: y.isCurrentYear,
      });
    }
  }

  const schoolYears = Array.from(byName.values());
  const current = schoolYears.find((y) => y.isCurrent);
  const requestedKey = params.schoolYearKey?.trim();

  let schoolYearKey = "all";
  let schoolYearIds: string[] = [];

  if (requestedKey === "all" || !requestedKey) {
    if (current) {
      schoolYearKey = current.key;
      schoolYearIds = current.ids;
    } else if (schoolYears[0]) {
      schoolYearKey = schoolYears[0].key;
      schoolYearIds = schoolYears[0].ids;
    } else {
      schoolYearKey = "all";
      schoolYearIds = [];
    }
    // Explicit "all" from URL
    if (requestedKey === "all") {
      schoolYearKey = "all";
      schoolYearIds = schoolYears.flatMap((y) => y.ids);
    }
  } else {
    const match = schoolYears.find((y) => y.key === requestedKey);
    if (match) {
      schoolYearKey = match.key;
      schoolYearIds = match.ids;
    } else {
      schoolYearKey = current?.key ?? schoolYears[0]?.key ?? "all";
      schoolYearIds =
        current?.ids ?? schoolYears[0]?.ids ?? schoolYears.flatMap((y) => y.ids);
    }
  }

  const classByCode = new Map<string, ReportClassOption>();
  for (const c of classeRows) {
    const code = c.codeClasse.trim();
    if (!code || classByCode.has(code)) continue;
    classByCode.set(code, {
      key: code,
      label: `${code} — ${c.nameClasse}`,
      codeClasse: code,
      nameClasse: c.nameClasse,
    });
  }
  const classes = Array.from(classByCode.values()).sort((a, b) =>
    a.codeClasse.localeCompare(b.codeClasse, "fr"),
  );

  const requestedClasse = params.classeKey?.trim() || "all";
  const classeKey =
    requestedClasse === "all" ||
    classes.some((c) => c.key === requestedClasse)
      ? requestedClasse === ""
        ? "all"
        : requestedClasse
      : "all";

  return {
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    schoolYears,
    classes,
    scope,
    selectedBranchId,
    selectedBranchIds,
    classeKey,
    schoolYearKey,
    schoolYearIds,
    currency,
  };
}

import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import { roundCurrency } from "@/lib/exchange-rate";

export const MAX_SALARY_ADVANCE_INSTALLMENTS = 12;

export function addCalendarMonths(
  year: number,
  month: number,
  offset: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function splitAdvanceInstallments(
  total: number,
  count: number,
  currency: CurrencyCode,
): number[] {
  const n = Math.max(1, Math.floor(count));
  const base = roundCurrency(total / n, currency);
  const amounts = Array.from({ length: n }, () => base);
  const remainder = roundCurrency(
    total - amounts.slice(0, n - 1).reduce((sum, value) => sum + value, 0),
    currency,
  );
  amounts[n - 1] = remainder;
  return amounts;
}

export function planAdvanceInstallments(params: {
  total: number;
  count: number;
  currency: CurrencyCode;
  firstYear: number;
  firstMonth: number;
}): Array<{ sequence: number; year: number; month: number; amount: number }> {
  const amounts = splitAdvanceInstallments(
    params.total,
    params.count,
    params.currency,
  );
  return amounts.map((amount, index) => {
    const period = addCalendarMonths(params.firstYear, params.firstMonth, index);
    return {
      sequence: index + 1,
      year: period.year,
      month: period.month,
      amount,
    };
  });
}

import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import { roundCurrency } from "@/lib/exchange-rate";

function currencyUnit(currency: CurrencyCode) {
  return currency === CurrencyCode.USD ? 0.01 : 1;
}

/**
 * Répartit un brut (ex. forfait 70 000) sur des séances selon leur durée.
 * La somme des montants arrondis est exactement égale au brut.
 */
export function allocateSessionGross(
  totalGross: number,
  durations: number[],
  currency: CurrencyCode,
): number[] {
  const n = durations.length;
  if (n === 0) return [];
  const roundedTotal = roundCurrency(Math.max(0, totalGross), currency);
  const weightSum = durations.reduce((sum, duration) => sum + Math.max(0, duration), 0);
  if (roundedTotal <= 0 || weightSum <= 0) return Array.from({ length: n }, () => 0);

  const unit = currencyUnit(currency);
  const exact = durations.map((duration) => (roundedTotal * Math.max(0, duration)) / weightSum);
  const floored = exact.map((value) => Math.floor(value / unit + 1e-9) * unit);
  let leftoverUnits = Math.round(
    (roundedTotal - floored.reduce((sum, value) => sum + value, 0)) / unit,
  );

  const order = exact
    .map((value, index) => ({
      index,
      frac: value / unit - Math.floor(value / unit + 1e-9),
    }))
    .sort((left, right) => right.frac - left.frac);

  const allocated = [...floored];
  for (let i = 0; leftoverUnits > 0 && i < order.length; i += 1) {
    allocated[order[i]!.index] += unit;
    leftoverUnits -= 1;
  }
  return allocated.map((value) => roundCurrency(value, currency));
}

/** Retenue d'une séance : absence totale = valeur séance entière. */
export function sessionLossAmount(
  sessionGross: number,
  lostMinutes: number,
  durationMinutes: number,
  currency: CurrencyCode,
): number {
  if (sessionGross <= 0 || durationMinutes <= 0 || lostMinutes <= 0) return 0;
  if (lostMinutes >= durationMinutes) {
    return roundCurrency(sessionGross, currency);
  }
  return roundCurrency(sessionGross * (lostMinutes / durationMinutes), currency);
}

export function settlePayrollTotals(
  gross: number,
  rawDeductions: number,
  currency: CurrencyCode,
) {
  const roundedGross = roundCurrency(Math.max(0, gross), currency);
  const deductions = roundCurrency(
    Math.min(roundedGross, Math.max(0, rawDeductions)),
    currency,
  );
  return {
    gross: roundedGross,
    deductions,
    net: roundCurrency(Math.max(0, roundedGross - deductions), currency),
  };
}

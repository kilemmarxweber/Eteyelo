import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: "Dollar (USD)",
  CDF: "Franc congolais (CDF)",
  AOA: "Kwanza (AOA)",
};

/** Taux USD→AOA par defaut (placeholder organisation). */
export const DEFAULT_EXCHANGE_RATE_USD_AOA = 918;

export type ExchangeRatePair = {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  isActive: boolean;
  isSelected?: boolean;
};

export const DEFAULT_EXCHANGE_PAIRS: Array<{
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  isSelected?: boolean;
}> = [
  {
    fromCurrency: CurrencyCode.USD,
    toCurrency: CurrencyCode.CDF,
    rate: DEFAULT_EXCHANGE_RATE_USD_CDF,
    isSelected: true,
  },
  {
    fromCurrency: CurrencyCode.CDF,
    toCurrency: CurrencyCode.USD,
    rate: 1 / DEFAULT_EXCHANGE_RATE_USD_CDF,
  },
  {
    fromCurrency: CurrencyCode.USD,
    toCurrency: CurrencyCode.AOA,
    rate: DEFAULT_EXCHANGE_RATE_USD_AOA,
  },
  {
    fromCurrency: CurrencyCode.AOA,
    toCurrency: CurrencyCode.USD,
    rate: 1 / DEFAULT_EXCHANGE_RATE_USD_AOA,
  },
];

export function roundCurrency(amount: number, currency: CurrencyCode): number {
  if (currency === CurrencyCode.USD) {
    return Math.round(amount * 100) / 100;
  }
  return Math.round(amount);
}

/**
 * Devise de base = fromCurrency du taux sélectionné.
 * Fallback USD si aucun taux n'est sélectionné.
 */
export function getBaseCurrency(
  rates: ExchangeRatePair[],
  fallback: CurrencyCode = CurrencyCode.USD,
): CurrencyCode {
  const selected = rates.find((rate) => rate.isSelected && rate.isActive);
  if (selected) return selected.fromCurrency;

  const anySelected = rates.find((rate) => rate.isSelected);
  if (anySelected) return anySelected.fromCurrency;

  return fallback;
}

/** Devise cible principale du taux sélectionné (ex. USD si AOA→USD). */
export function getQuoteCurrency(
  rates: ExchangeRatePair[],
): CurrencyCode | null {
  const selected = rates.find((rate) => rate.isSelected && rate.isActive);
  return selected?.toCurrency ?? null;
}

export function getSelectedRate(
  rates: ExchangeRatePair[],
): ExchangeRatePair | null {
  return rates.find((rate) => rate.isSelected && rate.isActive) ?? null;
}

/**
 * Convertit un montant via la table de taux.
 * Pivot = devise de base (taux sélectionné), plus USD hardcodé.
 */
export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRatePair[],
  baseCurrency: CurrencyCode = getBaseCurrency(rates),
): number {
  if (from === to) return roundCurrency(amount, to);

  const direct = rates.find(
    (rate) =>
      rate.isActive &&
      rate.fromCurrency === from &&
      rate.toCurrency === to,
  );
  if (direct) {
    return roundCurrency(amount * direct.rate, to);
  }

  // Inverse de la paire directe
  const inverse = rates.find(
    (rate) =>
      rate.isActive &&
      rate.fromCurrency === to &&
      rate.toCurrency === from,
  );
  if (inverse && inverse.rate !== 0) {
    return roundCurrency(amount / inverse.rate, to);
  }

  // Pivot via la devise de base
  if (from !== baseCurrency && to !== baseCurrency) {
    const toBase = convertAmount(amount, from, baseCurrency, rates, baseCurrency);
    return convertAmount(toBase, baseCurrency, to, rates, baseCurrency);
  }

  throw new Error(
    `Taux de change inactif ou introuvable pour ${from} → ${to}.`,
  );
}

export function getRateUsed(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRatePair[],
): number | null {
  if (from === to) return 1;

  const direct = rates.find(
    (rate) =>
      rate.isActive &&
      rate.fromCurrency === from &&
      rate.toCurrency === to,
  );
  if (direct) return direct.rate;

  const inverse = rates.find(
    (rate) =>
      rate.isActive &&
      rate.fromCurrency === to &&
      rate.toCurrency === from,
  );
  if (inverse && inverse.rate !== 0) return 1 / inverse.rate;

  return null;
}

/**
 * Devises disponibles dans le basculeur :
 * devise de base + devises couvertes par une paire active liée à la base.
 */
export function listSelectableCurrencies(
  rates: ExchangeRatePair[],
  baseCurrency: CurrencyCode = getBaseCurrency(rates),
): CurrencyCode[] {
  const set = new Set<CurrencyCode>([baseCurrency]);
  for (const rate of rates) {
    if (!rate.isActive) continue;
    if (
      rate.fromCurrency === baseCurrency ||
      rate.toCurrency === baseCurrency
    ) {
      set.add(rate.fromCurrency);
      set.add(rate.toCurrency);
    }
  }
  return Array.from(set);
}

export function formatCurrencyAmount(
  amount: number,
  currency: CurrencyCode,
): string {
  const rounded = roundCurrency(amount, currency);
  return `${rounded.toLocaleString("fr-FR", {
    minimumFractionDigits: currency === CurrencyCode.USD ? 2 : 0,
    maximumFractionDigits: currency === CurrencyCode.USD ? 2 : 0,
  })} ${currency}`;
}

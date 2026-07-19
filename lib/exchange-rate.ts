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
};

export const DEFAULT_EXCHANGE_PAIRS: Array<{
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
}> = [
  {
    fromCurrency: CurrencyCode.USD,
    toCurrency: CurrencyCode.CDF,
    rate: DEFAULT_EXCHANGE_RATE_USD_CDF,
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
 * Convertit un montant via la table de taux.
 * Refuse si la paire est absente ou inactive.
 */
export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRatePair[],
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

  // Pivot USD si pas de paire directe
  if (from !== CurrencyCode.USD && to !== CurrencyCode.USD) {
    const toUsd = convertAmount(amount, from, CurrencyCode.USD, rates);
    return convertAmount(toUsd, CurrencyCode.USD, to, rates);
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
  const pair = rates.find(
    (rate) =>
      rate.isActive &&
      rate.fromCurrency === from &&
      rate.toCurrency === to,
  );
  return pair?.rate ?? null;
}

/** Devises disponibles dans le basculeur (couvertes par une paire active vers/depuis USD). */
export function listSelectableCurrencies(
  rates: ExchangeRatePair[],
): CurrencyCode[] {
  const set = new Set<CurrencyCode>([CurrencyCode.USD]);
  for (const rate of rates) {
    if (!rate.isActive) continue;
    if (
      rate.fromCurrency === CurrencyCode.USD ||
      rate.toCurrency === CurrencyCode.USD
    ) {
      set.add(rate.fromCurrency);
      set.add(rate.toCurrency);
    }
  }
  return Array.from(set);
}

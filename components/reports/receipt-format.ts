import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import { convertAmount, type ExchangeRatePair } from "@/lib/exchange-rate";
import { CurrencyCode } from "@/prisma/generated/prisma/enums";
import type { FacturePaymentStudentData } from "@/components/FacturePaymentStudent";
import type { InvoiceProps } from "@/src/interfaces/Paiement";

export type ReceiptCurrency = "USD" | "CDF" | "AOA";

/** Libellé affiché pour ModePaiement sur reçu / PDF. */
export function formatModePaiementLabel(mode?: string | null): string {
  switch (mode) {
    case "ESPECES":
      return "Espèces";
    case "MPESA":
      return "Mpesa";
    case "AIRTEL_MONEY":
      return "Airtel Money";
    case "ORANGE_MONEY":
      return "Orange Money";
    case "CARTE":
      return "Carte Bancaire";
    case "BANQUE":
      return "Banque";
    default:
      return mode?.trim() || "-";
  }
}

/**
 * Devise secondaire du reçu (colonne à côté de la base).
 * Priorité : quote du taux sélectionné, sinon devise reçue ≠ base, sinon CDF si base USD.
 */
export function resolveReceiptSecondaryCurrency(
  receivedCurrency?: ReceiptCurrency,
  baseCurrency: ReceiptCurrency = "USD",
  quoteCurrency?: ReceiptCurrency | null,
): ReceiptCurrency | null {
  if (quoteCurrency && quoteCurrency !== baseCurrency) {
    return quoteCurrency;
  }
  if (receivedCurrency && receivedCurrency !== baseCurrency) {
    return receivedCurrency;
  }
  if (baseCurrency === "USD") return "CDF";
  return null;
}

/** @deprecated Prefer resolveReceiptSecondaryCurrency */
export function resolveReceiptLocalCurrency(
  receivedCurrency?: FacturePaymentStudentData["receivedCurrency"],
  baseCurrency?: CurrencyCode | string,
): "CDF" | "AOA" {
  const secondary = resolveReceiptSecondaryCurrency(
    receivedCurrency,
    (baseCurrency as ReceiptCurrency) || "USD",
  );
  if (secondary === "AOA") return "AOA";
  return "CDF";
}

/** Format montant (CDF / AOA / USD) pour reçu PDF / preview. */
export function formatReceiptCurrency(
  amount: number,
  currency: ReceiptCurrency,
): string {
  if (currency === "USD") {
    return `$${Number(amount).toFixed(2)}`;
  }
  const rounded = Math.round(Number(amount) || 0);
  const withDots = String(Math.abs(rounded)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ".",
  );
  return `${rounded < 0 ? "-" : ""}${withDots} ${currency}`;
}

/** @deprecated Prefer formatReceiptCurrency */
export function formatReceiptLocal(
  amount: number,
  currency: "CDF" | "AOA",
): string {
  return formatReceiptCurrency(amount, currency);
}

/** @deprecated Prefer formatReceiptCurrency — conserve le style historique CDF. */
export function formatReceiptCdf(
  amountUsd: number,
  exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
): string {
  const montantCDF = amountUsd * exchangeRateUsdCdf;
  return formatReceiptCurrency(montantCDF, "CDF");
}

/** Somme des montants en devise de base (items.montant). */
export function sumReceiptUsd(items: FacturePaymentStudentData["items"]): number {
  return items.reduce((sum, item) => sum + Number(item.montant), 0);
}

export const sumReceiptBase = sumReceiptUsd;

export function sumReceiptSecondary(
  items: FacturePaymentStudentData["items"],
  secondaryCurrency: ReceiptCurrency,
  options: {
    exchangeRateUsdCdf?: number;
    receivedCurrency?: ReceiptCurrency;
    rates?: ExchangeRatePair[];
    baseCurrency?: ReceiptCurrency;
    selectedRate?: number | null;
  } = {},
): number {
  return items.reduce(
    (sum, item) =>
      sum +
      resolveItemSecondaryAmount(item, secondaryCurrency, options),
    0,
  );
}

/** @deprecated Prefer sumReceiptSecondary */
export function sumReceiptLocal(
  items: FacturePaymentStudentData["items"],
  currency: "CDF" | "AOA",
  exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
  receivedCurrency?: FacturePaymentStudentData["receivedCurrency"],
  rates?: ExchangeRatePair[],
  baseCurrency: CurrencyCode = CurrencyCode.USD,
): number {
  return sumReceiptSecondary(items, currency, {
    exchangeRateUsdCdf,
    receivedCurrency,
    rates,
    baseCurrency: baseCurrency as ReceiptCurrency,
  });
}

export function resolveItemSecondaryAmount(
  item: FacturePaymentStudentData["items"][number],
  secondaryCurrency: ReceiptCurrency,
  options: {
    exchangeRateUsdCdf?: number;
    receivedCurrency?: ReceiptCurrency;
    rates?: ExchangeRatePair[];
    baseCurrency?: ReceiptCurrency;
    selectedRate?: number | null;
  } = {},
): number {
  const {
    exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
    receivedCurrency,
    rates,
    baseCurrency = "USD",
    selectedRate,
  } = options;

  if (
    receivedCurrency === secondaryCurrency &&
    item.receivedAmount != null &&
    Number.isFinite(Number(item.receivedAmount))
  ) {
    return Number(item.receivedAmount);
  }

  const baseAmount = Number(item.montant) || 0;

  if (secondaryCurrency === baseCurrency) {
    return baseAmount;
  }

  if (rates?.length) {
    try {
      return convertAmount(
        baseAmount,
        baseCurrency as CurrencyCode,
        secondaryCurrency as CurrencyCode,
        rates,
        baseCurrency as CurrencyCode,
      );
    } catch {
      // fallback below
    }
  }

  if (
    selectedRate != null &&
    Number.isFinite(selectedRate) &&
    selectedRate > 0
  ) {
    return baseAmount * selectedRate;
  }

  if (baseCurrency === "USD" && secondaryCurrency === "CDF") {
    return baseAmount * exchangeRateUsdCdf;
  }

  if (baseCurrency === "CDF" && secondaryCurrency === "USD" && exchangeRateUsdCdf) {
    return exchangeRateUsdCdf > 0 ? baseAmount / exchangeRateUsdCdf : 0;
  }

  return 0;
}

/** @deprecated Prefer resolveItemSecondaryAmount */
export function resolveItemLocalAmount(
  item: FacturePaymentStudentData["items"][number],
  currency: "CDF" | "AOA",
  exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
  receivedCurrency?: FacturePaymentStudentData["receivedCurrency"],
  rates?: ExchangeRatePair[],
  baseCurrency: CurrencyCode = CurrencyCode.USD,
): number {
  return resolveItemSecondaryAmount(item, currency, {
    exchangeRateUsdCdf,
    receivedCurrency,
    rates,
    baseCurrency: baseCurrency as ReceiptCurrency,
  });
}

/** Bridge ancien `InvoiceProps` → payload reçu unifié. */
export function mapInvoicePropsToReceipt(
  props: InvoiceProps,
  extras?: {
    logoUrl?: string;
    exchangeRateUsdCdf?: number;
    sexe?: string;
    issuedPlace?: string;
    receivedCurrency?: FacturePaymentStudentData["receivedCurrency"];
    baseCurrency?: ReceiptCurrency;
    quoteCurrency?: ReceiptCurrency | null;
    selectedRate?: number | null;
  },
): FacturePaymentStudentData {
  return {
    invoiceNumber: props.invoiceNumber,
    sender: {
      name: props.schoolName || "Établissement",
      address: [props.schoolAddress, props.schoolContact, props.schoolEmail]
        .map((p) => p?.trim())
        .filter(Boolean)
        .join(" · "),
    },
    recipient: {
      name: props.studentName,
      class: props.fees[0]?.className || "-",
      sexe: extras?.sexe || "-",
    },
    items: props.fees.map((fee) => ({
      description: fee.nameFrais,
      price: Number(fee.amountPaid),
      mode: "ESPECES",
      montant: Number(fee.amountPaid),
      classe: fee.className || "",
      codeClasse: "",
    })),
    logoUrl: extras?.logoUrl ?? "",
    exchangeRateUsdCdf:
      extras?.exchangeRateUsdCdf ?? DEFAULT_EXCHANGE_RATE_USD_CDF,
    issuedPlace: extras?.issuedPlace,
    receivedCurrency: extras?.receivedCurrency ?? extras?.baseCurrency ?? "USD",
    baseCurrency: extras?.baseCurrency ?? "USD",
    quoteCurrency: extras?.quoteCurrency ?? undefined,
    selectedRate: extras?.selectedRate ?? undefined,
  };
}

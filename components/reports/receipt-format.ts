import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import type { FacturePaymentStudentData } from "@/components/FacturePaymentStudent";
import type { InvoiceProps } from "@/src/interfaces/Paiement";

export type ReceiptLocalCurrency = "CDF" | "AOA";

/** Devise locale a afficher a cote du USD (CDF / AOA). */
export function resolveReceiptLocalCurrency(
  receivedCurrency?: FacturePaymentStudentData["receivedCurrency"],
): ReceiptLocalCurrency {
  if (receivedCurrency === "AOA") return "AOA";
  return "CDF";
}

/** Format montant local (CDF ou AOA) pour recu PDF / preview. */
export function formatReceiptLocal(
  amount: number,
  currency: ReceiptLocalCurrency,
): string {
  const rounded = Math.round(Number(amount) || 0);
  return `${rounded.toLocaleString("fr-FR")} ${currency}`;
}

/** @deprecated Prefer formatReceiptLocal — conserve le style historique CDF. */
export function formatReceiptCdf(
  amountUsd: number,
  exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
): string {
  const montantCDF = amountUsd * exchangeRateUsdCdf;
  return formatReceiptLocal(montantCDF, "CDF");
}

export function sumReceiptUsd(items: FacturePaymentStudentData["items"]): number {
  return items.reduce((sum, item) => sum + Number(item.montant), 0);
}

export function sumReceiptLocal(
  items: FacturePaymentStudentData["items"],
  currency: ReceiptLocalCurrency,
  exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
  receivedCurrency?: FacturePaymentStudentData["receivedCurrency"],
): number {
  return items.reduce(
    (sum, item) =>
      sum +
      resolveItemLocalAmount(
        item,
        currency,
        exchangeRateUsdCdf,
        receivedCurrency,
      ),
    0,
  );
}

export function resolveItemLocalAmount(
  item: FacturePaymentStudentData["items"][number],
  currency: ReceiptLocalCurrency,
  exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
  receivedCurrency?: FacturePaymentStudentData["receivedCurrency"],
): number {
  // Montant percu stocke uniquement si la devise du paiement = devise locale affichee
  if (
    (receivedCurrency === "CDF" || receivedCurrency === "AOA") &&
    receivedCurrency === currency &&
    item.receivedAmount != null &&
    Number.isFinite(Number(item.receivedAmount))
  ) {
    return Number(item.receivedAmount);
  }

  const usd = Number(item.montant) || 0;
  if (currency === "CDF") return usd * exchangeRateUsdCdf;
  // AOA sans montant percu : pas de taux PDF dedie
  return 0;
}

/** Bridge ancien `InvoiceProps` → payload reçu unifié (USD/CDF). */
export function mapInvoicePropsToReceipt(
  props: InvoiceProps,
  extras?: {
    logoUrl?: string;
    exchangeRateUsdCdf?: number;
    sexe?: string;
    issuedPlace?: string;
    receivedCurrency?: FacturePaymentStudentData["receivedCurrency"];
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
      statut: "VALIDE",
      montant: Number(fee.amountPaid),
    })),
    logoUrl: extras?.logoUrl ?? "",
    exchangeRateUsdCdf:
      extras?.exchangeRateUsdCdf ?? DEFAULT_EXCHANGE_RATE_USD_CDF,
    issuedPlace: extras?.issuedPlace,
    receivedCurrency: extras?.receivedCurrency ?? "USD",
  };
}

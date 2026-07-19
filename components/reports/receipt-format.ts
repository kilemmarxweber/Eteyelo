import { DEFAULT_EXCHANGE_RATE_USD_CDF } from "@/lib/reports/types";
import type { FacturePaymentStudentData } from "@/components/FacturePaymentStudent";
import type { InvoiceProps } from "@/src/interfaces/Paiement";

/** Format CDF aligné sur le PDF reçu (`FacturePaymentStudent`). */
export function formatReceiptCdf(
  amountUsd: number,
  exchangeRateUsdCdf = DEFAULT_EXCHANGE_RATE_USD_CDF,
): string {
  const montantCDF = amountUsd * exchangeRateUsdCdf;
  return `${(montantCDF / 1000).toFixed(0)} .000 CDF`;
}

export function sumReceiptUsd(items: FacturePaymentStudentData["items"]): number {
  return items.reduce((sum, item) => sum + Number(item.montant), 0);
}

/** Bridge ancien `InvoiceProps` → payload reçu unifié (USD/CDF). */
export function mapInvoicePropsToReceipt(
  props: InvoiceProps,
  extras?: {
    logoUrl?: string;
    exchangeRateUsdCdf?: number;
    sexe?: string;
    issuedPlace?: string;
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
  };
}

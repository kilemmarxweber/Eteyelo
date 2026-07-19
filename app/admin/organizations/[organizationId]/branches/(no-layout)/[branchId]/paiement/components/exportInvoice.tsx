import {
  generateFacturePaymentStudentPDF,
  type FacturePaymentStudentData,
} from "@/components/FacturePaymentStudent";
import { mapInvoicePropsToReceipt } from "@/components/reports/receipt-format";
import type { InvoiceProps } from "@/src/interfaces/Paiement";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";

function isReceiptPayload(
  data: InvoiceProps | FacturePaymentStudentData,
): data is FacturePaymentStudentData {
  return "sender" in data && "recipient" in data && "items" in data;
}

/**
 * PDF reçu aligné sur `FacturePaymentStudent` (USD / CDF).
 * Accepte l’ancien `InvoiceProps` ou le payload unifié.
 */
export async function generateInvoicePDF(
  data: InvoiceProps | FacturePaymentStudentData,
) {
  const receipt = isReceiptPayload(data)
    ? data
    : mapInvoicePropsToReceipt(data);

  const logoDataUrl = receipt.logoUrl
    ? await imageUrlToDataUrl(receipt.logoUrl)
    : null;

  generateFacturePaymentStudentPDF({
    ...receipt,
    logoUrl: logoDataUrl ?? "",
  });
}

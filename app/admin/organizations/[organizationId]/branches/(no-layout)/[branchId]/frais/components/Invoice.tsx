"use client";

import { SchoolBrandHeader } from "@/components/reports/SchoolBrandHeader";
import { ReceiptPreviewBody } from "@/components/reports/ReceiptPreviewBody";
import { mapInvoicePropsToReceipt } from "@/components/reports/receipt-format";
import { InvoiceProps } from "@/src/interfaces/Paiement";

/**
 * Aperçu HTML reçu (legacy props) — même corps que le flux unifié.
 * Préférer `ReceiptPreviewDialog` + `FacturePaymentStudentData` pour les nouveaux écrans.
 */
export function Invoice(props: InvoiceProps) {
  const data = mapInvoicePropsToReceipt(props);

  return (
    <div className="flex flex-col gap-4">
      <SchoolBrandHeader
        context={{
          schoolName: data.sender.name,
          address: data.sender.address || undefined,
          logoUrl: data.logoUrl ?? "",
        }}
      />
      <ReceiptPreviewBody data={data} />
    </div>
  );
}

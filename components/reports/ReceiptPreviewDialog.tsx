"use client";

import * as React from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import { ReceiptPreviewBody } from "@/components/reports/ReceiptPreviewBody";
import {
  type FacturePaymentStudentData,
  generateFacturePaymentStudentPDF,
} from "@/components/FacturePaymentStudent";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";

export type ReceiptPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FacturePaymentStudentData | null;
  /** Titre dialog (a11y). */
  title?: string;
  description?: string;
  /** Bandeau optionnel (ex. succès post-paiement). */
  banner?: React.ReactNode;
  issuedAt?: Date;
};

/**
 * Aperçu unifié reçu : post-paiement et historique « Voir reçu ».
 * Actions : Fermer / Imprimer (window.print) / Télécharger PDF.
 */
export function ReceiptPreviewDialog({
  open,
  onOpenChange,
  data,
  title = "Aperçu du reçu",
  description,
  banner,
  issuedAt,
}: ReceiptPreviewDialogProps) {
  const [downloading, setDownloading] = React.useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const logoDataUrl = data.logoUrl
        ? await imageUrlToDataUrl(data.logoUrl)
        : null;
      generateFacturePaymentStudentPDF({
        ...data,
        logoUrl: logoDataUrl ?? "",
      });
      toast.success("Reçu PDF généré avec succès");
    } catch {
      toast.error("Impossible de générer le PDF du reçu");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A5;
            margin: 8mm;
          }
          body * {
            visibility: hidden !important;
          }
          .receipt-print-area,
          .receipt-print-area * {
            visibility: visible !important;
          }
          .receipt-print-area {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          .receipt-print-hide {
            display: none !important;
          }
        }
      `}</style>

      <ReportPreviewDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={
          description ??
          (data
            ? `Reçu ${data.invoiceNumber} — aperçu avant impression`
            : undefined)
        }
        branding={
          data
            ? {
                schoolName: data.sender.name || "Établissement",
                address: data.sender.address || undefined,
                logoUrl: data.logoUrl ?? "",
              }
            : undefined
        }
        documentTitle={data ? "Reçu de paiement" : undefined}
        size="lg"
        contentClassName="receipt-print-area"
        actions={
          data ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="receipt-print-hide"
                onClick={handlePrint}
              >
                <Printer data-icon="inline-start" />
                Imprimer
              </Button>
              <Button
                type="button"
                className="receipt-print-hide"
                disabled={downloading}
                onClick={handleDownloadPdf}
              >
                <Download data-icon="inline-start" />
                Télécharger PDF
              </Button>
            </>
          ) : null
        }
      >
        {banner ? (
          <div className="receipt-print-hide">{banner}</div>
        ) : null}
        {data ? (
          <div ref={printRef}>
            <ReceiptPreviewBody data={data} issuedAt={issuedAt} />
          </div>
        ) : null}
      </ReportPreviewDialog>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { IconDownload, IconPrinter } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadPdfOutput,
  pdfOutputToBase64,
  printPdfOutput,
  revokePdfOutput,
  type PdfOutput,
} from "@/lib/pdf/pdf-engine";

type StorePdfResult =
  | { ok: true; pdfUrl: string }
  | { ok: false; message: string };

type DocumentPdfPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  pdfOutput: PdfOutput | null;
  documentId?: string;
  storeOnConfirm?: boolean;
  onStorePdf?: (input: {
    documentId: string;
    pdfBase64: string;
    baseName: string;
  }) => Promise<StorePdfResult>;
  onStored?: (pdfUrl: string) => void;
};

export function DocumentPdfPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  pdfOutput,
  documentId,
  storeOnConfirm = true,
  onStorePdf,
  onStored,
}: DocumentPdfPreviewDialogProps) {
  const [storing, setStoring] = useState(false);

  useEffect(() => {
    if (open) return;
    revokePdfOutput(pdfOutput);
  }, [open, pdfOutput]);

  async function handleStore() {
    if (!pdfOutput || !documentId || !onStorePdf) return;

    setStoring(true);
    try {
      const pdfBase64 = await pdfOutputToBase64(pdfOutput);
      const result = await onStorePdf({
        documentId,
        pdfBase64,
        baseName: pdfOutput.fileName.replace(/\.pdf$/i, ""),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("PDF enregistre");
      onStored?.(result.pdfUrl);
      onOpenChange(false);
    } finally {
      setStoring(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border bg-muted/30">
          {pdfOutput ? (
            <iframe
              title={title}
              src={pdfOutput.blobUrl}
              className="h-[min(70vh,720px)] w-full bg-white"
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Apercu indisponible
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              leftSection={<IconPrinter size={16} />}
              disabled={!pdfOutput}
              onClick={() => pdfOutput && printPdfOutput(pdfOutput)}
            >
              Imprimer
            </Button>
            <Button
              variant="outline"
              leftSection={<IconDownload size={16} />}
              disabled={!pdfOutput}
              onClick={() => pdfOutput && downloadPdfOutput(pdfOutput)}
            >
              Telecharger
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            {storeOnConfirm && documentId && onStorePdf ? (
              <Button
                loading={storing}
                disabled={!pdfOutput}
                onClick={() => void handleStore()}
              >
                Enregistrer le PDF
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

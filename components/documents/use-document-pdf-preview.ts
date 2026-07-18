"use client";

import { useCallback, useState } from "react";

import type { PdfOutput } from "@/lib/pdf/pdf-engine";
import { revokePdfOutput } from "@/lib/pdf/pdf-engine";

type PreviewState = {
  open: boolean;
  title: string;
  description?: string;
  pdfOutput: PdfOutput | null;
  documentId?: string;
};

const INITIAL_PREVIEW: PreviewState = {
  open: false,
  title: "",
  pdfOutput: null,
};

export function useDocumentPdfPreview() {
  const [preview, setPreview] = useState<PreviewState>(INITIAL_PREVIEW);

  const openPreview = useCallback((next: Omit<PreviewState, "open">) => {
    setPreview({ ...next, open: true });
  }, []);

  const closePreview = useCallback((current?: PreviewState) => {
    revokePdfOutput(current?.pdfOutput ?? preview.pdfOutput);
    setPreview(INITIAL_PREVIEW);
  }, [preview.pdfOutput]);

  return {
    preview,
    openPreview,
    closePreview,
    setPreviewOpen: (open: boolean) => {
      if (!open) {
        closePreview();
        return;
      }
      setPreview((current) => ({ ...current, open: true }));
    },
  };
}

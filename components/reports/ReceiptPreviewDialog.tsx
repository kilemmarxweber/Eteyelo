"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import { ReceiptPreviewBody } from "@/components/reports/ReceiptPreviewBody";
import { SchoolBrandHeader } from "@/components/reports/SchoolBrandHeader";
import {
  type FacturePaymentStudentData,
  generateFacturePaymentStudentPDF,
} from "@/components/FacturePaymentStudent";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";

const TRANSPARENT_IMAGE_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const CAPTURE_OPTIONS = {
  cacheBust: true,
  pixelRatio: 3,
  backgroundColor: "#ffffff",
  skipFonts: true,
  imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
  onImageErrorHandler: () => undefined,
  style: {
    transform: "none",
    boxShadow: "none",
  },
} as const;

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
  /** Lance l'impression dès l'ouverture (après validation du paiement). */
  autoPrint?: boolean;
  /** Nombre d'exemplaires à imprimer (2 par défaut : parent + établissement). */
  printCopies?: number;
};

const DEFAULT_PRINT_COPIES = 2;

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

async function inlineImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:")) return;

      try {
        const response = await fetch(src);
        if (!response.ok) {
          img.src = TRANSPARENT_IMAGE_PLACEHOLDER;
          return;
        }

        const blob = await response.blob();
        img.src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        img.src = TRANSPARENT_IMAGE_PLACEHOLDER;
      }
    }),
  );
}

function ReceiptSheet({
  data,
  issuedAt,
}: {
  data: FacturePaymentStudentData;
  issuedAt?: Date;
}) {
  return (
    <div className="space-y-4 bg-white text-black">
      <SchoolBrandHeader
        context={{
          schoolName: data.sender.name || "Établissement",
          address: data.sender.address || undefined,
          logoUrl: data.logoUrl ?? "",
        }}
      />
      <ReceiptPreviewBody data={data} issuedAt={issuedAt} />
    </div>
  );
}

/**
 * Aperçu unifié reçu : post-paiement et historique « Voir reçu ».
 * Impression = capture HTML (comme la carte élève), pas le rendu navigateur partiel.
 */
export function ReceiptPreviewDialog({
  open,
  onOpenChange,
  data,
  title = "Aperçu du reçu",
  description,
  banner,
  issuedAt,
  autoPrint = false,
  printCopies = DEFAULT_PRINT_COPIES,
}: ReceiptPreviewDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const captureRef = React.useRef<HTMLDivElement>(null);
  const autoPrintedRef = React.useRef<string | null>(null);
  const copies = Math.max(1, Math.round(printCopies));

  React.useEffect(() => {
    setMounted(true);
  }, []);

  async function captureReceiptImage() {
    if (!captureRef.current) return null;

    await waitForImages(captureRef.current);
    await inlineImages(captureRef.current);
    await new Promise((resolve) => setTimeout(resolve, 220));

    const width = captureRef.current.offsetWidth || 640;
    const height = captureRef.current.offsetHeight || 900;

    const dataUrl = await toPng(captureRef.current, {
      ...CAPTURE_OPTIONS,
      width,
      height,
    });

    return { dataUrl, width, height };
  }

  async function handlePrint() {
    if (!data) return;

    setPrinting(true);
    try {
      let tries = 0;
      while (!captureRef.current && tries < 25) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        tries += 1;
      }

      const capture = await captureReceiptImage();
      if (!capture) return;

      const { dataUrl, width, height } = capture;
      const copiesHtml = Array.from({ length: copies }, (_, index) => `
        <section class="copy">
          <img src="${dataUrl}" alt="Reçu de paiement ${index + 1}/${copies}" />
        </section>
      `).join("");

      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const frameWindow = iframe.contentWindow;
      if (!frameWindow) {
        iframe.remove();
        toast.error("Impossible d'ouvrir la fenêtre d'impression.");
        return;
      }

      const cleanup = () => {
        iframe.remove();
      };

      frameWindow.document.open();
      frameWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Reçu ${data.invoiceNumber}</title>
    <style>
      @page {
        size: auto;
        margin: 10mm;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      .copy {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 8mm;
        page-break-after: always;
        break-after: page;
      }
      .copy:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      img {
        display: block;
        width: ${width}px;
        height: ${height}px;
        max-width: 100%;
        object-fit: contain;
      }
      @media print {
        .copy {
          padding: 0;
        }
        img {
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    ${copiesHtml}
    <script>
      function launchPrint() {
        window.focus();
        window.print();
      }
      const images = Array.from(document.images);
      let remaining = images.length;
      function onReady() {
        remaining -= 1;
        if (remaining <= 0) launchPrint();
      }
      if (!images.length) {
        launchPrint();
      } else {
        images.forEach(function (image) {
          if (image.complete) {
            onReady();
            return;
          }
          image.addEventListener("load", onReady);
          image.addEventListener("error", onReady);
        });
      }
    </script>
  </body>
</html>`);
      frameWindow.document.close();
      frameWindow.addEventListener("afterprint", cleanup);
      window.setTimeout(cleanup, 60_000);
      toast.success(
        copies > 1
          ? `Impression de ${copies} reçus lancée.`
          : "Impression du reçu lancée.",
      );
    } catch (error) {
      console.error("Receipt print failed:", error);
      toast.error("Impossible d'imprimer le reçu.");
    } finally {
      setPrinting(false);
    }
  }

  React.useEffect(() => {
    if (!open || !autoPrint || !data || !mounted) return;
    const invoiceNumber = data.invoiceNumber;
    if (autoPrintedRef.current === invoiceNumber) return;
    const timer = window.setTimeout(() => {
      autoPrintedRef.current = invoiceNumber;
      void handlePrint();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [open, autoPrint, data?.invoiceNumber, mounted, copies]);

  const handleDownloadPdf = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const logoDataUrl = data.logoUrl
        ? await imageUrlToDataUrl(data.logoUrl)
        : null;
      generateFacturePaymentStudentPDF(
        {
          ...data,
          logoUrl: logoDataUrl ?? "",
        },
        { copies },
      );
      toast.success("Reçu PDF généré avec succès");
    } catch {
      toast.error("Impossible de générer le PDF du reçu");
    } finally {
      setDownloading(false);
    }
  };

  const busy = downloading || printing;

  return (
    <>
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
        size="lg"
        actions={
          data ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void handlePrint()}
              >
                <Printer data-icon="inline-start" />
                {printing ? "Préparation..." : copies > 1 ? `Imprimer (${copies})` : "Imprimer"}
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void handleDownloadPdf()}
              >
                <Download data-icon="inline-start" />
                Télécharger PDF
              </Button>
            </>
          ) : null
        }
      >
        {banner ? <div>{banner}</div> : null}
        {data ? (
          <div className="rounded-md border bg-white p-4 shadow-sm">
            <ReceiptSheet data={data} issuedAt={issuedAt} />
          </div>
        ) : null}
      </ReportPreviewDialog>

      {mounted && data && open
        ? createPortal(
            <div
              aria-hidden
              className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] opacity-0"
            >
              <div
                ref={captureRef}
                className="w-[640px] bg-white p-6 text-black"
              >
                <ReceiptSheet data={data} issuedAt={issuedAt} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

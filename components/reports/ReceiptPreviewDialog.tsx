"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import { ReceiptPreviewBody } from "@/components/reports/ReceiptPreviewBody";
import { ReceiptPos80Body } from "@/components/reports/ReceiptPos80Body";
import { SchoolBrandHeader } from "@/components/reports/SchoolBrandHeader";
import {
  parseReceiptPrintFormat,
  type ReceiptPrintFormat,
} from "@/components/reports/receipt-format";
import {
  type FacturePaymentStudentData,
  generateFacturePaymentStudentPDF,
} from "@/components/FacturePaymentStudent";
import { imageUrlToDataUrl } from "@/lib/reports/image-to-data-url";
import { cn } from "@/lib/utils";

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
    overflow: "visible",
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
  /** Exemplaires pour l'impression auto après validation (2 par défaut). */
  autoPrintCopies?: number;
  /** Exemplaires du bouton Imprimer / PDF (1 par défaut). */
  printCopies?: number;
};

const DEFAULT_PRINT_COPIES = 1;
const DEFAULT_AUTO_PRINT_COPIES = 2;
const A4_CAPTURE_WIDTH = 720;
const POS_CAPTURE_WIDTH = 302;

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

function ReceiptPosHeader({ data }: { data: FacturePaymentStudentData }) {
  const logoSrc = data.logoUrl?.trim() || undefined;
  return (
    <header className="flex flex-col items-center gap-1.5 text-center text-black">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" className="h-12 w-12 object-contain" />
      ) : null}
      <p className="text-sm font-bold leading-tight">
        {data.sender.name || "Établissement"}
      </p>
      {data.sender.address?.trim() ? (
        <p className="text-[10px] leading-snug text-black/65">
          {data.sender.address.trim()}
        </p>
      ) : null}
    </header>
  );
}

function ReceiptSheet({
  data,
  issuedAt,
  format,
}: {
  data: FacturePaymentStudentData;
  issuedAt?: Date;
  format: ReceiptPrintFormat;
}) {
  if (format === "POS_80MM") {
    return (
      <div className="space-y-2 bg-white text-black">
        <ReceiptPosHeader data={data} />
        <ReceiptPos80Body data={data} issuedAt={issuedAt} />
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-visible bg-white text-black">
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
  autoPrintCopies = DEFAULT_AUTO_PRINT_COPIES,
  printCopies = DEFAULT_PRINT_COPIES,
}: ReceiptPreviewDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const [format, setFormat] = React.useState<ReceiptPrintFormat>(
    parseReceiptPrintFormat(data?.receiptPrintFormat),
  );
  const captureRef = React.useRef<HTMLDivElement>(null);
  const autoPrintedRef = React.useRef<string | null>(null);
  const buttonCopies = Math.max(1, Math.round(printCopies));
  const automaticCopies = Math.max(1, Math.round(autoPrintCopies));
  const isPos = format === "POS_80MM";

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setFormat(parseReceiptPrintFormat(data?.receiptPrintFormat));
  }, [open, data?.invoiceNumber, data?.receiptPrintFormat]);

  async function captureReceiptImage() {
    if (!captureRef.current) return null;

    await waitForImages(captureRef.current);
    await inlineImages(captureRef.current);
    await new Promise((resolve) => setTimeout(resolve, 220));

    const node = captureRef.current;
    const width = Math.ceil(
      Math.max(node.scrollWidth, node.offsetWidth, isPos ? POS_CAPTURE_WIDTH : A4_CAPTURE_WIDTH),
    );
    const height = Math.ceil(
      Math.max(node.scrollHeight, node.offsetHeight, 1),
    );

    const dataUrl = await toPng(node, {
      ...CAPTURE_OPTIONS,
      width,
      height,
      style: {
        ...CAPTURE_OPTIONS.style,
        width: `${width}px`,
        height: `${height}px`,
        overflow: "visible",
      },
    });

    return { dataUrl, width, height };
  }

  const printReceipt = React.useCallback(
    async (copyCount: number) => {
      if (!data) return;
      const count = Math.max(1, Math.round(copyCount));

      setPrinting(true);
      try {
        let tries = 0;
        while (!captureRef.current && tries < 25) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          tries += 1;
        }

        const capture = await captureReceiptImage();
        if (!capture) return;

        const { dataUrl } = capture;
        const copiesHtml = Array.from({ length: count }, (_, index) => `
        <section class="copy">
          <img src="${dataUrl}" alt="Reçu de paiement ${index + 1}/${count}" />
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

        const pageCss = isPos
          ? `@page { size: 80mm auto; margin: 0; }`
          : `@page { size: A4; margin: 10mm; }`;
        const copyCss = isPos
          ? `.copy {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        width: 100%;
        margin: 0 auto;
        padding: 2mm 0;
        page-break-after: always;
        break-after: page;
      }`
          : `.copy {
        display: block;
        padding: 4mm;
        page-break-after: always;
        break-after: page;
      }`;
        const imgCss = isPos
          ? `img {
        display: block;
        margin: 0 auto;
        width: 76mm;
        max-width: 76mm;
        height: auto;
      }`
          : `img { display: block; width: 100%; height: auto; max-width: 100%; }`;

        frameWindow.document.open();
        frameWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Reçu ${data.invoiceNumber}</title>
    <style>
      ${pageCss}
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        background: #ffffff;
        overflow: visible;
        ${isPos ? "text-align: center;" : ""}
      }
      ${copyCss}
      .copy:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      ${imgCss}
      @media print {
        html, body {
          overflow: visible !important;
          ${isPos ? "width: 100%; text-align: center;" : ""}
        }
        .copy {
          padding: ${isPos ? "2mm 0" : "0"};
          ${isPos ? "display: flex; justify-content: center; width: 100%;" : ""}
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
          count > 1
            ? `Impression de ${count} reçus lancée.`
            : "Impression du reçu lancée.",
        );
      } catch (error) {
        console.error("Receipt print failed:", error);
        toast.error("Impossible d'imprimer le reçu.");
      } finally {
        setPrinting(false);
      }
    },
    [data, isPos],
  );

  React.useEffect(() => {
    if (!open || !autoPrint || !data || !mounted) return;
    const invoiceNumber = data.invoiceNumber;
    if (autoPrintedRef.current === invoiceNumber) return;
    const timer = window.setTimeout(() => {
      autoPrintedRef.current = invoiceNumber;
      void printReceipt(automaticCopies);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [open, autoPrint, data, mounted, automaticCopies, printReceipt]);

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
          receiptPrintFormat: format,
        },
        { copies: buttonCopies, format },
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
        size={isPos ? "md" : "lg"}
        actions={
          data ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void printReceipt(buttonCopies)}
              >
                <Printer data-icon="inline-start" />
                {printing ? "Préparation..." : "Imprimer"}
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
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 px-3 py-2.5">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Modèle de reçu
              </p>
              <RadioGroup
                className="grid gap-2 sm:grid-cols-2"
                value={format}
                onValueChange={(value) =>
                  setFormat(parseReceiptPrintFormat(value))
                }
              >
                <Label
                  htmlFor="receipt-format-a4"
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm font-normal",
                    format === "A4" && "border-primary",
                  )}
                >
                  <RadioGroupItem id="receipt-format-a4" value="A4" />
                  <span>
                    <span className="block font-medium">A4 — tableau</span>
                    <span className="block text-xs text-muted-foreground">
                      Format actuel, imprimante feuille
                    </span>
                  </span>
                </Label>
                <Label
                  htmlFor="receipt-format-pos"
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm font-normal",
                    format === "POS_80MM" && "border-primary",
                  )}
                >
                  <RadioGroupItem id="receipt-format-pos" value="POS_80MM" />
                  <span>
                    <span className="block font-medium">POS 80 mm</span>
                    <span className="block text-xs text-muted-foreground">
                      Ticket thermique caisse
                    </span>
                  </span>
                </Label>
              </RadioGroup>
            </div>
            <div
              className={cn(
                "rounded-md border bg-white p-4 shadow-sm",
                isPos && "mx-auto w-[80mm] p-2",
              )}
            >
              <ReceiptSheet data={data} issuedAt={issuedAt} format={format} />
            </div>
          </div>
        ) : null}
      </ReportPreviewDialog>

      {mounted && data && open
        ? createPortal(
            <div
              aria-hidden
              className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] overflow-visible opacity-0"
            >
              <div
                ref={captureRef}
                className={cn(
                  "overflow-visible bg-white text-black",
                  isPos ? "w-[80mm] p-2" : "w-[720px] p-6",
                )}
              >
                <ReceiptSheet data={data} issuedAt={issuedAt} format={format} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

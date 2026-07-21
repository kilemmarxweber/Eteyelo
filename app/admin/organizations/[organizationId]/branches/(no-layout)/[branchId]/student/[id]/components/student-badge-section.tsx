"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { Download, IdCard, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { StudentBadgeData } from "@/lib/student-badge";
import { StudentBadgeCard } from "./student-badge-card";
import type { StudentPhotoUploadState } from "./use-student-photo-upload";
import { useBranchPeopleLabels } from "@/hooks/use-branch-people-labels";

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Erreur inconnue";
  }
}

type StudentBadgeSectionProps = {
  badge: StudentBadgeData;
  upload?: StudentPhotoUploadState;
};

export type StudentBadgeSectionHandle = {
  print: () => Promise<void>;
};

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

export const StudentBadgeSection = React.forwardRef<
  StudentBadgeSectionHandle,
  StudentBadgeSectionProps
>(function StudentBadgeSection({ badge, upload }, ref) {
  const peopleLabels = useBranchPeopleLabels();
  const badgeRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  async function captureBadgeImage() {
    if (!badgeRef.current) return null;

    await waitForImages(badgeRef.current);
    await inlineImages(badgeRef.current);
    await new Promise((resolve) => setTimeout(resolve, 220));

    const cardWidth = badgeRef.current.offsetWidth || 260;
    const cardHeight = badgeRef.current.offsetHeight || 420;

    const dataUrl = await toPng(badgeRef.current, {
      ...CAPTURE_OPTIONS,
      width: cardWidth,
      height: cardHeight,
    });

    return { dataUrl, cardWidth, cardHeight };
  }

  async function handleDownload() {
    if (!badgeRef.current) return;

    setDownloading(true);
    try {
      const capture = await captureBadgeImage();
      if (!capture) return;

      const link = document.createElement("a");
      link.download = `carte-${badge.lastName}-${badge.firstName}-${badge.yearCode}.png`;
      link.href = capture.dataUrl;
      link.click();
      toast.success("Carte telechargee.");
    } catch (error) {
      console.error("Student badge download failed:", getErrorMessage(error), error);
      toast.error("Impossible de telecharger la carte.");
    } finally {
      setDownloading(false);
    }
  }

  async function handlePrint() {
    if (!badgeRef.current) return;

    setPrinting(true);
    try {
      const capture = await captureBadgeImage();
      if (!capture) return;

      const { dataUrl, cardWidth, cardHeight } = capture;
      const printWindow = window.open("", "_blank", "width=800,height=900");

      if (!printWindow) {
        toast.error("Impossible d'ouvrir la fenetre d'impression.");
        return;
      }

      printWindow.document.open();
      printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Carte ${peopleLabels.studentLower} - ${badge.fullName}</title>
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
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        display: block;
        width: ${cardWidth}px;
        height: ${cardHeight}px;
        max-width: 100%;
        object-fit: contain;
      }
      @media print {
        body {
          min-height: auto;
        }
        img {
          width: ${cardWidth}px;
          height: ${cardHeight}px;
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <img id="student-card-print" src="${dataUrl}" alt="Carte ${peopleLabels.studentLower}" />
    <script>
      const image = document.getElementById("student-card-print");
      function launchPrint() {
        window.focus();
        window.print();
      }
      image.addEventListener("load", launchPrint);
      if (image.complete) launchPrint();
      window.addEventListener("afterprint", function () {
        window.close();
      });
    </script>
  </body>
</html>`);
      printWindow.document.close();
      toast.success("Impression de la carte lancee.");
    } catch (error) {
      console.error("Student badge print failed:", getErrorMessage(error), error);
      toast.error("Impossible d'imprimer la carte.");
    } finally {
      setPrinting(false);
    }
  }

  const busy = downloading || printing;

  React.useImperativeHandle(ref, () => ({
    print: handlePrint,
  }));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IdCard className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Carte d&apos;{peopleLabels.studentLower}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy}
            onClick={handleDownload}
            aria-label="Telecharger la carte"
          >
            <Download className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy}
            onClick={() => void handlePrint()}
            aria-label="Imprimer la carte"
          >
            <Printer className="size-4" />
          </Button>
        </div>
      </div>

      <StudentBadgeCard badge={badge} preview upload={upload} />

      {mounted
        ? createPortal(
            <div
              aria-hidden
              className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] opacity-0"
            >
              <StudentBadgeCard ref={badgeRef} badge={badge} upload={upload} />
            </div>,
            document.body,
          )
        : null}

      <Button
        type="button"
        variant="outline"
        className="mt-4 w-full gap-2"
        disabled={busy}
        onClick={() => void handlePrint()}
      >
        <Printer className="size-4" />
        {printing ? "Preparation de l'impression..." : "Imprimer la carte"}
      </Button>
    </div>
  );
});

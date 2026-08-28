"use client";

import { useEffect, useId, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

type UploadedPdfReaderInnerProps = {
  fileUrl: string;
  readerId?: string;
  className?: string;
};

export function UploadedPdfReaderInner({
  fileUrl,
  readerId,
  className,
}: UploadedPdfReaderInnerProps) {
  const reactId = useId().replace(/:/g, "");
  const fullscreenId = `pdf-reader-${readerId ?? reactId}`;
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.05);
  const [error, setError] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);

  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    setWorkerReady(true);
  }, []);

  useEffect(() => {
    setPage(1);
    setError(null);
  }, [fileUrl]);

  if (!workerReady) {
    return (
      <div
        className={cn(
          "flex min-h-[360px] items-center justify-center gap-2 rounded-xl border bg-card text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        Préparation du lecteur…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums">
            {numPages ? `${page} / ${numPages}` : "—"}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!numPages || page >= numPages}
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setScale((s) => Math.max(0.7, s - 0.15))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setScale((s) => Math.min(2.2, s + 0.15))}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              const el = document.getElementById(fullscreenId);
              void el?.requestFullscreen?.();
            }}
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>

      <div
        id={fullscreenId}
        className="flex max-h-[60vh] min-h-[360px] justify-center overflow-auto bg-muted/20 p-4"
      >
        {error ? (
          <p className="self-center text-sm text-destructive">{error}</p>
        ) : (
          <Document
            file={fileUrl}
            loading={
              <div className="flex items-center gap-2 self-center text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Chargement du PDF…
              </div>
            }
            onLoadSuccess={({ numPages: pages }) => {
              setNumPages(pages);
              setError(null);
            }}
            onLoadError={() =>
              setError("Impossible de charger le PDF. Réessayez plus tard.")
            }
          >
            <Page
              pageNumber={page}
              scale={scale}
              renderTextLayer
              renderAnnotationLayer={false}
            />
          </Document>
        )}
      </div>
    </div>
  );
}

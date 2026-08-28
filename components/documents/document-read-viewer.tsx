"use client";

import dynamic from "next/dynamic";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const UploadedPdfReaderInner = dynamic(
  () =>
    import("./uploaded-pdf-reader-inner").then(
      (mod) => mod.UploadedPdfReaderInner,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[360px] items-center justify-center gap-2 rounded-xl border bg-card text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement du lecteur PDF…
      </div>
    ),
  },
);

function isPdfUrl(url: string) {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  return path.endsWith(".pdf") || path.includes("/pdf");
}

function fileNameFromUrl(url: string, fallback: string) {
  try {
    const path = url.split("?")[0] ?? url;
    const name = path.split("/").pop();
    if (!name) return fallback;
    return decodeURIComponent(name);
  } catch {
    return fallback;
  }
}

type DocumentReadViewerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fileUrl: string;
  /** Remplacer le fichier — réservé au propriétaire. */
  canReplace?: boolean;
  onReplaceFile?: (file: File) => void;
  replacing?: boolean;
};

export function DocumentReadViewer({
  open,
  onOpenChange,
  title,
  fileUrl,
  canReplace = false,
  onReplaceFile,
  replacing = false,
}: DocumentReadViewerProps) {
  const pdf = isPdfUrl(fileUrl);
  const fileName = fileNameFromUrl(fileUrl, title);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        className="flex max-h-[min(94dvh,52rem)] w-[min(calc(100vw-1rem),56rem)] flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left sm:px-5">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="truncate">
            Lecture seule · {fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {pdf ? (
            <UploadedPdfReaderInner fileUrl={fileUrl} readerId={fileName} />
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-6 text-center">
              <FileText className="size-10 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  Aperçu intégré indisponible pour ce format. Ouvrez ou
                  téléchargez le document.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 size-4" />
                  Ouvrir
                </a>
              </Button>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-5",
          )}
        >
          {canReplace && onReplaceFile ? (
            <label className="inline-flex cursor-pointer">
              <Button asChild variant="outline" size="sm" disabled={replacing}>
                <span>
                  {replacing ? "Remplacement…" : "Remplacer (propriétaire)"}
                </span>
              </Button>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={replacing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onReplaceFile(file);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
          <Button asChild size="sm">
            <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 size-4" />
              Télécharger
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

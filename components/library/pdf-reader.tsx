"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const PdfReaderInner = dynamic(
  () => import("./pdf-reader-inner").then((mod) => mod.PdfReaderInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm text-muted-foreground shadow-sm">
        <Loader2 className="size-4 animate-spin" />
        Chargement du lecteur PDF…
      </div>
    ),
  },
);

type PdfReaderProps = {
  bookId: string;
  className?: string;
};

/** Lecteur PDF : chargé uniquement dans le navigateur (évite le warning pdfjs legacy sous Node). */
export function PdfReader({ bookId, className }: PdfReaderProps) {
  return (
    <div className={cn(className)}>
      <PdfReaderInner bookId={bookId} />
    </div>
  );
}

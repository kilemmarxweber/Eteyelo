"use client";

import { useState } from "react";
import { ReactReader } from "react-reader";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type EpubReaderProps = {
  bookId: string;
  className?: string;
};

export function EpubReader({ bookId, className }: EpubReaderProps) {
  const [location, setLocation] = useState<string | number>(0);
  const [ready, setReady] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {!ready ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Chargement de l&apos;EPUB…
        </div>
      ) : null}
      <div className="h-[75vh] min-h-[420px]">
        <ReactReader
          url={`/api/library/${bookId}/file`}
          location={location}
          locationChanged={(loc) => setLocation(loc)}
          getRendition={() => setReady(true)}
          epubOptions={{
            allowPopups: false,
            allowScriptedContent: false,
          }}
        />
      </div>
    </div>
  );
}

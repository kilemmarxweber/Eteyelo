"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { renderFormulaHtml } from "@/lib/online-assignments/formula";

import "katex/dist/katex.min.css";

type Props = {
  source: string;
  className?: string;
  emptyLabel?: string;
};

/** Affiche texte + formules `$...$` / `$$...$$` via KaTeX. */
export function FormulaPreview({
  source,
  className,
  emptyLabel = "Aperçu…",
}: Props) {
  const html = useMemo(() => renderFormulaHtml(source || ""), [source]);

  if (!source.trim()) {
    return (
      <p className={cn("text-sm italic text-muted-foreground", className)}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none overflow-x-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-foreground dark:bg-muted/20",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, "<br/>") }}
    />
  );
}

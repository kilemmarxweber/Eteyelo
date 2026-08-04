"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { renderFormulaHtml } from "@/lib/online-assignments/formula";

const EXAMPLE_SOURCE =
  "Calculez √(9) et la fraction $\\frac{3}{4}$. Équilibrez H₂ + O₂ → H₂O.";

type Props = {
  source: string;
  className?: string;
  emptyLabel?: string;
  showExampleWhenEmpty?: boolean;
};

/** Affiche texte + formules `$...$` (MathML) et symboles unicode (√, ×…). */
export function FormulaPreview({
  source,
  className,
  emptyLabel = "Aperçu…",
  showExampleWhenEmpty = false,
}: Props) {
  const trimmed = source?.trim() ?? "";
  const html = useMemo(
    () => renderFormulaHtml(trimmed ? source : ""),
    [source, trimmed],
  );
  const exampleHtml = useMemo(() => renderFormulaHtml(EXAMPLE_SOURCE), []);

  if (!trimmed) {
    if (showExampleWhenEmpty) {
      return (
        <div
          className={cn(
            "flex flex-col gap-2 overflow-x-auto rounded-md border border-dashed border-border bg-muted/20 px-3 py-2.5 dark:bg-muted/10",
            className,
          )}
        >
          <p className="text-xs italic text-muted-foreground">{emptyLabel}</p>
          <div
            className="formula-preview text-sm leading-relaxed text-muted-foreground/90 opacity-80 [&_math]:text-[1.1em]"
            dangerouslySetInnerHTML={{
              __html: exampleHtml.replace(/\n/g, "<br/>"),
            }}
          />
        </div>
      );
    }

    return (
      <p className={cn("text-sm italic text-muted-foreground", className)}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "formula-preview overflow-x-auto rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm leading-relaxed text-foreground dark:bg-muted/20 [&_math]:text-[1.1em]",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, "<br/>") }}
    />
  );
}

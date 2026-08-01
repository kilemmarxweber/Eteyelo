"use client";

import { useRef } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { FormulaPreview } from "./formula-preview";
import {
  FormulaToolbar,
  selectionAfterFormulaInsert,
} from "./formula-toolbar";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
};

/**
 * Éditeur d’énoncé simple : textarea + barre de symboles + aperçu.
 */
export function StatementFormulaEditor({
  value,
  onChange,
  label = "Énoncé",
  className,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const sel = selectionAfterFormulaInsert(snippet, start);
      el.setSelectionRange(sel.start, sel.end);
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-card/40 p-3 dark:bg-card/20",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label className="text-sm font-semibold">{label}</Label>
        <p className="text-[11px] text-muted-foreground">
          Écrivez normalement, cliquez un symbole pour l’insérer
        </p>
      </div>

      <FormulaToolbar variant="full" onInsert={insertAtCursor} />

      <div className="grid gap-3 md:grid-cols-2 md:items-stretch">
        <div className="flex min-h-0 flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Saisie
          </span>
          <Textarea
            ref={textareaRef}
            className="min-h-[148px] flex-1 resize-y bg-background text-sm leading-relaxed"
            placeholder="Ex. Calculez √(9) + ∛(8), puis la fraction…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Aperçu élève
          </span>
          <FormulaPreview
            source={value}
            className="min-h-[148px] flex-1 border-primary/15 bg-background shadow-sm"
            emptyLabel="L’aperçu apparaîtra ici dès que vous saisissez l’énoncé."
            showExampleWhenEmpty
          />
        </div>
      </div>
    </div>
  );
}

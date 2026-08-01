"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Snippet = { label: string; insert: string; title: string };

/**
 * Symboles lisibles (unicode). Le curseur se place dans () ou || après insert.
 * Fractions / exposants complexes : petit LaTeX `$…$` pour l’aperçu MathML.
 */
const MATH_SNIPPETS: Snippet[] = [
  { label: "a⁄b", insert: "$\\frac{a}{b}$", title: "Fraction" },
  { label: "√x", insert: "√()", title: "Racine carrée — tapez la valeur entre ( )" },
  { label: "∛x", insert: "∛()", title: "Racine cubique — tapez la valeur entre ( )" },
  {
    label: "ⁿ√x",
    insert: "ⁿ√()",
    title: "Racine n-ième — remplacez ⁿ puis la valeur",
  },
  { label: "x²", insert: "()²", title: "Au carré" },
  { label: "xⁿ", insert: "$x^{n}$", title: "Exposant" },
  { label: "xₙ", insert: "$x_{n}$", title: "Indice" },
  { label: "|x|", insert: "||", title: "Valeur absolue" },
  { label: "( )", insert: "()", title: "Parenthèses" },
  { label: "+", insert: "+", title: "Plus" },
  { label: "−", insert: "−", title: "Moins" },
  { label: "±", insert: "±", title: "Plus ou moins" },
  { label: "×", insert: "×", title: "Multiplication" },
  { label: "÷", insert: "÷", title: "Division" },
  { label: "·", insert: "·", title: "Point médian" },
  { label: "≠", insert: "≠", title: "Différent" },
  { label: "≈", insert: "≈", title: "Environ égal" },
  { label: "≤", insert: "≤", title: "Inférieur ou égal" },
  { label: "≥", insert: "≥", title: "Supérieur ou égal" },
  { label: "<", insert: "<", title: "Inférieur" },
  { label: ">", insert: ">", title: "Supérieur" },
  { label: "=", insert: "=", title: "Égal" },
  { label: "π", insert: "π", title: "Pi" },
  { label: "∞", insert: "∞", title: "Infini" },
  { label: "°", insert: "°", title: "Degré" },
  { label: "%", insert: "%", title: "Pourcentage" },
  { label: "∑", insert: "∑", title: "Somme" },
  { label: "∫", insert: "∫", title: "Intégrale" },
  { label: "α", insert: "α", title: "Alpha" },
  { label: "β", insert: "β", title: "Bêta" },
  { label: "θ", insert: "θ", title: "Thêta" },
  { label: "λ", insert: "λ", title: "Lambda" },
  { label: "sin", insert: "sin()", title: "Sinus" },
  { label: "cos", insert: "cos()", title: "Cosinus" },
  { label: "tan", insert: "tan()", title: "Tangente" },
  { label: "log", insert: "log()", title: "Logarithme" },
  { label: "ln", insert: "ln()", title: "Logarithme népérien" },
  { label: "∈", insert: "∈", title: "Appartient à" },
  { label: "∅", insert: "∅", title: "Ensemble vide" },
];

const CHEM_SNIPPETS: Snippet[] = [
  { label: "H₂O", insert: "H₂O", title: "Eau" },
  { label: "CO₂", insert: "CO₂", title: "Dioxyde de carbone" },
  { label: "O₂", insert: "O₂", title: "Dioxygène" },
  { label: "N₂", insert: "N₂", title: "Diazote" },
  { label: "H₂", insert: "H₂", title: "Dihydrogène" },
  { label: "NH₃", insert: "NH₃", title: "Ammoniac" },
  { label: "CH₄", insert: "CH₄", title: "Méthane" },
  { label: "NaCl", insert: "NaCl", title: "Chlorure de sodium" },
  { label: "HCl", insert: "HCl", title: "Acide chlorhydrique" },
  { label: "NaOH", insert: "NaOH", title: "Soude" },
  { label: "H₂SO₄", insert: "H₂SO₄", title: "Acide sulfurique" },
  { label: "CaCO₃", insert: "CaCO₃", title: "Carbonate de calcium" },
  { label: "H⁺", insert: "H⁺", title: "Ion hydrogène" },
  { label: "OH⁻", insert: "OH⁻", title: "Ion hydroxyde" },
  { label: "→", insert: " → ", title: "Flèche réaction" },
  { label: "⇌", insert: " ⇌ ", title: "Équilibre" },
  { label: "↔", insert: " ↔ ", title: "Flèche double" },
  { label: "↑", insert: "↑", title: "Gaz (dégagement)" },
  { label: "↓", insert: "↓", title: "Précipité" },
  { label: "Δ", insert: "Δ", title: "Chaleur / delta" },
  { label: "(aq)", insert: "(aq)", title: "En solution aqueuse" },
  { label: "(g)", insert: "(g)", title: "Gazeux" },
  { label: "(s)", insert: "(s)", title: "Solide" },
  { label: "(l)", insert: "(l)", title: "Liquide" },
  { label: "+", insert: " + ", title: "Plus" },
  { label: "−", insert: " − ", title: "Moins" },
  { label: "⁺", insert: "⁺", title: "Charge positive" },
  { label: "⁻", insert: "⁻", title: "Charge négative" },
];

const COMPACT_MATH = 12;
const COMPACT_CHEM = 8;

type Props = {
  onInsert: (snippet: string) => void;
  variant?: "full" | "compact";
  className?: string;
};

function SnippetRow({
  label,
  snippets,
  onInsert,
  buttonVariant,
}: {
  label: string;
  snippets: Snippet[];
  onInsert: (snippet: string) => void;
  buttonVariant: "secondary" | "outline";
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {snippets.map((s) => (
        <Tooltip key={`${s.title}-${s.insert}-${s.label}`}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={buttonVariant}
              className="h-7 min-w-7 px-2 font-normal tabular-nums"
              onClick={() => onInsert(s.insert)}
            >
              {s.label}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{s.title}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function FormulaToolbar({
  onInsert,
  variant = "full",
  className,
}: Props) {
  const [open, setOpen] = useState(true);
  const isCompact = variant === "compact";
  const showAll = isCompact || open;

  const math = showAll
    ? isCompact
      ? MATH_SNIPPETS.slice(0, COMPACT_MATH)
      : MATH_SNIPPETS
    : MATH_SNIPPETS.slice(0, 10);
  const chem = showAll
    ? isCompact
      ? CHEM_SNIPPETS.slice(0, COMPACT_CHEM)
      : CHEM_SNIPPETS
    : CHEM_SNIPPETS.slice(0, 6);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "rounded-lg border border-border/80 bg-muted/30 dark:bg-muted/15",
          className,
        )}
      >
        {variant === "full" ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <span className="font-medium text-foreground/80">
              Symboles maths & chimie
            </span>
            {open ? (
              <ChevronUp className="size-3.5 shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0" />
            )}
          </button>
        ) : null}

        <div
          className={cn(
            "flex flex-col gap-2 p-2",
            variant === "full" && "border-t border-border/60",
          )}
        >
          <SnippetRow
            label="Maths"
            snippets={math}
            onInsert={onInsert}
            buttonVariant="secondary"
          />
          <SnippetRow
            label="Chimie"
            snippets={chem}
            onInsert={onInsert}
            buttonVariant="outline"
          />
          {showAll ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Cliquez √ : le symbole s’insère, tapez la valeur entre les
              parenthèses — ex. <code className="text-[10px]">√(9)</code>
            </p>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

/** Place le curseur dans `()`, `||`, ou sélectionne le 1er placeholder `{a}`. */
export function selectionAfterFormulaInsert(
  snippet: string,
  insertStart: number,
): { start: number; end: number } {
  const emptyParen = snippet.indexOf("()");
  if (emptyParen >= 0) {
    const pos = insertStart + emptyParen + 1;
    return { start: pos, end: pos };
  }
  if (snippet === "||") {
    const pos = insertStart + 1;
    return { start: pos, end: pos };
  }
  const match = /\{([a-z]|n)\}/.exec(snippet);
  if (match && match.index != null) {
    const start = insertStart + match.index + 1;
    return { start, end: start + match[1].length };
  }
  const end = insertStart + snippet.length;
  return { start: end, end };
}

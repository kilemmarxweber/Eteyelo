"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MATH_SNIPPETS: Array<{ label: string; insert: string; title: string }> = [
  { label: "a/b", insert: "$\\frac{a}{b}$", title: "Fraction" },
  { label: "√", insert: "$\\sqrt{x}$", title: "Racine" },
  { label: "x²", insert: "$x^{2}$", title: "Exposant" },
  { label: "xₙ", insert: "$x_{n}$", title: "Indice" },
  { label: "±", insert: "$\\pm$", title: "Plus ou moins" },
  { label: "×", insert: "$\\times$", title: "Multiplication" },
  { label: "÷", insert: "$\\div$", title: "Division" },
  { label: "≠", insert: "$\\neq$", title: "Différent" },
  { label: "≤", insert: "$\\leq$", title: "Inférieur ou égal" },
  { label: "≥", insert: "$\\geq$", title: "Supérieur ou égal" },
  { label: "π", insert: "$\\pi$", title: "Pi" },
  { label: "∞", insert: "$\\infty$", title: "Infini" },
  { label: "∑", insert: "$\\sum$", title: "Somme" },
  { label: "∫", insert: "$\\int$", title: "Intégrale" },
];

const CHEM_SNIPPETS: Array<{ label: string; insert: string; title: string }> = [
  { label: "H₂O", insert: "$\\mathrm{H_2O}$", title: "Eau" },
  { label: "CO₂", insert: "$\\mathrm{CO_2}$", title: "Dioxyde de carbone" },
  { label: "O₂", insert: "$\\mathrm{O_2}$", title: "Dioxygène" },
  { label: "NaCl", insert: "$\\mathrm{NaCl}$", title: "Chlorure de sodium" },
  { label: "H₂SO₄", insert: "$\\mathrm{H_2SO_4}$", title: "Acide sulfurique" },
  { label: "→", insert: "$\\rightarrow$", title: "Flèche réaction" },
  { label: "⇌", insert: "$\\rightleftharpoons$", title: "Équilibre" },
  { label: "Δ", insert: "$\\Delta$", title: "Chaleur / delta" },
  { label: "⁺", insert: "$^{+}$", title: "Charge positive" },
  { label: "⁻", insert: "$^{-}$", title: "Charge négative" },
];

type Props = {
  onInsert: (snippet: string) => void;
  variant?: "full" | "compact";
};

export function FormulaToolbar({ onInsert, variant = "full" }: Props) {
  const math = variant === "compact" ? MATH_SNIPPETS.slice(0, 8) : MATH_SNIPPETS;
  const chem = variant === "compact" ? CHEM_SNIPPETS.slice(0, 6) : CHEM_SNIPPETS;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-2 dark:bg-muted/20">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Maths
          </span>
          {math.map((s) => (
            <Tooltip key={s.title}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  onClick={() => onInsert(s.insert)}
                >
                  {s.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{s.title}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Chimie
          </span>
          {chem.map((s) => (
            <Tooltip key={s.title}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onInsert(s.insert)}
                >
                  {s.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{s.title}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Astuce : écrivez les formules entre <code>$...$</code> (ex.{" "}
          <code>$H_2O$</code>, <code>$\frac{"{1}{2}"}$</code>).
        </p>
      </div>
    </TooltipProvider>
  );
}

"use client";

import { Check, Flag, Globe, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { type EducationSystem } from "@/lib/education-system";
import { cn } from "@/lib/utils";

const SYSTEM_CARDS: Array<{
  value: EducationSystem;
  title: string;
  description: string;
  hint: string;
  icon: LucideIcon;
}> = [
  {
    value: "CONGOLAIS",
    title: "Congolais",
    description: "Calendrier actuel : 9 évaluations au primaire, 6 au secondaire.",
    hint: "Par défaut",
    icon: Flag,
  },
  {
    value: "ANGOLAIS",
    title: "Angolais",
    description:
      "1ª–6ª (Ensino primário) e 7ª–13ª (Ensino secundário). Língua por defeito: PT.",
    hint: "PT",
    icon: Globe,
  },
  {
    value: "ANGLAIS",
    title: "Anglais",
    description: "3 trimestres et 3 périodes. Pondération inchangée.",
    hint: "Terms",
    icon: Languages,
  },
];

type EducationSystemCardsProps = {
  value: EducationSystem;
  onChange: (value: EducationSystem) => void;
  disabled?: boolean;
};

export function EducationSystemCards({
  value,
  onChange,
  disabled,
}: EducationSystemCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SYSTEM_CARDS.map((card) => {
        const selected = value === card.value;
        const Icon = card.icon;
        return (
          <button
            key={card.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(card.value)}
            className={cn(
              "flex h-full flex-col rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors",
              "hover:border-primary/40 hover:bg-primary/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              selected && "border-primary bg-primary/5",
              disabled && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30",
                )}
              >
                {selected ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">
              {card.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {card.description}
            </p>
            <p
              className={cn(
                "mt-2 text-[11px] font-medium uppercase tracking-wide",
                selected ? "text-primary" : "text-muted-foreground/80",
              )}
            >
              {card.hint}
            </p>
          </button>
        );
      })}
    </div>
  );
}

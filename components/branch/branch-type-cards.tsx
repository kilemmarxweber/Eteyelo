"use client";

import {
  Baby,
  BookOpen,
  Check,
  GraduationCap,
  Hammer,
  Landmark,
  School,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ManagedBranchType } from "@/lib/academic-structure";
import { isExtendedBranch } from "@/lib/branch-capabilities";
import {
  SCHOOL_CYCLES,
  cycleLabel,
  principalTypebranchFromSchoolCycles,
  sortSchoolCycles,
  type SchoolCycle,
} from "@/lib/cycle";
import { cn } from "@/lib/utils";

const SCHOOL_CARDS: Array<{
  value: SchoolCycle;
  title: string;
  description: string;
  hint: string;
  icon: LucideIcon;
}> = [
  {
    value: "MATERNELLE",
    title: "Maternelle",
    description: "Crèche et 1è–3è, bulletin de type primaire.",
    hint: "Combinable",
    icon: Baby,
  },
  {
    value: "PRIMAIRE",
    title: "Primaire",
    description: "1è–6è, 9 évaluations, domaines et pondération.",
    hint: "Combinable",
    icon: School,
  },
  {
    value: "SECONDAIRE",
    title: "Secondaire",
    description: "CTEB et humanités, sections, options, 6 évaluations.",
    hint: "Combinable",
    icon: GraduationCap,
  },
];

const EXTENDED_CARDS: Array<{
  value: ManagedBranchType;
  title: string;
  description: string;
  hint: string;
  icon: LucideIcon;
}> = [
  {
    value: "ATELIER",
    title: "Atelier",
    description: "Formation pratique. Élèves importés, pas de caisse ici.",
    hint: "Choix unique",
    icon: Hammer,
  },
  {
    value: "CENTRE_FORMATION",
    title: "Centre de formation",
    description: "Sessions, programmes et brevets.",
    hint: "Choix unique",
    icon: BookOpen,
  },
  {
    value: "UNIVERSITE",
    title: "Université",
    description: "Auditoires LMD, relevés et attestations.",
    hint: "Choix unique",
    icon: Landmark,
  },
];

type BranchTypeCardsProps = {
  typebranch: ManagedBranchType;
  schoolCycles: SchoolCycle[];
  onChange: (next: {
    typebranch: ManagedBranchType;
    schoolCycles: SchoolCycle[];
  }) => void;
  disabled?: boolean;
  hideTypes?: readonly ManagedBranchType[];
};

function SelectionCard({
  title,
  description,
  hint,
  icon: Icon,
  selected,
  disabled,
  onSelect,
}: {
  title: string;
  description: string;
  hint: string;
  icon: LucideIcon;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
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
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </p>
      <p
        className={cn(
          "mt-2 text-[11px] font-medium uppercase tracking-wide",
          selected ? "text-primary" : "text-muted-foreground/80",
        )}
      >
        {hint}
      </p>
    </button>
  );
}

export function BranchTypeCards({
  typebranch,
  schoolCycles,
  onChange,
  disabled,
  hideTypes,
}: BranchTypeCardsProps) {
  const hidden = new Set(hideTypes ?? []);
  const extendedCards = EXTENDED_CARDS.filter(
    (card) => !hidden.has(card.value),
  );
  const inSchoolMode = !isExtendedBranch(typebranch);

  function toggleSchool(cycle: SchoolCycle) {
    const current = inSchoolMode ? schoolCycles : [];
    const next = current.includes(cycle)
      ? current.filter((item) => item !== cycle)
      : [...current, cycle];
    const sorted = sortSchoolCycles(next);
    onChange({
      typebranch:
        sorted.length > 0
          ? principalTypebranchFromSchoolCycles(sorted)
          : "PRIMAIRE",
      schoolCycles: sorted,
    });
  }

  function selectExtended(value: ManagedBranchType) {
    onChange({ typebranch: value, schoolCycles: [] });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          École — un, deux ou les trois cycles
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {SCHOOL_CARDS.map((card) => (
            <SelectionCard
              key={card.value}
              title={card.title}
              description={card.description}
              hint={card.hint}
              icon={card.icon}
              selected={inSchoolMode && schoolCycles.includes(card.value)}
              disabled={disabled}
              onSelect={() => toggleSchool(card.value)}
            />
          ))}
        </div>
      </div>

      {extendedCards.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Autre établissement — un seul type
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {extendedCards.map((card) => (
              <SelectionCard
                key={card.value}
                title={card.title}
                description={card.description}
                hint={card.hint}
                icon={card.icon}
                selected={!inSchoolMode && typebranch === card.value}
                disabled={disabled}
                onSelect={() => selectExtended(card.value)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {inSchoolMode && schoolCycles.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          Cycles retenus : {schoolCycles.map((cycle) => cycleLabel(cycle)).join(", ")}.
          Une caisse et une année scolaire, des bulletins distincts.
        </p>
      ) : null}
    </div>
  );
}

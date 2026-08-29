import { Badge } from "@/components/ui/badge";
import { normalizeBranchType } from "@/lib/academic-structure";
import {
  cycleCompactLabel,
  cycleLabel,
  getBranchCycles,
  type Cycle,
} from "@/lib/cycle";
import {
  educationSystemLabel,
  educationSystemShortLabel,
  isEducationSystem,
} from "@/lib/education-system";
import { cn } from "@/lib/utils";

export const CYCLE_BADGE_CLASS: Record<string, string> = {
  MATERNELLE: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  PRIMAIRE: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  SECONDAIRE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  ATELIER: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  CENTRE_FORMATION:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  UNIVERSITE: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

const EDUCATION_SYSTEM_BADGE_CLASS: Record<string, string> = {
  CONGOLAIS: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  ANGOLAIS: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  ANGLAIS: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

export function EducationSystemBadge({
  educationSystem,
  className,
}: {
  educationSystem?: unknown;
  className?: string;
}) {
  if (!isEducationSystem(educationSystem)) return null;
  const system = educationSystem;
  return (
    <Badge
      variant="secondary"
      title={educationSystemLabel(system)}
      className={cn(
        "shrink-0 rounded-full border-0 font-semibold",
        EDUCATION_SYSTEM_BADGE_CLASS[system],
        className,
      )}
    >
      {educationSystemShortLabel(system)}
    </Badge>
  );
}

type BranchTypeBadgeProps = {
  typebranch: unknown;
  cycles?: Array<{ cycle: unknown; isActive?: boolean; sortOrder?: number }> | Cycle[] | null;
  className?: string;
  /** Libellé complet (Maternelle) au lieu du compact (MAT). */
  fullLabel?: boolean;
};

function badgeClass(cycle: string, className?: string) {
  return cn(
    "rounded-full border-0 font-semibold",
    CYCLE_BADGE_CLASS[cycle] ?? CYCLE_BADGE_CLASS[normalizeBranchType(cycle)],
    className,
  );
}

export function BranchTypeBadge({
  typebranch,
  cycles,
  className,
  fullLabel = false,
}: BranchTypeBadgeProps) {
  const resolved = getBranchCycles({
    typebranch,
    cycles: Array.isArray(cycles)
      ? cycles.map((item) =>
          typeof item === "string" ? { cycle: item, isActive: true } : item,
        )
      : undefined,
  });

  if (resolved.length > 1) {
    return (
      <span className="inline-flex max-w-full flex-wrap items-center gap-1">
        {resolved.map((cycle) => (
          <Badge
            key={cycle}
            variant="secondary"
            title={cycleLabel(cycle)}
            className={badgeClass(cycle, cn("shrink-0 whitespace-nowrap", className))}
          >
            {fullLabel ? cycleLabel(cycle) : cycleCompactLabel(cycle)}
          </Badge>
        ))}
      </span>
    );
  }

  const cycle = resolved[0] ?? normalizeBranchType(typebranch);
  const singleLabel = fullLabel
    ? cycleLabel(cycle)
    : cycleCompactLabel(cycle);
  return (
    <Badge
      variant="secondary"
      title={cycleLabel(cycle)}
      className={badgeClass(cycle, cn("whitespace-nowrap", className))}
    >
      {singleLabel}
    </Badge>
  );
}

function cycleStatShortLabel(cycle: Cycle) {
  return cycleCompactLabel(cycle);
}

export function CycleStatChips({
  items,
  compact = false,
  formatCount,
}: {
  items: Array<{ cycle: Cycle; count: number }>;
  compact?: boolean;
  formatCount?: (count: number) => string;
}) {
  if (items.length < 2) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {items.map(({ cycle, count }) => (
        <span
          key={cycle}
          title={cycleLabel(cycle)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            CYCLE_BADGE_CLASS[cycle] ??
              CYCLE_BADGE_CLASS[normalizeBranchType(cycle)],
          )}
        >
          <span>
            {compact ? cycleStatShortLabel(cycle) : cycleLabel(cycle)}
          </span>
          <span className="tabular-nums">
            {formatCount ? formatCount(count) : count}
          </span>
        </span>
      ))}
    </div>
  );
}

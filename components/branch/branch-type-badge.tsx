import { Badge } from "@/components/ui/badge";
import { getBranchTypeShortLabel } from "@/lib/branch-capabilities";
import { normalizeBranchType, type ManagedBranchType } from "@/lib/academic-structure";
import { cn } from "@/lib/utils";

const BADGE_VARIANTS: Record<ManagedBranchType, string> = {
  PRIMAIRE: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  SECONDAIRE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  ATELIER: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  CENTRE_FORMATION:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  UNIVERSITE: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

type BranchTypeBadgeProps = {
  typebranch: unknown;
  className?: string;
};

export function BranchTypeBadge({ typebranch, className }: BranchTypeBadgeProps) {
  const normalized = normalizeBranchType(typebranch);

  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full border-0 font-semibold",
        BADGE_VARIANTS[normalized],
        className,
      )}
    >
      {getBranchTypeShortLabel(normalized)}
    </Badge>
  );
}

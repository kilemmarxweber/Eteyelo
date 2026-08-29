import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type BranchLoadingFallbackProps = {
  className?: string;
  label?: string;
};

/**
 * Squelette local dans la zone de contenu.
 * Ne relance plus l’overlay de navigation — sinon le loader
 * reste collé jusqu’à la fin des fetchs client (session, listes…).
 */
export function BranchLoadingFallback({
  className,
  label = "Chargement",
}: BranchLoadingFallbackProps) {
  return (
    <div
      className={cn("flex flex-col gap-4 p-4 md:p-6", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default BranchLoadingFallback;

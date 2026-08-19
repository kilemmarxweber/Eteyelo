import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BranchStickyHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  /** Lien retour optionnel (ex. détail → liste). */
  backHref?: string;
  backLabel?: string;
  className?: string;
};

/**
 * En-tête des pages branche.
 * Mobile / tablette : défile avec le contenu (gagne de la place).
 * Desktop (lg+) : reste sticky comme avant.
 */
export function BranchStickyHeader({
  title,
  description,
  badge,
  actions,
  backHref,
  backLabel = "Retour",
  className,
}: BranchStickyHeaderProps) {
  return (
    <div
      className={cn(
        "z-20 -mx-4 bg-background/95 backdrop-blur",
        "supports-[backdrop-filter]:bg-background/80",
        "md:-mx-8",
        // Sticky seulement desktop — mobile/tablette scrollent l’en-tête.
        "lg:sticky lg:top-0",
        className,
      )}
    >
      <header className="px-4 py-2 md:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {backHref ? (
              <Button
                asChild
                size="icon"
                variant="outline"
                className="size-7 shrink-0"
              >
                <Link href={backHref} aria-label={backLabel}>
                  <ArrowLeft className="size-3.5" />
                </Link>
              </Button>
            ) : null}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h1 className="truncate text-base font-bold tracking-tight text-foreground md:text-lg">
                  {title}
                </h1>
                {badge}
              </div>
              {description ? (
                <p className="truncate text-xs leading-snug text-muted-foreground md:text-sm">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:pl-2">
              {actions}
            </div>
          ) : null}
        </div>
      </header>
      <div className="h-3 bg-background" aria-hidden />
    </div>
  );
}

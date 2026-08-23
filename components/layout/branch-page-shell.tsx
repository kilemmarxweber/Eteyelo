import type { ReactNode } from "react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { BranchStickyHeader } from "@/components/layout/branch-sticky-header";
import { cn } from "@/lib/utils";

type BranchPageShellProps = {
  title?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Compat PageHeader — ignoré (sticky compact unique). */
  variant?: string;
  breadcrumbs?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Layout plein hauteur (présences, frais, etc.). */
  fixedHeight?: boolean;
  fadedBelow?: boolean;
  /** Masque le bandeau sticky (titre / description / actions). */
  hideHeader?: boolean;
};

/**
 * Cadre commun des pages branche : Layout + en-tête sticky
 * (même pattern que Devoirs).
 */
export function BranchPageShell({
  title,
  description,
  badge,
  actions,
  backHref,
  backLabel,
  variant: _variant,
  breadcrumbs,
  children,
  className,
  contentClassName,
  fixedHeight = false,
  fadedBelow = false,
  hideHeader = false,
}: BranchPageShellProps) {
  return (
    <Layout fadedBelow={fadedBelow} fixedHeight={fixedHeight}>
      <LayoutBody
        className={cn("flex flex-col gap-0 pt-0 md:pt-0", className)}
        fixedHeight={fixedHeight}
      >
        {breadcrumbs ? (
          <div className="-mx-4 bg-background/95 px-4 pt-2 text-sm backdrop-blur md:-mx-8 md:px-8">
            {breadcrumbs}
          </div>
        ) : null}
        {!hideHeader && title != null ? (
          <BranchStickyHeader
            title={title}
            description={description}
            badge={badge}
            actions={actions}
            backHref={backHref}
            backLabel={backLabel}
          />
        ) : null}
        <div
          className={cn(
            "min-w-0 flex-1 pb-4",
            hideHeader ? "pt-0" : "pt-1",
            fixedHeight ? "flex min-h-0 flex-col" : "space-y-6",
            contentClassName,
          )}
        >
          {children}
        </div>
      </LayoutBody>
    </Layout>
  );
}

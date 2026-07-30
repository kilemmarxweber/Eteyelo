import type { ReactNode } from "react";

import { Layout, LayoutBody } from "@/components/custom/layout";
import { BranchStickyHeader } from "@/components/layout/branch-sticky-header";
import { cn } from "@/lib/utils";

type BranchPageShellProps = {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Layout plein hauteur (présences, frais, etc.). */
  fixedHeight?: boolean;
  fadedBelow?: boolean;
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
  children,
  className,
  contentClassName,
  fixedHeight = false,
  fadedBelow = false,
}: BranchPageShellProps) {
  return (
    <Layout fadedBelow={fadedBelow} fixedHeight={fixedHeight}>
      <LayoutBody
        className={cn("flex flex-col gap-0 pt-0 md:pt-0", className)}
        fixedHeight={fixedHeight}
      >
        <BranchStickyHeader
          title={title}
          description={description}
          badge={badge}
          actions={actions}
          backHref={backHref}
          backLabel={backLabel}
        />
        <div
          className={cn(
            "min-w-0 flex-1 pb-4 pt-1",
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

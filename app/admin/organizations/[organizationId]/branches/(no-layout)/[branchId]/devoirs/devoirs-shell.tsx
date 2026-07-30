"use client";

import type { ReactNode } from "react";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { cn } from "@/lib/utils";

type DevoirsShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  listHref?: string;
  children: ReactNode;
  className?: string;
};

/** Cadre Devoirs — BranchPageShell (sticky identique aux autres pages). */
export function DevoirsShell({
  title,
  description,
  actions,
  badge,
  listHref,
  children,
  className,
}: DevoirsShellProps) {
  return (
    <BranchPageShell
      title={title}
      description={description}
      badge={badge}
      actions={actions}
      backHref={listHref}
      backLabel="Retour aux devoirs"
      className={className}
      contentClassName={cn("space-y-4")}
    >
      {children}
    </BranchPageShell>
  );
}

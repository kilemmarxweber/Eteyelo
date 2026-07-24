"use client";

import type { ComponentType, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BranchStatCardProps = {
  label: string;
  value: ReactNode;
  description?: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  footer?: ReactNode;
  className?: string;
};

/**
 * Carte KPI compacte partagée (élèves / enseignants / personnel / parents…).
 * Même rendu pour tous les types de branche (primaire → université / centre).
 */
export function BranchStatCard({
  label,
  value,
  description,
  icon: Icon,
  footer,
  className,
}: BranchStatCardProps) {
  return (
    <Card
      variant="stat"
      padding="sm"
      className={cn(
        "h-full transition hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black tabular-nums text-foreground">
            {value}
          </p>
          {description ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
          ) : null}
          {footer}
        </div>
        <div className="shrink-0 rounded-xl bg-muted p-2 text-primary">
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

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
        "h-full transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
          {footer}
        </div>
        <div className="shrink-0 rounded-lg bg-muted/80 p-1.5 text-primary">
          <Icon size={16} />
        </div>
      </div>
    </Card>
  );
}

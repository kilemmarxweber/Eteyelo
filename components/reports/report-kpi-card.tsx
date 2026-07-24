import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  blue: "bg-blue-50 text-primary",
  orange: "bg-orange-50 text-orange-600",
  green: "bg-emerald-50 text-emerald-600",
  cyan: "bg-cyan-50 text-cyan-600",
  slate: "bg-slate-100 text-slate-700",
  rose: "bg-rose-50 text-rose-600",
} as const;

export function ReportKpiCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-xl font-bold text-foreground">{value}</p>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            tones[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

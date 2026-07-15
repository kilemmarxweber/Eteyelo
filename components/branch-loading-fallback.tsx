"use client";

import { useEffect } from "react";
import { School } from "lucide-react";

import { useAppLoading } from "@/hooks/use-app-loading";
import { cn } from "@/lib/utils";

type BranchLoadingFallbackProps = {
  label?: string;
  className?: string;
};

export function BranchLoadingFallback({
  label = "Chargement de l'établissement...",
  className,
}: BranchLoadingFallbackProps) {
  const { resetLoading } = useAppLoading();

  // Évite le double loader : GlobalTopLoader + ce fallback.
  useEffect(() => {
    resetLoading();
  }, [resetLoading]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex min-h-[min(100vh,720px)] w-full flex-col items-center justify-center gap-4 bg-background px-4",
        className,
      )}
    >
      <div className="flex items-center gap-3 rounded-full border border-blue-100/90 bg-white/95 px-5 py-2.5 shadow-xl shadow-blue-950/10 backdrop-blur-md">
        <div className="relative flex size-9 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-blue-100" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-blue-600 border-r-cyan-400" />
          <School className="relative size-4 text-blue-700" />
        </div>

        <div className="pr-1">
          <p className="text-sm font-semibold text-blue-950">{label}</p>
          <p className="text-[11px] font-medium text-slate-500">Klambocore</p>
        </div>
      </div>
    </div>
  );
}

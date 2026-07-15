"use client";

import { School } from "lucide-react";

import { cn } from "@/lib/utils";

type GlobalTopLoaderProps = {
  visible: boolean;
  label?: string;
};

export function GlobalTopLoader({
  visible,
  label = "Chargement...",
}: GlobalTopLoaderProps) {
  return (
    <>
      <div
        aria-hidden={!visible}
        aria-live="polite"
        role="status"
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-[9999] transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className={cn("global-top-loader-bar", !visible && "is-paused")} />
      </div>

      <div
        aria-hidden={!visible}
        aria-live="polite"
        role="status"
        className={cn(
          "pointer-events-none fixed left-1/2 top-5 z-[10000] -translate-x-1/2 transition-all duration-300",
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "-translate-y-2 scale-95 opacity-0",
        )}
      >
        <div className="flex items-center gap-3 rounded-full border border-blue-100/90 bg-white/95 px-5 py-2.5 shadow-xl shadow-blue-950/10 backdrop-blur-md">
          <div className="relative flex h-9 w-9 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-blue-100" />
            <span
              className={cn(
                "absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 border-r-cyan-400",
                visible ? "animate-spin" : "animation-paused",
              )}
            />
            <School className="relative h-4 w-4 text-blue-700" />
          </div>

          <div className="pr-1">
            <p className="text-sm font-black text-blue-950">{label}</p>
            <p className="text-[11px] font-medium text-slate-500">
              Klambocore
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

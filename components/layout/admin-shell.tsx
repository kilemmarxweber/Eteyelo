"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { HomeNavbar } from "@/components/home-navbar";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBranchRoute = /^\/admin\/organizations\/[^/]+\/branches\/[^/]+/.test(
    pathname,
  );

  if (isBranchRoute) {
    return (
      <div className="h-screen bg-background text-foreground">{children}</div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <div className="bg-blue-950 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-3 items-center gap-2 px-3 py-2 text-[10px] sm:px-6 sm:text-xs">
          <span className="text-left">🇨🇩 Marketing scolaire</span>
          <span className="text-center">🏫 Écoles, instituts & universités</span>
          <span className="text-right">📊 Résultats en ligne</span>
        </div>
      </div>

      <HomeNavbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}

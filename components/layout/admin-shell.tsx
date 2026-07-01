"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminTopBar } from "@/components/layout/admin-top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AdminTopBar />
      <main className="flex-1 pb-[76px] md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}

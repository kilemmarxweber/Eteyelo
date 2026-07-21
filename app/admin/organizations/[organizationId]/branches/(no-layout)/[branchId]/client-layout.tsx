"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import { LayoutHeader } from "@/components/custom/layout";
import { ThemeToggle } from "@/src/theme/ThemeToggle";
import { UserNav } from "@/components/user-nav";
import { Search } from "@/components/search";
import { NotificationBell } from "@/components/notification-bell";
import { MobileNav } from "@/components/layout/mobile-nav";
import { authClient } from "@/lib/auth-client";
import { useAppLoading } from "@/hooks/use-app-loading";
import { BranchLoadingFallback } from "@/components/branch-loading-fallback";
import { RefreshProvider } from "@/src/hooks/RefreshContext";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  const { resetLoading } = useAppLoading();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || isPending) return;
    if (session) return;

    const timeout = window.setTimeout(() => {
      resetLoading();
      window.location.assign("/auth/sign-in");
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [session, isPending, resetLoading, isHydrated]);

  if (!isHydrated || isPending) {
    return (
      <BranchLoadingFallback
        label="Chargement de l'établissement..."
        className="min-h-screen"
      />
    );
  }

  if (!session) {
    return (
      <BranchLoadingFallback
        label="Redirection..."
        className="min-h-screen"
      />
    );
  }

  return (
    <RefreshProvider>
      <div className="relative h-dvh overflow-hidden bg-background">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

        <LayoutHeader
          className={cn(
            "fixed top-0 right-0 z-30 hidden h-14 border-b bg-background md:flex md:px-8",
            isCollapsed ? "left-14" : "left-44",
          )}
        >
          <div className="ml-auto flex w-auto min-w-0 items-center gap-4 px-4 py-2 md:px-0">
            <Search className="md:flex-none" />
            <ThemeToggle />
            <NotificationBell />
            <UserNav />
          </div>
        </LayoutHeader>

        <main
          className={cn(
            "h-dvh overflow-y-auto overflow-x-hidden transition-[margin]",
            "pt-16 pb-[76px] md:pt-14 md:pb-0",
            isCollapsed ? "md:ml-14" : "md:ml-44",
          )}
        >
          <div className="[&_.relative.flex.h-full.w-full.flex-col]:!h-auto [&_.relative.flex.h-full.w-full.flex-col>.flex-1.overflow-hidden]:!overflow-visible">
            {children}
          </div>
        </main>

        <MobileNav />
      </div>
    </RefreshProvider>
  );
}

"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import { LayoutHeader } from "@/components/custom/layout";
import { ThemeToggle } from "@/src/theme/ThemeToggle";
import { UserNav } from "@/components/user-nav";
import { Search } from "@/components/search";
import { NotificationBell } from "@/components/notification-bell";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OwnerBranchesLink } from "@/components/owner-branches-link";
import { AppIntlProvider } from "@/components/app-intl-provider";
import { authClient } from "@/lib/auth-client";
import { BranchSessionResume } from "@/components/branch-session-resume";
import { hideRouteLoader } from "@/lib/route-loader";
import { RefreshProvider, useRefresh } from "@/src/hooks/RefreshContext";
import type { UserLocale } from "@/lib/user-locale";
import { cn } from "@/lib/utils";

function BranchShell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const { refreshKey } = useRefresh();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (isPending || session) return;

    // Ne démonte plus le shell si la session clignote — redirection douce seulement.
    const timeout = window.setTimeout(() => {
      hideRouteLoader();
      window.location.assign("/auth/sign-in");
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [session, isPending]);

  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      <BranchSessionResume />
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      <LayoutHeader
        className={cn(
          "fixed top-0 right-0 z-30 hidden h-14 border-b bg-background md:flex md:px-8",
          isCollapsed ? "left-14" : "left-52",
        )}
      >
        <div className="ml-auto flex w-auto min-w-0 items-center gap-4 px-4 py-2 md:px-0">
          <Search className="md:flex-none" />
          <ThemeToggle />
          <OwnerBranchesLink />
          <NotificationBell />
          <UserNav />
        </div>
      </LayoutHeader>

      <main
        className={cn(
          "h-dvh overflow-y-auto overflow-x-hidden transition-[margin]",
          "pt-16 pb-[76px] md:pt-14 md:pb-0",
          isCollapsed ? "md:ml-14" : "md:ml-52",
        )}
      >
        <div
          key={refreshKey}
          className="[&_.relative.flex.h-full.w-full.flex-col]:!h-auto [&_.relative.flex.h-full.w-full.flex-col>.flex-1.overflow-hidden]:!overflow-visible"
        >
          {children}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}

export default function Layout({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: UserLocale;
  messages: Record<string, unknown>;
}) {
  return (
    <AppIntlProvider locale={locale} messages={messages}>
      <RefreshProvider>
        <BranchShell>{children}</BranchShell>
      </RefreshProvider>
    </AppIntlProvider>
  );
}

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
import Spinner from "./spinner";
import { RefreshProvider } from "@/src/hooks/RefreshContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  const { resetLoading } = useAppLoading();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (session) return;

    const timeout = window.setTimeout(() => {
      resetLoading();
      window.location.assign("/auth/sign-in");
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [session, isPending, resetLoading]);

  if (isPending || !session) {
    return (
      <Spinner
        show={true}
        className="flex h-screen items-center justify-center"
      />
    );
  }

  return (
    <RefreshProvider>
      <div className="relative h-full overflow-hidden bg-background">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

        <main
          className={`h-full overflow-x-hidden pt-14 pb-[76px] transition-[margin] md:pb-0 md:pt-0 ${
            isCollapsed ? "md:ml-14" : "md:ml-44"
          }`}
        >
          <LayoutHeader>
            <div className="ml-auto flex items-center space-x-4">
              <Search />
              <ThemeToggle />
              <NotificationBell />
              <UserNav />
            </div>
          </LayoutHeader>

          {children}
        </main>
        <MobileNav />
      </div>
    </RefreshProvider>
  );
}

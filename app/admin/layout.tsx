import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppIntlProvider } from "@/components/app-intl-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { UserLocaleSync } from "@/components/user-locale-sync";
import { UserThemeSync } from "@/components/user-theme-sync";
import { AdminShell } from "@/components/layout/admin-shell";
import { auth } from "@/lib/auth";
import { enforceAdminRouteAccess } from "@/lib/auth/enforce-admin-route-access";
import { loadMessages } from "@/lib/i18n";
import { resolvePreferredLocale } from "@/lib/resolve-preferred-locale";
import {
  normalizeUserTheme,
  userThemeStorageKey,
} from "@/lib/user-theme";

/** Zone privée — ne pas indexer. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const pathname = requestHeaders.get("x-pathname") ?? "/admin";
  await enforceAdminRouteAccess(pathname);

  const isChangePasswordRoute =
    pathname === "/admin/account/change-password" ||
    pathname.startsWith("/admin/account/change-password/");

  const userId = session.user.id;
  const preferredTheme = normalizeUserTheme(
    (session.user as { theme?: string | null }).theme,
  );
  const preferredLocale = await resolvePreferredLocale(
    (session.user as { locale?: string | null }).locale,
  );
  const messages = await loadMessages(preferredLocale);

  return (
    <ThemeProvider
      key={userId}
      attribute="class"
      defaultTheme={preferredTheme}
      enableSystem
      storageKey={userThemeStorageKey(userId)}
      disableTransitionOnChange
    >
      <AppIntlProvider
        key={`${userId}-${preferredLocale}`}
        locale={preferredLocale}
        messages={messages}
      >
        <UserThemeSync userId={userId} preferredTheme={preferredTheme} />
        <UserLocaleSync userId={userId} preferredLocale={preferredLocale} />
        {isChangePasswordRoute ? (
          children
        ) : (
          <AdminShell>{children}</AdminShell>
        )}
      </AppIntlProvider>
    </ThemeProvider>
  );
}

import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ThemeProvider } from "@/components/theme-provider";
import { UserThemeSync } from "@/components/user-theme-sync";
import { AdminShell } from "@/components/layout/admin-shell";
import { auth } from "@/lib/auth";
import { enforceAdminRouteAccess } from "@/lib/auth/enforce-admin-route-access";
import {
  normalizeUserTheme,
  userThemeStorageKey,
} from "@/lib/user-theme";

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

  return (
    <ThemeProvider
      key={userId}
      attribute="class"
      defaultTheme={preferredTheme}
      enableSystem
      storageKey={userThemeStorageKey(userId)}
      disableTransitionOnChange
    >
      <UserThemeSync userId={userId} preferredTheme={preferredTheme} />
      {isChangePasswordRoute ? (
        children
      ) : (
        <AdminShell>{children}</AdminShell>
      )}
    </ThemeProvider>
  );
}

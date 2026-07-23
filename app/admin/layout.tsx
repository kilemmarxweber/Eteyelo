import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ThemeProvider } from "@/components/theme-provider";
import { AdminShell } from "@/components/layout/admin-shell";
import { auth } from "@/lib/auth";
import { enforceAdminRouteAccess } from "@/lib/auth/enforce-admin-route-access";

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

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {isChangePasswordRoute ? (
        children
      ) : (
        <AdminShell>{children}</AdminShell>
      )}
    </ThemeProvider>
  );
}

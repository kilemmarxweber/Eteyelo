"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { authClient } from "@/lib/auth-client";
import { canAccessBranchOrgSettings } from "@/lib/auth/session-roles";

/** Bloque l'accès direct aux réglages org (types frais, calendrier, etc.). */
export function RequireBranchOrgSettingsAccess({
  children,
}: {
  children: ReactNode;
}) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = canAccessBranchOrgSettings(session);

  useEffect(() => {
    if (isPending || allowed) return;
    const profileHref =
      pathname?.replace(/\/settings(?:\/.*)?$/, "/settings") ?? "/admin";
    router.replace(profileHref);
  }, [allowed, isPending, pathname, router]);

  if (isPending || !allowed) {
    return (
      <p className="text-sm text-muted-foreground">Verification des droits…</p>
    );
  }

  return <>{children}</>;
}

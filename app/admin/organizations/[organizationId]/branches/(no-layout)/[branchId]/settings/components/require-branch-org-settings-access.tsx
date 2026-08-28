"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { authClient } from "@/lib/auth-client";
import {
  canAccessBranchOrgSettings,
  canAccessSchoolOpsSettings,
  isOrganizationOwnerSession,
} from "@/lib/auth/session-roles";

type SettingsAccessLevel = "org" | "school_ops" | "owner";

/** Bloque l'accès direct aux réglages org / school_ops / owner. */
export function RequireBranchOrgSettingsAccess({
  children,
  level = "org",
}: {
  children: ReactNode;
  level?: SettingsAccessLevel;
}) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;
  const allowed =
    level === "school_ops"
      ? canAccessSchoolOpsSettings(session)
      : level === "owner"
        ? isOrganizationOwnerSession(session)
        : canAccessBranchOrgSettings(session);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!sessionReady || allowed) return;
    const profileHref =
      pathname?.replace(/\/settings(?:\/.*)?$/, "/settings") ?? "/admin";
    router.replace(profileHref);
  }, [allowed, sessionReady, pathname, router]);

  // Même HTML SSR / premier paint client pour éviter le mismatch d'hydratation.
  if (!sessionReady || !allowed) {
    return (
      <p className="text-sm text-muted-foreground">Vérification des droits…</p>
    );
  }

  return <>{children}</>;
}

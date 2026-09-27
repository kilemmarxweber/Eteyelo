"use client";

import { useSession } from "@/lib/auth-client";
import { hasSessionRole } from "@/lib/auth/session-roles";
import { useEffect, useRef } from "react";
import { useAppLoading } from "@/hooks/use-app-loading";

import { NotFoundView } from "@/components/not-found-view";
import { requestSessionLock } from "@/lib/session-lock-storage";

function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { data: session, isPending } = useSession();
  const { resetLoading } = useAppLoading();
  const seenSession = useRef(false);
  if (session) seenSession.current = true;

  const canAccess =
    !!session &&
    (allowedRoles.length === 0 || hasSessionRole(session, allowedRoles));

  useEffect(() => {
    if (isPending) return;
    if (session) return;

    resetLoading();

    // Soft-lock possible (snapshot ou lastIdentity) → popup, pas /auth/sign-in.
    if (requestSessionLock()) return;

    // Laisser un court refetch si on avait déjà une session, puis login.
    if (!seenSession.current) {
      window.location.assign("/auth/sign-in");
      return;
    }

    const timeout = window.setTimeout(() => {
      if (requestSessionLock()) return;
      window.location.assign("/auth/sign-in");
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [session, isPending, resetLoading]);

  // Pas de session active → jamais de contenu protégé (loading / soft-lock / redirect).
  if (!session) {
    return <div>Loading...</div>;
  }

  if (!canAccess) {
    return <NotFoundView />;
  }

  return <>{children}</>;
}

export default AuthGuard;

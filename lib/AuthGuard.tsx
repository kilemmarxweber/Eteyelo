"use client";

import { useSession } from "@/lib/auth-client";
import { hasSessionRole } from "@/lib/auth/session-roles";
import { useEffect, useRef } from "react";
import { useAppLoading } from "@/hooks/use-app-loading";

import { NotFoundView } from "@/components/not-found-view";
import { isSessionIdleExpired, requestSessionLock } from "@/lib/session-lock-storage";

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
    if (isPending) {
      return;
    }

    if (!session) {
      resetLoading();
      if (!isSessionIdleExpired()) return;
      if (!requestSessionLock()) {
        window.location.assign("/auth/sign-in");
      }
    }
  }, [session, isPending, resetLoading]);

  if (!session && isPending && !seenSession.current) {
    return <div>Loading...</div>;
  }

  if (!session && isSessionIdleExpired()) {
    return <div>Loading...</div>;
  }

  if (!session && !seenSession.current) {
    return <div>Loading...</div>;
  }

  if (!session && seenSession.current && !isSessionIdleExpired()) {
    return <>{children}</>;
  }

  if (!canAccess) {
    return <NotFoundView />;
  }

  return <>{children}</>;
}

export default AuthGuard;

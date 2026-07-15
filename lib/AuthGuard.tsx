"use client";

import { useSession } from "@/lib/auth-client";
import { hasSessionRole } from "@/lib/auth/session-roles";
import { useEffect } from "react";
import { useAppLoading } from "@/hooks/use-app-loading";

import { NotFoundView } from "@/components/not-found-view";

function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { data: session, isPending } = useSession();
  const { resetLoading } = useAppLoading();
  const canAccess =
    !!session &&
    (allowedRoles.length === 0 || hasSessionRole(session, allowedRoles));

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      resetLoading();
      window.location.assign("/auth/sign-in");
    }
  }, [session, isPending, resetLoading]);

  if (isPending || !session) {
    return <div>Loading...</div>;
  }

  if (!canAccess) {
    return <NotFoundView />;
  }

  return <>{children}</>;
}

export default AuthGuard;

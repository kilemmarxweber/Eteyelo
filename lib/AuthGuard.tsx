"use client";

import { useSession } from "@/lib/auth-client";
import { hasSessionRole } from "@/lib/auth/session-roles";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const canAccess =
    !!session &&
    (allowedRoles.length === 0 || hasSessionRole(session, allowedRoles));

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.push("/auth/sign-in");
    } else if (!canAccess) {
      router.push("/not-authorized");
    }
  }, [session, isPending, canAccess, router]);

  if (isPending || !session || !canAccess) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}

export default AuthGuard;

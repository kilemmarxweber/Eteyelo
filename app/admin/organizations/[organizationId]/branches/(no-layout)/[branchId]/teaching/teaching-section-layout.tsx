"use client";

import { useEffect, useState } from "react";
import { NotFoundView } from "@/components/not-found-view";
import { useSession } from "@/lib/auth-client";
import { canAccessPedagogyArea } from "@/lib/auth/session-roles";

export default function TeachingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const sessionReady = hasMounted && !isPending;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Avoid swapping to Loading on isPending — that mismatches SSR vs client.
  if (sessionReady && !canAccessPedagogyArea(session)) {
    return <NotFoundView />;
  }

  return children;
}

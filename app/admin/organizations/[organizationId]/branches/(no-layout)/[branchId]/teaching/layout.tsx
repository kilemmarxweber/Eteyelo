"use client";

import { NotFoundView } from "@/components/not-found-view";
import { useSession } from "@/lib/auth-client";
import { canAccessTeachingArea } from "@/lib/auth/session-roles";
import Loading from "../loading";

export default function TeachingLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  if (isPending) return <Loading />;
  if (!canAccessTeachingArea(session)) return <NotFoundView />;
  return children;
}

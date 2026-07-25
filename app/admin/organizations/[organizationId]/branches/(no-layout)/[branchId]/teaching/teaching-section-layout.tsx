"use client";

import { NotFoundView } from "@/components/not-found-view";
import { useSession } from "@/lib/auth-client";
import { canAccessPedagogyArea } from "@/lib/auth/session-roles";
import Loading from "../loading";

export default function TeachingLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  if (isPending) return <Loading />;
  // Affectations : school admin uniquement (pas enseignant — unit-06 / unit-00).
  if (!canAccessPedagogyArea(session)) return <NotFoundView />;
  return children;
}

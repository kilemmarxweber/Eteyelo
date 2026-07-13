"use client";

import { redirect } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { canAccessTeachingArea } from "@/lib/auth/session-roles";
import Loading from "../loading";

export default function TeachingLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  if (isPending) return <Loading />;
  if (!canAccessTeachingArea(session)) redirect("/not-authorized");
  return children;
}

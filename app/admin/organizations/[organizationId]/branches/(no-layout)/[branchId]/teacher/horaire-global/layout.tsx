import { notFound, redirect } from "next/navigation";

import { canAccessBranchAreaAsync } from "@/lib/auth/assert-branch-area-access";
import { getCachedSession } from "@/lib/auth/get-session-cached";

export default async function HoraireGlobalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const schedule = await canAccessBranchAreaAsync("schedule", session);
  const pedagogy = await canAccessBranchAreaAsync("pedagogy", session);
  if (!schedule && !pedagogy) {
    notFound();
  }

  return children;
}

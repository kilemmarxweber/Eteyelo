import { notFound, redirect } from "next/navigation";

import { getCachedSession } from "@/lib/auth/get-session-cached";
import { isOrganizationOwnerSession } from "@/lib/auth/session-roles";

/** Layout serveur : Rôles & privilèges réservés au propriétaire. */
export default async function AssertOwnerSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }
  if (!isOrganizationOwnerSession(session)) {
    notFound();
  }
  return children;
}

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getAuthContext() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) return null;

  return {
    userId: session.user?.id ?? null,
    organizationId: session.organization?.id ?? null,
    branchId: session.branch?.id ?? session.session.activeBranchId ?? null,
  };
}

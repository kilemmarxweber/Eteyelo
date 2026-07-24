import { getCachedSession } from "@/lib/auth/get-session-cached";

export async function getAuthContext() {
  const session = await getCachedSession();

  if (!session) return null;

  return {
    userId: session.user?.id ?? null,
    organizationId: session.organization?.id ?? null,
    branchId: session.branch?.id ?? session.session.activeBranchId ?? null,
  };
}

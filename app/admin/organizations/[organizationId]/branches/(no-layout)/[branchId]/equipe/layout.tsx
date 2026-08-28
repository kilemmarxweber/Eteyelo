import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function BranchTeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;

  await assertBranchAreaAccess("school_admin", undefined, {
    organizationId,
    branchId,
  });

  return children;
}

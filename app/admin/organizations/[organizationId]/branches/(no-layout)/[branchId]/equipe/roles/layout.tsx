import { assertBranchAreaAccess } from "@/lib/auth/assert-branch-area-access";

export default async function BranchTeamRolesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;

  await assertBranchAreaAccess("branch_org_settings", undefined, {
    organizationId,
    branchId,
  });

  return children;
}

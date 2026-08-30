import { redirect } from "next/navigation";

export default async function BranchMessagingRedirectPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  redirect(
    `/admin/organizations/${organizationId}/messagerie?fromBranch=${branchId}`,
  );
}

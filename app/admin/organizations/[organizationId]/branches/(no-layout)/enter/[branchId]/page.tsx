import { redirect } from "next/navigation";

import { switchBranchAction } from "../../branche.action";

type EnterBranchPageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function EnterBranchPage({ params }: EnterBranchPageProps) {
  const { organizationId, branchId } = await params;

  await switchBranchAction(organizationId, branchId);

  redirect(`/admin/organizations/${organizationId}/branches/${branchId}`);
}

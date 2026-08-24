import { redirect } from "next/navigation";
import { CreateBranchForm } from "./components/create-branch-form";
import { BackLink } from "@/components/ui/back-link";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import {
  getAnyUserBranchMemberships,
  isGestionnaireBranchLandingRole,
} from "@/lib/auth/user-branch-access";

type NewBranchPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewBranchPage({ params }: NewBranchPageProps) {
  const { organizationId } = await params;
  const context = await enforceOrganizationManagerPage(organizationId);
  const branchesHref = `/admin/organizations/${organizationId}/branches`;

  if (isGestionnaireBranchLandingRole(context.membership?.role)) {
    const assigned = await getAnyUserBranchMemberships(
      context.userId,
      organizationId,
    );
    if (assigned.length > 0) {
      redirect(
        assigned.length === 1
          ? `${branchesHref}/${assigned[0].branchId}`
          : branchesHref,
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink href={branchesHref} label="Retour à la liste" />
      <CreateBranchForm organizationId={organizationId} />
    </div>
  );
}

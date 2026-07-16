import { CreateBranchForm } from "./components/create-branch-form";
import { HomeNavbar } from "@/components/home-navbar";
import { BackLink } from "@/components/ui/back-link";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";

type NewBranchPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewBranchPage({ params }: NewBranchPageProps) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);
  const branchesHref = `/admin/organizations/${organizationId}/branches`;

  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <BackLink href={branchesHref} label="Retour à la liste" />
        <CreateBranchForm organizationId={organizationId} />
      </div>
    </div>
  );
}

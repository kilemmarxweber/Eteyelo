import { CreateBranchForm } from "../new/components/create-branch-form";
import { BackLink } from "@/components/ui/back-link";
import { getBranchByIdAction } from "../branche.action";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";
import { toBranchFormValues } from "@/lib/branch-form-values";

type EditBranchPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ branchId?: string }>;
};

export default async function EditBranchPage({
  params,
  searchParams,
}: EditBranchPageProps) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);
  const { branchId } = await searchParams;

  if (!branchId) {
    return <p>Identifiant de la branche manquant.</p>;
  }

  const branch = await getBranchByIdAction(branchId);

  if (!branch) {
    return <p>Établissement introuvable.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <BackLink
        href={`/admin/organizations/${organizationId}/branches`}
        label="Retour à la liste"
      />

      <CreateBranchForm
        mode="update"
        branchId={branchId}
        organizationId={organizationId}
        defaultValues={toBranchFormValues(branch)}
      />
    </div>
  );
}

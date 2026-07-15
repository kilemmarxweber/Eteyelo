import { CreateBranchForm } from "../new/components/create-branch-form";
import { BackLink } from "@/components/ui/back-link";
import { getBranchByIdAction } from "../branche.action";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";

type EditBranchPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ branchId?: string }>;
};
type BranchImageItem = {
  logo: string;
  event: string[];
  gallery: string[];
  ecole: string[];
};

function normalizeBranchImages(value: unknown): BranchImageItem {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const image = value as Partial<BranchImageItem>;

    return {
      logo: typeof image.logo === "string" ? image.logo : "",
      event: Array.isArray(image.event) ? image.event.filter(Boolean) : [],
      gallery: Array.isArray(image.gallery)
        ? image.gallery.filter(Boolean)
        : [],
      ecole: Array.isArray(image.ecole) ? image.ecole.filter(Boolean) : [],
    };
  }

  return {
    logo: "",
    event: [],
    gallery: [],
    ecole: [],
  };
}
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
        defaultValues={{
          name: branch.name,
          code: branch.code ?? "",
          image: normalizeBranchImages(branch.image),
          adresse: branch.adresse ?? "",
          province: branch.province ?? "",
          ville: branch.ville ?? "",
          commune: branch.commune ?? "",
          pays: branch.pays ?? "RDC",
          idnat: branch.idnat ?? "",
          tel: branch.tel ?? "",
          latitude: branch.latitude,
          longitude: branch.longitude,
          attendanceRadius: branch.attendanceRadius,
          typebranch: branch.typebranch,
        }}
      />
    </div>
  );
}

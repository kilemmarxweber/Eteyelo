import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateBranchForm } from "../new/components/create-branch-form";
import { getBranchByIdAction } from "../branche.action";

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
  const { branchId } = await searchParams;

  if (!branchId) {
    return <p>Identifiant de la branche manquant.</p>;
  }

  const branch = await getBranchByIdAction(branchId);

  if (!branch) {
    return <p>Établissement introuvable.</p>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6 lg:py-14">
        <Link
          href={`/admin/organizations/${organizationId}/branches`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-blue-950 underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Retour à la liste
        </Link>

        <CreateBranchForm
          mode="update"
          branchId={branchId}
          organizationId={organizationId}
          defaultValues={{
            name: branch.name,
            code: branch.code ?? "",
            image: normalizeBranchImages(branch.image),
            adresse: branch.adresse ?? "",
            ville: branch.ville ?? "",
            pays: branch.pays ?? "RDC",
            idnat: branch.idnat ?? "",
            tel: branch.tel ?? "",
            latitude: branch.latitude,
            longitude: branch.longitude,
            attendanceRadius: branch.attendanceRadius,
          }}
        />
      </main>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateBranchForm } from "./components/create-branch-form";
import { enforceOrganizationManagerPage } from "@/lib/auth/require-organization-permission";

type NewBranchPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function NewBranchPage({ params }: NewBranchPageProps) {
  const { organizationId } = await params;
  await enforceOrganizationManagerPage(organizationId);
  const branchesHref = `/admin/organizations/${organizationId}/branches`;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6 lg:py-14">
        <Link
          href={branchesHref}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-blue-950 underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Retour à la liste
        </Link>

        <CreateBranchForm organizationId={organizationId} />
      </main>
    </div>
  );
}

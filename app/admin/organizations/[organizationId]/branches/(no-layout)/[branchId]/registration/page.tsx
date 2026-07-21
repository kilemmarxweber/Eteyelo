import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { IconUserCheck } from "@tabler/icons-react";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { requiresStudentImport } from "@/lib/branch-capabilities";
import { getPeopleLabels } from "@/lib/people-labels";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  const query = await searchParams;
  const { organizationId, branchId, typebranch } = await requireBranchContext();
  const peopleLabels = getPeopleLabels(typebranch);

  if (requiresStudentImport(typebranch)) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/student`,
    );
  }

  return (
    <Layout>
      <LayoutBody className="w-full space-y-6">
        <PageHeader
          title="Nouvelle inscription"
          description={`Constituez le dossier familial complet et affectez ${peopleLabels.studentDefinite} dans une classe disponible.`}
          badge={<Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>Inscription unifiee</Badge>}
        />
        <RegistrationForm initialRequestId={query.requestId ?? ""} />
      </LayoutBody>
    </Layout>
  );
}

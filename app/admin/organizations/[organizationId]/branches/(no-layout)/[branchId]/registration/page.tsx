import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { IconUserCheck } from "@tabler/icons-react";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { requiresStudentImport } from "@/lib/branch-capabilities";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const { organizationId, branchId, typebranch } = await requireBranchContext();

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
          description="Constituez le dossier familial complet et affectez l'eleve dans une classe disponible."
          badge={<Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>Inscription unifiee</Badge>}
        />
        <RegistrationForm />
      </LayoutBody>
    </Layout>
  );
}

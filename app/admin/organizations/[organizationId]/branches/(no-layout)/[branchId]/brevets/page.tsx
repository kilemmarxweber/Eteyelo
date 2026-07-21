import { Badge } from "@/components/ui/badge";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { IconCertificate } from "@tabler/icons-react";
import { redirect } from "next/navigation";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { usesBrevetForBranch } from "@/lib/branch-capabilities";
import { BrevetsClient } from "./components/brevets-client";

export const dynamic = "force-dynamic";

export default async function BrevetsPage() {
  const { organizationId, branchId, typebranch } = await requireBranchContext();

  if (!usesBrevetForBranch(typebranch)) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/results`,
    );
  }

  return (
    <Layout>
      <LayoutBody className="space-y-6">
        <PageHeader
          title="Brevets de formation"
          description="Emission des brevets par programme et session pour les apprenants inscrits."
          badge={
            <Badge variant="outline-primary" icon={<IconCertificate size={14} />}>
              Centre de formation
            </Badge>
          }
        />
        <BrevetsClient />
      </LayoutBody>
    </Layout>
  );
}

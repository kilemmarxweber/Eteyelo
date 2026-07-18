import { Badge } from "@/components/ui/badge";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { IconReportAnalytics } from "@tabler/icons-react";
import { redirect } from "next/navigation";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { usesReleveForBranch } from "@/lib/branch-capabilities";
import { RelevesClient } from "./components/releves-client";

export const dynamic = "force-dynamic";

export default async function RelevesPage() {
  const { organizationId, branchId, typebranch } = await requireBranchContext();

  if (!usesReleveForBranch(typebranch)) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/results`,
    );
  }

  return (
    <Layout>
      <LayoutBody className="space-y-6">
        <PageHeader
          title="Releves de notes"
          description="Generation des releves semestriels ou annuels a partir des fiches de cotes."
          badge={
            <Badge
              variant="outline-primary"
              icon={<IconReportAnalytics size={14} />}
            >
              Universite
            </Badge>
          }
        />
        <RelevesClient />
      </LayoutBody>
    </Layout>
  );
}

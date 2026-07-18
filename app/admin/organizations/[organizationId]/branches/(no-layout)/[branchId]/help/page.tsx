import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { IconBook } from "@tabler/icons-react";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { getBranchTypeHelpContent } from "@/lib/branch-type-help";
import { BranchTypeHelpPanel } from "@/components/branch/branch-type-help-panel";

export const dynamic = "force-dynamic";

export default async function BranchHelpPage() {
  const { organizationId, branchId, typebranch } = await requireBranchContext();
  const content = getBranchTypeHelpContent(typebranch);
  const branchBasePath = `/admin/organizations/${organizationId}/branches/${branchId}`;

  return (
    <Layout>
      <LayoutBody className="space-y-6">
        <PageHeader
          title="Aide contextuelle"
          description="Guide d'utilisation adapte au type de branche active."
          badge={
            <Badge variant="outline-primary" icon={<IconBook size={14} />}>
              {content.typeLabel}
            </Badge>
          }
        />
        <BranchTypeHelpPanel content={content} branchBasePath={branchBasePath} />
      </LayoutBody>
    </Layout>
  );
}

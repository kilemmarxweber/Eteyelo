import { Badge } from "@/components/ui/badge";
import { Layout, LayoutBody } from "@/components/custom/layout";
import { PageHeader } from "@/components/ui/page-header";
import { IconCertificate } from "@tabler/icons-react";
import { redirect } from "next/navigation";

import { requireBranchContext } from "@/lib/auth/require-branch-context";
import {
  isAtelierBranch,
  isUniversiteBranch,
  usesAttestationForBranch,
} from "@/lib/branch-capabilities";
import { AttestationsRouter } from "./components/attestations-router";

export const dynamic = "force-dynamic";

function getPageMeta(typebranch: string) {
  if (isUniversiteBranch(typebranch)) {
    return {
      title: "Attestations universitaires",
      description:
        "Emission des attestations d'inscription, d'assiduite et de reussite semestrielle.",
      badge: "Universite",
    };
  }

  return {
    title: "Attestations de participation",
    description:
      "Emission des attestations pour les eleves importes dans l'atelier.",
    badge: "Atelier",
  };
}

export default async function AttestationsPage() {
  const { organizationId, branchId, typebranch } = await requireBranchContext();

  if (!usesAttestationForBranch(typebranch)) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/results`,
    );
  }

  if (!isAtelierBranch(typebranch) && !isUniversiteBranch(typebranch)) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/results`,
    );
  }

  const meta = getPageMeta(typebranch);

  return (
    <Layout>
      <LayoutBody className="space-y-6">
        <PageHeader
          title={meta.title}
          description={meta.description}
          badge={
            <Badge variant="outline-primary" icon={<IconCertificate size={14} />}>
              {meta.badge}
            </Badge>
          }
        />
        <AttestationsRouter typebranch={typebranch} />
      </LayoutBody>
    </Layout>
  );
}

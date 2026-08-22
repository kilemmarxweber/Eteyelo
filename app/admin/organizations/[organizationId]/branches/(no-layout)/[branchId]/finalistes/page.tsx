import { redirect } from "next/navigation";
import { IconFileSpreadsheet } from "@tabler/icons-react";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { isPrimaryBranch } from "@/lib/branch-capabilities";

import { FinalistesClient } from "./components/finalistes-client";

export const dynamic = "force-dynamic";

export default async function FinalistesPage() {
  const { organizationId, branchId, typebranch } = await requireBranchContext();

  if (!isPrimaryBranch(typebranch)) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/results`,
    );
  }

  return (
    <BranchPageShell
      title="Liste finalistes"
      description="Export Excel des élèves de 6è (E13 & E80) pour la session d'examen."
      badge={
        <Badge
          variant="outline-primary"
          icon={<IconFileSpreadsheet size={14} />}
        >
          Cursus · Primaire
        </Badge>
      }
      fixedHeight
      fadedBelow
    >
      <FinalistesClient />
    </BranchPageShell>
  );
}

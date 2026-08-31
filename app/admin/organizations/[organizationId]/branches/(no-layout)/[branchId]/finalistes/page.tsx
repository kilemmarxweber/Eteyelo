import { redirect } from "next/navigation";
import { IconFileSpreadsheet } from "@tabler/icons-react";

import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { Badge } from "@/components/ui/badge";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { isBranchRouteAllowed } from "@/lib/branch-route-guard";

import { FinalistesClient } from "./components/finalistes-client";

export const dynamic = "force-dynamic";

export default async function FinalistesPage() {
  const { organizationId, branchId, typebranch, cycles } =
    await requireBranchContext();

  // Multi-cycle : autoriser si PRIMAIRE est parmi les cycles (pas seulement typebranch).
  if (
    !isBranchRouteAllowed("/finalistes", cycles.length ? cycles : typebranch)
  ) {
    redirect(
      `/admin/organizations/${organizationId}/branches/${branchId}/results`,
    );
  }

  return (
    <BranchPageShell
      title="Liste finalistes"
      description="6è primaire et 8è tronc commun : liste sans E13/E80. Secondaire terminal (4è) : liste avec E13 et E80."
      badge={
        <Badge
          variant="outline-primary"
          icon={<IconFileSpreadsheet size={14} />}
        >
          Cursus · Finalistes
        </Badge>
      }
      fixedHeight
      fadedBelow
    >
      <FinalistesClient />
    </BranchPageShell>
  );
}

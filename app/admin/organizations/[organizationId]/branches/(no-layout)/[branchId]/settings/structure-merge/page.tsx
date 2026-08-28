import { GitMerge } from "lucide-react";
import { IconCopy } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RequireBranchOrgSettingsAccess } from "../components/require-branch-org-settings-access";
import { listOrganizationBranchesForMergeAction } from "../../../branch-structure-merge.action";
import { MergeStructureDialog } from "../../../merge-structure-dialog";

export const dynamic = "force-dynamic";

export default async function StructureMergeSettingsPage({
  params,
}: {
  params: Promise<{ organizationId: string; branchId: string }>;
}) {
  const { organizationId, branchId } = await params;
  const result = await listOrganizationBranchesForMergeAction(organizationId);

  return (
    <RequireBranchOrgSettingsAccess level="school_ops">
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">
              Copier la structure scolaire
            </h2>
            <Badge variant="outline-primary" icon={<IconCopy size={14} />}>
              Structure
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Envoyez les sections, options, cours, pondérations et classes de cet
            établissement vers d&apos;autres branches de l&apos;organisation. Les
            IDs restent distincts ; un élément déjà présent (même code ou même
            nom) n&apos;est pas dupliqué.
          </p>
        </div>

        {!result.ok ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {result.message}
          </div>
        ) : result.branches.length < 2 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            Créez au moins un autre établissement dans l&apos;organisation pour
            copier cette structure.
          </div>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="space-y-1.5 p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <GitMerge className="size-5 shrink-0 text-primary" />
                Fusion inter-branches
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Choisissez la source, les éléments et les destinations, puis
                lancez la fusion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {result.branches.length} établissement
                  {result.branches.length > 1 ? "s" : ""} dans
                  l&apos;organisation
                </p>
                <MergeStructureDialog
                  organizationId={organizationId}
                  branches={result.branches}
                  defaultSourceId={branchId}
                  triggerLabel="Copier vers d'autres branches"
                  triggerClassName="w-full rounded-md sm:w-auto"
                />
              </div>

              <ul className="grid gap-3 sm:grid-cols-2">
                <li className="flex gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                  <GitMerge className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    Les élèves, enseignants, notes et emplois du temps ne sont
                    pas copiés.
                  </span>
                </li>
                <li className="flex gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                  <GitMerge className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    Relancer l&apos;opération est sûr : seuls les manquants sont
                    créés.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}

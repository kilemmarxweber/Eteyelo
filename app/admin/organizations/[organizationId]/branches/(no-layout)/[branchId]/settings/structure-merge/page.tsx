import { GitMerge } from "lucide-react";

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
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Copier la structure scolaire</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envoyez les sections, options, cours, pondérations et classes de cet
            établissement vers d&apos;autres branches de l&apos;organisation. Les
            IDs restent distincts ; un élément déjà présent (même code ou même
            nom) n&apos;est pas dupliqué.
          </p>
        </div>

        {!result.ok ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {result.message}
          </p>
        ) : result.branches.length < 2 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Créez au moins un autre établissement dans l&apos;organisation pour
            copier cette structure.
          </p>
        ) : (
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Choisissez la source, les éléments et les destinations, puis
              lancez la fusion.
            </p>
            <MergeStructureDialog
              organizationId={organizationId}
              branches={result.branches}
              defaultSourceId={branchId}
              triggerLabel="Copier vers d'autres branches"
              triggerClassName="rounded-md"
            />
          </div>
        )}

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <GitMerge className="mt-0.5 size-4 shrink-0 text-primary" />
            Les élèves, enseignants, notes et emplois du temps ne sont pas
            copiés.
          </li>
          <li className="flex gap-2">
            <GitMerge className="mt-0.5 size-4 shrink-0 text-primary" />
            Relancer l&apos;opération est sûr : seuls les manquants sont créés.
          </li>
        </ul>
      </div>
    </RequireBranchOrgSettingsAccess>
  );
}

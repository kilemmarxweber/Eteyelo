import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { BranchPageShell } from "@/components/layout/branch-page-shell";
import { IconUserCheck } from "@tabler/icons-react";
import { requireBranchContext } from "@/lib/auth/require-branch-context";
import { requiresStudentImport } from "@/lib/branch-capabilities";
import { getPeopleLabels } from "@/lib/people-labels";

export const dynamic = "force-dynamic";

const RegistrationForm = nextDynamic(
  () =>
    import("./registration-form").then((mod) => ({
      default: mod.RegistrationForm,
    })),
  {
    loading: () => (
      <div className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">
        Chargement du formulaire d&apos;inscription…
      </div>
    ),
  },
);

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
    <BranchPageShell
      className="w-full"
      title="Nouvelle inscription"
      description={`Constituez le dossier familial complet et affectez ${peopleLabels.studentDefinite} dans une classe disponible.`}
      badge={
        <Badge variant="outline-primary" icon={<IconUserCheck size={14} />}>
          Inscription unifiee
        </Badge>
      }
    >
      <RegistrationForm initialRequestId={query.requestId ?? ""} />
    </BranchPageShell>
  );
}

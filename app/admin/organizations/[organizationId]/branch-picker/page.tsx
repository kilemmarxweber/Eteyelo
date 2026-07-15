import { redirect } from "next/navigation";
import { School } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { getOrganizationAuthContext } from "@/lib/auth/require-organization-permission";
import { getUserBranchMembershipsForLogin } from "@/lib/auth/user-branch-access";
import { APP_ROLE } from "@/lib/permissions";
import { BranchPickerClient } from "./branch-picker-client";

type BranchPickerPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function BranchPickerPage({ params }: BranchPickerPageProps) {
  const { organizationId } = await params;
  const context = await getOrganizationAuthContext();

  if (!context) {
    redirect("/auth/sign-in");
  }

  const membership = await getUserOrganizationMembership(context.userId);
  if (!membership || membership.organizationId !== organizationId) {
    redirect("/admin");
  }

  const branches = await getUserBranchMembershipsForLogin(
    context.userId,
    organizationId,
    membership.role,
  );

  if (branches.length === 0) {
    redirect(`/admin/organizations/${organizationId}`);
  }

  if (branches.length === 1) {
    redirect(`/admin/organizations/${organizationId}/branches/${branches[0].branchId}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6">
      {context.appRole === APP_ROLE.OWNER || context.appRole === APP_ROLE.ADMIN ? (
        <BackLink
          href={`/admin/organizations/${organizationId}`}
          label="Retour organisation"
        />
      ) : null}

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/10 px-3 py-1 text-xs font-semibold text-blue-950">
          <School className="size-3.5" />
          Choix de branche
        </div>
        <h1 className="text-2xl font-bold text-slate-950">
          Selectionnez votre etablissement
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Votre compte est rattache a plusieurs branches. Choisissez celle que
          vous souhaitez utiliser pour cette session.
        </p>
      </div>

      <BranchPickerClient organizationId={organizationId} branches={branches} />
    </div>
  );
}

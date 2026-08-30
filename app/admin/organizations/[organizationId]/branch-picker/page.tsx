import { redirect } from "next/navigation";
import { School } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { getOrganizationMembership } from "@/lib/auth/org-membership";
import { getOrganizationAuthContext } from "@/lib/auth/require-organization-permission";
import { memberHasImplicitAllBranchAccess } from "@/lib/auth/role-labels";
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

  const membership = await getOrganizationMembership(
    context.userId,
    organizationId,
  );
  if (!membership) {
    redirect("/admin/organization-picker");
  }

  if (memberHasImplicitAllBranchAccess(membership.role)) {
    redirect(`/admin/organizations/${organizationId}`);
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
      {context.appRole === APP_ROLE.OWNER || context.appRole === APP_ROLE.ADMIN ? (
        <BackLink
          href={`/admin/organizations/${organizationId}`}
          label="Retour organisation"
        />
      ) : null}

      <div className="w-full max-w-7xl space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/10 px-3 py-1 text-xs font-semibold text-foreground">
          <School className="size-3.5" />
          Choix de branche
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Selectionnez votre etablissement
        </h1>
        <p className="w-full max-w-7xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Votre compte est rattache a plusieurs branches. Choisissez celle que
          vous souhaitez utiliser pour cette session.
        </p>
      </div>

      <BranchPickerClient organizationId={organizationId} branches={branches} />
    </div>
  );
}

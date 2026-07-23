import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listAccessibleOrganizationMemberships } from "@/lib/auth/org-membership";
import { isPlatformOwnerRole } from "@/lib/permissions";
import { OrganizationPickerClient } from "./organization-picker-client";

export default async function OrganizationPickerPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  if (isPlatformOwnerRole(session.user.role)) {
    redirect("/admin");
  }

  const organizations = await listAccessibleOrganizationMemberships(
    session.user.id,
  );

  if (organizations.length === 0) {
    redirect("/admin/no-organization");
  }

  if (organizations.length === 1) {
    redirect(`/admin/organizations/${organizations[0].organizationId}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/10 px-3 py-1 text-xs font-semibold text-foreground">
          <Building2 className="size-3.5" />
          Choix d’organisation
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Sélectionnez une organisation
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Votre compte est rattaché à plusieurs organisations. Choisissez celle
          que vous souhaitez utiliser pour cette session.
        </p>
      </div>

      <OrganizationPickerClient organizations={organizations} />
    </div>
  );
}

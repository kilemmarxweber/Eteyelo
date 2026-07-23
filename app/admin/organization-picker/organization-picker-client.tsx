"use client";

import { useAppTransition as useTransition } from "@/hooks/use-app-transition";
import { ArrowRight, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { selectOrganizationForSessionAction } from "@/app/admin/organization-picker/actions";
import { Button } from "@/components/ui/button";
import { orgRoleLabel } from "@/lib/org-role-labels";
import type { AccessibleOrganizationMembership } from "@/lib/auth/org-membership";

type Props = {
  organizations: AccessibleOrganizationMembership[];
};

export function OrganizationPickerClient({ organizations }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSelect(organizationId: string) {
    startTransition(async () => {
      const res = await selectOrganizationForSessionAction(organizationId);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      router.push(res.path);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {organizations.map((org) => (
        <Button
          key={org.organizationId}
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => onSelect(org.organizationId)}
          className="h-auto min-h-12 justify-between rounded-xl px-3.5 py-3 text-left"
        >
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">
                {org.organizationName}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                {orgRoleLabel(org.role.split(",")[0]?.trim() ?? org.role)}
              </span>
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Continuer dans cette organisation
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      ))}

      {organizations.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Aucune organisation active accessible. Contactez un administrateur.
        </p>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="size-3.5" />
        Les organisations archivées ou désactivées n’apparaissent pas ici.
      </p>
    </div>
  );
}
